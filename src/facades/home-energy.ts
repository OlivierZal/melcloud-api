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

// A telemetry response stops short of its window (live-probed
// 2026-11-21). At `Hour` it carries the 24 buckets that follow `from`:
// a 25-hour and a 30-hour window both came back cut there. At `Day` it
// carries a month at least: 31 days answered whole, 92 days came back
// empty for a unit active on its last three. Each grain is therefore
// asked in chunks its cap is known to hold.
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

// A "one day" query resolves a hair over 1.0 days (the caller stamps
// `from` a few milliseconds before the library stamps `to`), so the
// hourly-bucket cutoff sits halfway to the next whole-day option.
const MAX_HOURLY_ENERGY_DAYS = 1.5

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
 * instant on the clock of `zone`, each value already kWh.
 * @param points - Dataset points, in wire order.
 * @param zone - IANA timezone the labels are read in.
 * @returns The normalized samples, in wire order.
 */
const toAtwEnergySeries = (
  points: readonly HomeEnergyReportPoint[],
  zone: string,
): HomeEnergySeriesPoint[] =>
  points.map((point) => ({
    atEpochMs: toEpochMs(point.x, zone),
    kilowattHours: point.y,
  }))

// At `Day` the wire closes a window on the bucket that holds `to`, so
// the day two chunks meet on is answered by both (live-probed
// 2026-11-21: that day charted double). Whatever the grain, a bucket an
// earlier chunk answered is dropped from the later ones.
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

/**
 * Fetch air-to-air energy telemetry over a window of any length: one
 * request per chunk the grain's cap holds, merged into one bundle.
 * Chunks are counted on the UTC clock — it has no clock change to
 * stretch a day past the cap — from a bucket boundary.
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
): Promise<Result<HomeEnergyData>> => {
  const { chunkDays, smallestUnit } = ATA_ENERGY_GRAINS[interval]
  const from = window.from
    .withTimeZone(UTC)
    .round({ roundingMode: 'floor', smallestUnit })
  return mapResult(
    await fetchHomeChunks(
      async (chunk) =>
        api.getAtaEnergy(id, { ...toHomeWireWindow(chunk), interval }),
      splitHomeReportWindow({ from, to: window.to }, chunkDays),
    ),
    mergeAtaEnergyChunks,
  )
}

// The request windows of a combined-energy read: consecutive spans of
// `days` days on the unit's own calendar, from the midnight that opens
// the window's first day to the one that closes its last.
const toPeriodWindows = (
  { from, to }: HomeChartWindow,
  { days, zone }: { days: number; zone: string },
): HomeChartWindow[] => {
  const end = to.withTimeZone(zone)
  const midnight = end.startOfDay()
  return splitHomeReportWindow(
    {
      from: from.withTimeZone(zone).startOfDay(),
      to:
        Temporal.ZonedDateTime.compare(midnight, end) < 0
          ? midnight.add({ days: 1 })
          : midnight,
    },
    days,
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
// exclusive. A sample without an instant cannot be placed and keeps its
// entry.
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
): Promise<Result<HomeEnergySeries>> =>
  mapResult(
    await fetchAtaEnergy(api, id, {
      interval: 'Hour',
      window: resolveHomeReportWindow(query, UTC),
    }),
    (data) => ({ consumed: toAtaEnergySeries(data) }),
  )

/**
 * Read the hourly energy of an air-to-water unit — the body of
 * `HomeDeviceAtwFacade.getEnergySeries`. The wire answers whole days
 * of the unit, so the series is cut back to the buckets the window
 * touches.
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

const toUtcHour = (bound: Temporal.ZonedDateTime): Temporal.PlainDateTime =>
  bound
    .withTimeZone(UTC)
    .toPlainDateTime()
    .round({ roundingMode: 'floor', smallestUnit: 'hour' })

const buildUtcHourGrid = (window: HomeChartWindow): string[] => {
  const last = toUtcHour(window.to)
  const hours: string[] = []
  for (
    let hour = toUtcHour(window.from);
    Temporal.PlainDateTime.compare(hour, last) <= 0;
    hour = hour.add({ hours: 1 })
  ) {
    hours.push(hour.toString())
  }
  return hours
}

// Slot key of one bucket instant: its floored UTC hour, the calendar
// day it falls on in the display timezone, or its UTC calendar day —
// matching the grid the unit builds.
const toEnergySlotKey = (
  epochMs: number,
  bucketUnit: HomeEnergyBucketUnit,
  timezone: string,
): string => {
  const utc =
    Temporal.Instant.fromEpochMilliseconds(epochMs).toZonedDateTimeISO(UTC)
  if (bucketUnit === 'hour') {
    return toUtcHour(utc).toString()
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
    timezone,
  }: { bucketUnit: HomeEnergyBucketUnit; timezone: string },
): Map<string, number> => {
  const bySlot = new Map<string, number>()
  for (const { atEpochMs, kilowattHours } of points) {
    if (atEpochMs === null) {
      continue
    }
    const slot = toEnergySlotKey(atEpochMs, bucketUnit, timezone)
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
    return Temporal.PlainDateTime.from(slot)
      .toZonedDateTime(UTC)
      .withTimeZone(timezone)
      .toPlainDateTime()
  }
  return (
    bucketUnit === 'localDay' ? Temporal.PlainDate : Temporal.PlainDateTime
  ).from(slot)
}

const energyGridBuilders: Record<
  HomeEnergyBucketUnit,
  (window: HomeChartWindow) => string[]
> = {
  day: buildUtcDayGrid,
  hour: buildUtcHourGrid,
  localDay: buildLocalDayGrid,
}

/**
 * Rebuild sparse energy buckets into Classic-shaped line chart options
 * on a regular grid: one series per source, missing buckets as `0`
 * (the wire omits idle ones entirely), a garbled energy as `0` too.
 * @param options - Conversion inputs.
 * @param options.bucketUnit - Display bucket granularity (`hour`
 * matches the Classic one-day report; `localDay` sums the buckets of
 * one calendar day of the display timezone; `day` is UTC days).
 * @param options.locale - BCP-47 locale tag for axis labels.
 * @param options.sources - One entry per charted series, already in
 * kWh.
 * @param options.window - Resolved chart window (in the display timezone).
 * @returns Structured line chart options (`kWh`).
 */
const toHomeEnergyOptions = ({
  bucketUnit,
  locale,
  sources,
  window,
}: {
  bucketUnit: HomeEnergyBucketUnit
  sources: readonly {
    readonly name: string
    readonly points: readonly HomeEnergySeriesPoint[]
  }[]
  window: HomeChartWindow
  locale?: string | undefined
}): ReportChartLineOptions => {
  const timezone = window.from.timeZoneId
  const slots = energyGridBuilders[bucketUnit](window)
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
      const bySlot = sumEnergyBySlot(points, { bucketUnit, timezone })
      return { data: slots.map((slot) => bySlot.get(slot) ?? 0), name }
    }),
    to: window.to.toPlainDateTime().toString(),
    unit: 'kWh',
  }
}

const isHourlyEnergyWindow = (window: HomeChartWindow): boolean =>
  windowDaysOf(window) <= MAX_HOURLY_ENERGY_DAYS

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
    (data) =>
      toHomeEnergyOptions({
        bucketUnit,
        locale: api.locale,
        sources: [{ name: 'Consumed', points: toAtaEnergySeries(data) }],
        window,
      }),
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
        locale: api.locale,
        sources: [
          { name: 'Consumed', points: toAtwEnergySeries(consumed, labelZone) },
          { name: 'Produced', points: toAtwEnergySeries(produced, labelZone) },
        ],
        window,
      }),
  )
}
