import type { HomeAPIAdapter } from '../api/index.ts'
import { Intl, Temporal } from '../temporal.ts'
import {
  type HomeEnergyData,
  type HomeEnergyReportPoint,
  type Result,
  mapResult,
} from '../types/index.ts'
import { toEpochMs } from '../utils.ts'
import type { ReportChartLineOptions } from './report-types.ts'
import {
  type HomeChartWindow,
  fetchHomeChunks,
  resolveHomeReportWindow,
  splitHomeReportWindow,
  toHomeWireWindow,
  windowDaysOf,
} from './home-report.ts'

/**
 * Hourly energy of an air-to-water unit: both directions, which the
 * wire answers together.
 * @category Facades
 */
export interface HomeAtwEnergySeries extends HomeEnergySeries {
  readonly produced: HomeEnergySeriesPoint[]
}

/**
 * Window and bucket grain of the raw air-to-air telemetry read:
 * `from` and `to` as ISO timestamps, `interval` in the wire's own
 * vocabulary (`Hour` or `Day`).
 * @category Facades
 */
export interface HomeEnergyQuery {
  readonly from: string
  readonly interval: string
  readonly to: string
}

/**
 * Hourly energy of a Home unit, oldest bucket first: the one direction
 * an air-to-air unit reports.
 * @category Facades
 */
export interface HomeEnergySeries {
  readonly consumed: HomeEnergySeriesPoint[]
}

/**
 * One hour bucket of a Home unit's energy: its start as an epoch-ms
 * instant and its energy in kilowatt-hours, whatever the device type.
 * A sample the wire garbles degrades field-by-field to `null` — never
 * `NaN`, which `JSON.stringify` silently rewrites — and keeps its
 * entry.
 * @category Facades
 */
export interface HomeEnergySeriesPoint {
  readonly atEpochMs: number | null
  readonly kilowattHours: number | null
}

/**
 * Window of an hourly energy read, as ISO timestamps (a zoneless one
 * is UTC wall clock): every hour bucket the window touches is
 * answered, the one holding `from` and the one in progress included,
 * and `to` is exclusive. The window is clamped to the wire's retention
 * span like every Home report window, and costs one request per day it
 * covers.
 * @category Facades
 */
export interface HomeEnergySeriesQuery {
  readonly from: string
  readonly to: string
}

// Telemetry buckets, their stamps and their caps are all counted on the
// UTC clock.
const UTC = 'UTC'

// The ATA cumulative measure reports watt-hours (100 Wh pulses,
// live-probed 2026-07-18: a daily bucket of `571.0` for ~0.57 kWh).
const WATT_HOURS_PER_KILOWATT_HOUR = 1000

// The telemetry endpoint no longer applies `to` (live-probed
// 2026-11-21): a response runs from `from` for a span of its own, or to
// now. At `Hour` that span is 24 buckets — a one-hour window a day old
// came back with all 24, a 30-hour one cut after them. At `Day` it is
// 31 days: a month answered whole, three months came back empty for a
// unit active on its last three days. Each grain is therefore asked in
// chunks its span is known to hold, and what a response carries beyond
// its chunk is sifted out afterwards.
const ATA_ENERGY_GRAINS = {
  Day: { chunkDays: 30, smallestUnit: 'day' },
  Hour: { chunkDays: 1, smallestUnit: 'hour' },
} as const

// The two energy datasets of the combined-energy report, by direction.
const ATW_ENERGY_DATASETS = {
  consumed: 'interval_energy_consumed',
  produced: 'interval_energy_produced',
} as const

// `Daily` answers hour buckets, `Monthly` day buckets. A request never
// spans more than one period — a day, or 28 days, which no month is
// shorter than — and starts on a midnight of the unit: past one period
// the wire repeats the previous point at each period boundary, under a
// label of its own wherever the real bucket is idle, so nothing can
// sift it out afterwards (live-probed 2026-11-21).
const ATW_ENERGY_GRAINS = {
  day: { days: 28, period: 'Monthly' },
  hour: { days: 1, period: 'Daily' },
} as const

type AtwEnergyPoints = Record<
  keyof typeof ATW_ENERGY_DATASETS,
  HomeEnergyReportPoint[]
>

/**
 * Display bucket granularity of the Home energy charts.
 */
type HomeEnergyBucketUnit = 'day' | 'hour' | 'localDay'

// Hour buckets up to one day of window, day buckets beyond: the grain
// follows the span asked for, so one choice of a host's picker charts
// one way at any time of day, and the way the Classic report does,
// whose wire answers hours for a one-day report alone. The minute is
// for a rolling one-day window, whose `from` the caller stamps a beat
// before the library stamps `to`. Until 62.0.2 the cutoff sat at a day
// and a half, "halfway to the next whole-day option", which holds for
// whole days counted back from now: com.melcloud anchors "N days" on
// local midnight, so its "2 days" spans one to two days and charted
// hours before noon, days after.
const MAX_HOURLY_ENERGY_WINDOW: Temporal.DurationLike = { days: 1, minutes: 1 }

// Up to a week, an air-to-air day bucket sums the hour buckets of one
// calendar day of the display timezone, at one request per day of
// window (the wire's own day buckets are UTC days, which smear evening
// usage onto the next bar in UTC+ zones). Beyond, those UTC days are
// charted as they are: the shift is invisible at that zoom, and a
// month of hour buckets would be thirty requests.
const MAX_LOCAL_DAY_ENERGY_DAYS = 7

/**
 * Parses one wire energy value into kilowatt-hours; a value that is not
 * a finite number — the empty string included (`Number('')` reads `0`,
 * which would invent a measurement) — has nothing to say and reads
 * `null`. The scale DIVIDES (a watt-hour reading over `1000`) rather
 * than multiplying by its inverse: division is what consumers computed
 * before this projection existed, and `571 / 1000` rounds to the same
 * double the literal `0.571` denotes, where `571 * 0.001` lands one
 * ulp off.
 * @param value - Wire value string, in watt-hours.
 * @returns The energy in kWh, or `null` when unparseable.
 */
const toKilowattHours = (value: string): number | null => {
  const trimmed = value.trim()
  const numeric = Number(trimmed)
  return trimmed !== '' && Number.isFinite(numeric)
    ? numeric / WATT_HOURS_PER_KILOWATT_HOUR
    : null
}

/**
 * Projects a telemetry bundle onto the normalized series: every series
 * flattened in wire order, each sample's nanosecond-padded UTC
 * wall-clock stamp anchored as an epoch-ms instant and its watt-hours
 * scaled to kWh.
 * @param data - Wire telemetry bundle.
 * @returns The normalized samples, in wire order.
 */
const toAtaEnergySeries = (data: HomeEnergyData): HomeEnergySeriesPoint[] =>
  data.measureData
    .flatMap((measure) => measure.values)
    .map(({ time, value }) => ({
      // The wire's space date-time separator is in Temporal's own
      // grammar, so the stamp parses as-is.
      atEpochMs: toEpochMs(time, UTC),
      kilowattHours: toKilowattHours(value),
    }))

/**
 * Projects the points of one combined-energy dataset onto the
 * normalized series: each zoneless label anchored as an epoch-ms
 * instant on the clock of `zone`, each value already kWh. The hour the
 * clocks go back, the wire gives its two passes one label (live-probed
 * on the 25-hour day of 2026-10-25: `02:00` twice in one dataset, once
 * in the other, which pass being untold). Both read the LATER instant:
 * on the earlier one, a pass still in progress would read as an hour
 * that has closed.
 * @param points - Dataset points, in wire order.
 * @param zone - IANA timezone the labels are read in.
 * @returns The normalized samples, in wire order.
 */
const toAtwEnergySeries = (
  points: readonly HomeEnergyReportPoint[],
  zone: string,
): HomeEnergySeriesPoint[] =>
  points.map((point) => ({
    atEpochMs: toEpochMs(point.x, zone, 'later'),
    kilowattHours: point.y,
  }))

// A `Day` response runs a day past its 30-day chunk, so the day two
// chunks meet on is answered by both (live-probed 2026-11-21: that day
// charted double). Whatever the grain, a bucket an earlier chunk
// answered is dropped from the later ones.
const mergeAtaEnergyChunks = (
  chunks: readonly HomeEnergyData[],
): HomeEnergyData => {
  const answered = new Set<string>()
  return {
    measureData: chunks.flatMap(({ measureData }) => {
      const fresh = measureData.map((measure) => ({
        ...measure,
        values: measure.values.filter(({ time }) => !answered.has(time)),
      }))
      const freshValues = fresh.flatMap(({ values }) => values)
      for (const { time } of freshValues) {
        answered.add(time)
      }
      return fresh
    }),
  }
}

// A window that ends where it starts, or before, holds no bucket: it
// is answered without a request.
const isEmptyWindow = ({ from, to }: HomeChartWindow): boolean =>
  Temporal.ZonedDateTime.compare(from, to) >= 0

// The request windows of a telemetry read: chunks of the grain's span
// counted on the UTC clock — it has no clock change to stretch a day
// past the span — between two bucket boundaries. A `from` inside a
// bucket does not answer that bucket whole, and a wire that applied
// `to` again must not stop short of the bucket that holds it.
const toAtaChunks = (
  window: HomeChartWindow,
  {
    chunkDays,
    smallestUnit,
  }: (typeof ATA_ENERGY_GRAINS)[keyof typeof ATA_ENERGY_GRAINS],
): HomeChartWindow[] => {
  if (isEmptyWindow(window)) {
    return []
  }
  const from = window.from.withTimeZone(UTC)
  const to = window.to.withTimeZone(UTC)
  return splitHomeReportWindow(
    {
      from: from.round({ roundingMode: 'floor', smallestUnit }),
      to: to.round({ roundingMode: 'ceil', smallestUnit }),
    },
    chunkDays,
  )
}

/**
 * Fetch air-to-air energy telemetry over a window of any length: one
 * request per chunk the grain's span holds, merged into one bundle.
 * The bundle may run past the window's end, the wire not applying `to`.
 * @param api - Home API client.
 * @param id - Device id.
 * @param options - Read inputs.
 * @param options.interval - Bucket grain.
 * @param options.window - Resolved window.
 * @returns The merged telemetry bundle, or the first chunk failure.
 */
const fetchAtaEnergy = async (
  api: HomeAPIAdapter,
  id: string,
  {
    interval,
    window,
  }: { interval: keyof typeof ATA_ENERGY_GRAINS; window: HomeChartWindow },
): Promise<Result<HomeEnergyData>> =>
  mapResult(
    await fetchHomeChunks(
      async (chunk) =>
        api.getAtaEnergy(id, { ...toHomeWireWindow(chunk), interval }),
      toAtaChunks(window, ATA_ENERGY_GRAINS[interval]),
    ),
    mergeAtaEnergyChunks,
  )

// The date whose start closes a window: the day after the one `to`
// falls in, or that very day when `to` is its first instant.
const toClosingDate = (
  to: Temporal.ZonedDateTime,
  zone: string,
): Temporal.PlainDate => {
  const end = to.withTimeZone(zone)
  const day = end.toPlainDate()
  return Temporal.ZonedDateTime.compare(end.startOfDay(), end) < 0
    ? day.add({ days: 1 })
    : day
}

// The request windows of a combined-energy read: consecutive spans of
// `days` calendar days of the unit, from the midnight that opens the
// window's first day to the one that closes its last. Each bound is the
// start of a DATE: where a clock change skips midnight (the Azores,
// Chile, Egypt, Lebanon, Cuba) that day opens at 01:00, and a span
// counted from that instant would open every later one at 01:00 too.
const toPeriodWindows = (
  window: HomeChartWindow,
  { days, zone }: { days: number; zone: string },
): HomeChartWindow[] => {
  if (isEmptyWindow(window)) {
    return []
  }
  const opening = window.from.withTimeZone(zone).toPlainDate()
  const closing = toClosingDate(window.to, zone)
  return Array.from(
    { length: Math.ceil(opening.until(closing).days / days) },
    (_unused, index) => {
      const from = opening.add({ days: index * days })
      const next = from.add({ days })
      const to = Temporal.PlainDate.compare(next, closing) < 0 ? next : closing
      return { from: from.toZonedDateTime(zone), to: to.toZonedDateTime(zone) }
    },
  )
}

/**
 * Fetch the energy of an air-to-water unit over a window of any
 * length: one combined-energy request per period, the two energy
 * datasets gathered per direction with their labels untouched.
 * @param api - Home API client.
 * @param id - Device id.
 * @param options - Read inputs.
 * @param options.grain - Bucket grain.
 * @param options.window - Resolved window.
 * @param options.zone - IANA timezone of the unit.
 * @returns The points per direction, or the first request failure.
 */
const fetchAtwEnergy = async (
  api: HomeAPIAdapter,
  id: string,
  {
    grain,
    window,
    zone,
  }: {
    grain: keyof typeof ATW_ENERGY_GRAINS
    window: HomeChartWindow
    zone: string
  },
): Promise<Result<AtwEnergyPoints>> => {
  const { days, period } = ATW_ENERGY_GRAINS[grain]
  return mapResult(
    await fetchHomeChunks(
      async (chunk) =>
        api.getAtwEnergy(id, { ...toHomeWireWindow(chunk), period }),
      toPeriodWindows(window, { days, zone }),
    ),
    (chunks) => {
      const datasets = chunks.flat().flatMap((report) => report.datasets)
      const pointsOf = (datasetId: string): HomeEnergyReportPoint[] =>
        datasets
          .filter((dataset) => dataset.id === datasetId)
          .flatMap((dataset) => dataset.data)
      return {
        consumed: pointsOf(ATW_ENERGY_DATASETS.consumed),
        produced: pointsOf(ATW_ENERGY_DATASETS.produced),
      }
    },
  )
}

// An hourly read answers the buckets its window touches: one started
// less than an hour before `from` still holds it, and `to` is
// exclusive. Neither wire stops there by itself — the telemetry one
// ignores `to`, the report one answers whole days. A sample without an
// instant cannot be placed and keeps its entry.
const keepTouchedBuckets = (
  points: readonly HomeEnergySeriesPoint[],
  { from, to }: HomeChartWindow,
): HomeEnergySeriesPoint[] => {
  const earliest = from.subtract({ hours: 1 }).epochMilliseconds
  const latest = to.epochMilliseconds
  return points.filter(
    ({ atEpochMs }) =>
      atEpochMs === null || (atEpochMs > earliest && atEpochMs < latest),
  )
}

/**
 * Read the hourly energy of an air-to-air unit — the body of
 * `HomeDeviceAtaFacade.getEnergySeries`.
 * @param api - Home API client.
 * @param id - Device id.
 * @param query - Read window.
 * @returns The normalized series, or a typed failure.
 */
export const getHomeAtaEnergySeries = async (
  api: HomeAPIAdapter,
  id: string,
  query: HomeEnergySeriesQuery,
): Promise<Result<HomeEnergySeries>> => {
  const window = resolveHomeReportWindow(query, UTC)
  return mapResult(
    await fetchAtaEnergy(api, id, { interval: 'Hour', window }),
    (data) => ({
      consumed: keepTouchedBuckets(toAtaEnergySeries(data), window),
    }),
  )
}

/**
 * Read the hourly energy of an air-to-water unit — the body of
 * `HomeDeviceAtwFacade.getEnergySeries`.
 * @param api - Home API client.
 * @param id - Device id.
 * @param options - Read inputs.
 * @param options.query - Read window.
 * @param options.zone - IANA timezone of the unit, the clock its
 * labels are read on.
 * @returns The normalized series per direction, or a typed failure.
 */
export const getHomeAtwEnergySeries = async (
  api: HomeAPIAdapter,
  id: string,
  { query, zone }: { query: HomeEnergySeriesQuery; zone: string },
): Promise<Result<HomeAtwEnergySeries>> => {
  const window = resolveHomeReportWindow(query, UTC)
  return mapResult(
    await fetchAtwEnergy(api, id, { grain: 'hour', window, zone }),
    ({ consumed, produced }) => ({
      consumed: keepTouchedBuckets(toAtwEnergySeries(consumed, zone), window),
      produced: keepTouchedBuckets(toAtwEnergySeries(produced, zone), window),
    }),
  )
}

const enumerateDays = (
  first: Temporal.PlainDate,
  last: Temporal.PlainDate,
): Temporal.PlainDate[] => {
  const days: Temporal.PlainDate[] = []
  for (
    let day = first;
    Temporal.PlainDate.compare(day, last) <= 0;
    day = day.add({ days: 1 })
  ) {
    days.push(day)
  }
  return days
}

// Telemetry buckets are UTC calendar days (or hours) on the wire:
// enumerate them by their literal timestamps instead of shifting them
// into the display timezone.
const buildUtcDayGrid = (window: HomeChartWindow): string[] =>
  enumerateDays(
    window.from.withTimeZone(UTC).toPlainDate(),
    window.to.withTimeZone(UTC).toPlainDate(),
  ).map((day) => day.toPlainDateTime().toString())

// Local-day buckets enumerate the calendar days of the display
// timezone the window spans (its bounds already live in that zone).
const buildLocalDayGrid = (window: HomeChartWindow): string[] =>
  enumerateDays(window.from.toPlainDate(), window.to.toPlainDate()).map((day) =>
    day.toString(),
  )

// The two clocks of a chart: the one its hour buckets start on — UTC
// for the telemetry ones, the unit's own for the report ones, where an
// hour is not a round UTC hour everywhere — and the display timezone,
// which the day buckets and every label are read in.
interface EnergyChartClocks {
  readonly bucketZone: string
  readonly timezone: string
}

// Start of the hour that holds `bound` on the buckets' clock, as an
// instant.
const toBucketHour = (
  bound: Temporal.ZonedDateTime,
  bucketZone: string,
): Temporal.ZonedDateTime =>
  bound
    .withTimeZone(bucketZone)
    .round({ roundingMode: 'floor', smallestUnit: 'hour' })

const buildHourGrid = (
  window: HomeChartWindow,
  bucketZone: string,
): string[] => {
  const last = toBucketHour(window.to, bucketZone)
  const hours: string[] = []
  for (
    let hour = toBucketHour(window.from, bucketZone);
    Temporal.ZonedDateTime.compare(hour, last) <= 0;
    hour = hour.add({ hours: 1 })
  ) {
    hours.push(hour.toInstant().toString())
  }
  return hours
}

// Slot key of one bucket instant: the hour that holds it on the
// buckets' clock, the calendar day it falls on in the display
// timezone, or its UTC calendar day — matching the grid the unit
// builds.
const toEnergySlotKey = (
  epochMs: number,
  bucketUnit: HomeEnergyBucketUnit,
  { bucketZone, timezone }: EnergyChartClocks,
): string => {
  const utc =
    Temporal.Instant.fromEpochMilliseconds(epochMs).toZonedDateTimeISO(UTC)
  if (bucketUnit === 'hour') {
    return toBucketHour(utc, bucketZone).toInstant().toString()
  }
  return (
    bucketUnit === 'localDay'
      ? utc.withTimeZone(timezone).toPlainDate()
      : utc.toPlainDate().toPlainDateTime()
  ).toString()
}

const sumEnergyBySlot = (
  points: readonly HomeEnergySeriesPoint[],
  {
    bucketUnit,
    clocks,
  }: { bucketUnit: HomeEnergyBucketUnit; clocks: EnergyChartClocks },
): Map<string, number> => {
  const bySlot = new Map<string, number>()
  for (const { atEpochMs, kilowattHours } of points) {
    if (atEpochMs === null) {
      continue
    }
    const slot = toEnergySlotKey(atEpochMs, bucketUnit, clocks)
    bySlot.set(slot, (bySlot.get(slot) ?? 0) + (kilowattHours ?? 0))
  }
  return bySlot
}

// Hour buckets render on the display clock (a 23:00 UTC bucket is the
// user's 01:00); local-day buckets are already display dates; UTC day
// buckets keep their calendar date.
const toEnergySlotLabel = (
  slot: string,
  bucketUnit: HomeEnergyBucketUnit,
  timezone: string,
): Temporal.PlainDate | Temporal.PlainDateTime => {
  if (bucketUnit === 'hour') {
    return Temporal.Instant.from(slot)
      .toZonedDateTimeISO(timezone)
      .toPlainDateTime()
  }
  return (
    bucketUnit === 'localDay' ? Temporal.PlainDate : Temporal.PlainDateTime
  ).from(slot)
}

const energyGridBuilders: Record<
  HomeEnergyBucketUnit,
  (window: HomeChartWindow, bucketZone: string) => string[]
> = { day: buildUtcDayGrid, hour: buildHourGrid, localDay: buildLocalDayGrid }

/**
 * Rebuild sparse energy buckets into Classic-shaped line chart options
 * on a regular grid: one series per source, missing buckets as `0`
 * (the wire omits idle ones entirely), a garbled energy as `0` too.
 * @param options - Conversion inputs.
 * @param options.bucketUnit - Display bucket granularity (`hour`
 * matches the Classic one-day report; `localDay` sums the buckets of
 * one calendar day of the display timezone; `day` is UTC days).
 * @param options.bucketZone - IANA timezone the hour buckets start on.
 * @param options.locale - BCP-47 locale tag for axis labels.
 * @param options.sources - One entry per charted series, already in
 * kWh.
 * @param options.window - Resolved chart window (in the display timezone).
 * @returns Structured line chart options (`kWh`).
 */
const toHomeEnergyOptions = ({
  bucketUnit,
  bucketZone,
  locale,
  sources,
  window,
}: {
  bucketUnit: HomeEnergyBucketUnit
  bucketZone: string
  sources: readonly {
    readonly name: string
    readonly points: readonly HomeEnergySeriesPoint[]
  }[]
  window: HomeChartWindow
  locale?: string | undefined
}): ReportChartLineOptions => {
  const timezone = window.from.timeZoneId
  const clocks = { bucketZone, timezone }
  const slots = energyGridBuilders[bucketUnit](window, bucketZone)
  const formatter = new Intl.DateTimeFormat(
    locale,
    bucketUnit === 'hour'
      ? { hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'short' },
  )
  return {
    from: window.from.toPlainDateTime().toString(),
    labels: slots.map((slot) =>
      formatter.format(toEnergySlotLabel(slot, bucketUnit, timezone)),
    ),
    series: sources.map(({ name, points }) => {
      const bySlot = sumEnergyBySlot(points, { bucketUnit, clocks })
      return { data: slots.map((slot) => bySlot.get(slot) ?? 0), name }
    }),
    to: window.to.toPlainDateTime().toString(),
    unit: 'kWh',
  }
}

const isHourlyEnergyWindow = ({ from, to }: HomeChartWindow): boolean =>
  Temporal.ZonedDateTime.compare(to, from.add(MAX_HOURLY_ENERGY_WINDOW)) <= 0

// Display bucket of an air-to-air chart: hourly on a one-day span —
// matching the Classic one-day report — calendar days of the display
// timezone up to a week, the wire's UTC days beyond.
const toAtaEnergyBucketUnit = (
  window: HomeChartWindow,
): HomeEnergyBucketUnit => {
  if (isHourlyEnergyWindow(window)) {
    return 'hour'
  }
  return windowDaysOf(window) <= MAX_LOCAL_DAY_ENERGY_DAYS ? 'localDay' : 'day'
}

/**
 * Chart the energy of an air-to-air unit — the body of
 * `HomeDeviceAtaFacade.getEnergyReport`.
 * @param api - Home API client.
 * @param id - Device id.
 * @param window - Resolved chart window (in the display timezone).
 * @returns Structured line chart options (`kWh`), or a typed failure.
 */
export const getHomeAtaEnergyReport = async (
  api: HomeAPIAdapter,
  id: string,
  window: HomeChartWindow,
): Promise<Result<ReportChartLineOptions>> => {
  const bucketUnit = toAtaEnergyBucketUnit(window)
  return mapResult(
    await fetchAtaEnergy(api, id, {
      interval: bucketUnit === 'day' ? 'Day' : 'Hour',
      window,
    }),
    (data) => {
      const points = toAtaEnergySeries(data)
      return toHomeEnergyOptions({
        bucketUnit,
        bucketZone: UTC,
        locale: api.locale,
        // Hour buckets summed into days must stop where the window
        // does; a day bucket is charted whole, and the grid alone
        // bounds it.
        sources: [
          {
            name: 'Consumed',
            points:
              bucketUnit === 'day'
                ? points
                : keepTouchedBuckets(points, window),
          },
        ],
        window,
      })
    },
  )
}

/**
 * Chart the energy of an air-to-water unit — the body of
 * `HomeDeviceAtwFacade.getEnergyReport`: hour buckets on a one-day
 * span, the unit's own day buckets beyond.
 * @param api - Home API client.
 * @param id - Device id.
 * @param options - Chart inputs.
 * @param options.window - Resolved chart window (in the display timezone).
 * @param options.zone - IANA timezone of the unit.
 * @returns Structured line chart options (`kWh`), or a typed failure.
 */
export const getHomeAtwEnergyReport = async (
  api: HomeAPIAdapter,
  id: string,
  { window, zone }: { window: HomeChartWindow; zone: string },
): Promise<Result<ReportChartLineOptions>> => {
  const isHourly = isHourlyEnergyWindow(window)
  // An hour bucket is an instant, read on the unit's clock. A day
  // bucket is a calendar date of the unit's: read on the display
  // clock, it charts under that same date whatever the two zones are.
  const labelZone = isHourly ? zone : window.from.timeZoneId
  return mapResult(
    await fetchAtwEnergy(api, id, {
      grain: isHourly ? 'hour' : 'day',
      window,
      zone,
    }),
    ({ consumed, produced }) =>
      toHomeEnergyOptions({
        bucketUnit: isHourly ? 'hour' : 'localDay',
        bucketZone: zone,
        locale: api.locale,
        sources: [
          { name: 'Consumed', points: toAtwEnergySeries(consumed, labelZone) },
          { name: 'Produced', points: toAtwEnergySeries(produced, labelZone) },
        ],
        window,
      }),
  )
}
