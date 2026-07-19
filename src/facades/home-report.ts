import { Intl, Temporal } from '../temporal.ts'
import {
  type HomeEnergyData,
  type HomeReportAnnotation,
  type HomeReportData,
  type HomeReportPoint,
  type Hour,
  type Result,
  ok,
} from '../types/index.ts'
import type {
  ReportChartBand,
  ReportChartLineOptions,
  ReportChartPieOptions,
  ReportQuery,
} from './report-types.ts'

/**
 * Time-grid resolution of a resampled Home chart. The Home report and
 * telemetry endpoints return irregular event-driven samples (each series
 * on its own time grid), so every chart is rebuilt on a regular grid.
 * @category Facades
 */
export type HomeChartGridUnit = 'day' | 'fiveMinutes' | 'hour' | 'minute'

/**
 * Report window resolved to absolute instants in the display timezone.
 * @category Facades
 */
export interface HomeChartWindow {
  readonly from: Temporal.ZonedDateTime
  readonly to: Temporal.ZonedDateTime
}

// Report annotations degrade with the requested window, not just the
// period: beyond ~30 days the BFF summarizes them (operation-mode
// durations collapse — live-probed 2026-07-19: a 90-day query reported
// LESS hot water than its own 30-day subwindow), and minute-grained
// payloads blow the client timeout past ~7 days. Facades therefore
// split wide windows into chunks and merge the reports.
export const MAX_REPORT_CHUNK_DAYS = 30

// Worse for the labeled mode annotations: at period `Weekly` the BFF
// truncates them to roughly the first two weeks of the window
// (live-probed 2026-07-19 via `scripts/probe-weekly-annotations.ts`:
// a 21-day Weekly query carried spans through day ~6 only, while the
// same window in 7-day Hourly chunks covered it fully). Annotation
// consumers (mode bands, operation-mode durations) therefore chunk at
// the Hourly-period span.
export const MAX_ANNOTATION_CHUNK_DAYS = 7

// Each 7-day Hourly comfort-graph call costs ~9 s at the BFF whatever
// the concurrency (probed 2026-07-19, `scripts/probe-report-load.ts`:
// wall 9.0-9.9 s for 3, 5 and 9 parallel chunks alike), so wide
// temperature windows outlive the widget's 10-second init budget.
// Mode bands stay where a single batch covers the window; wider
// temperature charts skip them and fetch fast Weekly samples instead.
export const MAX_BAND_WINDOW_DAYS = 21

const windowDaysOf = (window: HomeChartWindow): number =>
  window.from.until(window.to).total({ relativeTo: window.from, unit: 'days' })

/**
 * Whether a temperature-chart window is narrow enough to carry the
 * operation-mode bands (see {@link MAX_BAND_WINDOW_DAYS}).
 * @param window - Resolved chart window.
 * @returns `true` when the bands fit the load budget.
 */
export const shouldChartHomeBands = (window: HomeChartWindow): boolean =>
  windowDaysOf(window) <= MAX_BAND_WINDOW_DAYS

/**
 * Aggregation period for one report request: minute-grained `Hourly`
 * within the hourly-grid span, sampled `Weekly` beyond it (`Daily`
 * collapses the mode annotations — live-probed 2026-07-19).
 * @param window - Resolved chunk window.
 * @returns The period to request.
 */
export const toHomeReportPeriod = (window: HomeChartWindow): string =>
  windowDaysOf(window) > MAX_HOURLY_GRID_DAYS ? 'Weekly' : 'Hourly'

/**
 * Split a window into consecutive chunks of at most `chunkDays` days,
 * oldest first.
 * @param window - Resolved chart window.
 * @param chunkDays - Chunk span cap ({@link MAX_REPORT_CHUNK_DAYS} by
 * default; {@link MAX_ANNOTATION_CHUNK_DAYS} for annotation consumers).
 * @returns The chunk windows (at least one).
 */
export const splitHomeReportWindow = (
  window: HomeChartWindow,
  chunkDays: number = MAX_REPORT_CHUNK_DAYS,
): HomeChartWindow[] => {
  const chunks: HomeChartWindow[] = []
  let { from } = window
  while (Temporal.ZonedDateTime.compare(from, window.to) < 0) {
    const next = from.add({ days: chunkDays })
    const to =
      Temporal.ZonedDateTime.compare(next, window.to) > 0 ? window.to : next
    chunks.push({ from, to })
    from = to
  }
  return chunks.length > 0 ? chunks : [window]
}

const mergeChunkDatasets = (
  reports: readonly HomeReportData[],
): HomeReportData['datasets'] => {
  const pointsById = new Map<string, Map<string, HomeReportPoint>>()
  for (const report of reports) {
    for (const dataset of report.datasets) {
      const points =
        pointsById.get(dataset.id) ?? new Map<string, HomeReportPoint>()
      for (const point of dataset.data) {
        points.set(point.x, point)
      }
      pointsById.set(dataset.id, points)
    }
  }
  return pointsById
    .entries()
    .map(([id, points]) => ({
      data: points.values().toArray(),
      id,
      label: id,
    }))
    .toArray()
}

const mergeChunkAnnotations = (
  reports: readonly HomeReportData[],
): HomeReportAnnotation[] => {
  const annotations = new Map<string, HomeReportAnnotation>()
  for (const report of reports) {
    const spans = report.annotations ?? []
    for (const annotation of spans) {
      annotations.set(
        `${annotation.label ?? ''}|${annotation.xMin}|${annotation.xMax}`,
        annotation,
      )
    }
  }
  return annotations.values().toArray()
}

/**
 * Merge chunked report responses into a single report: samples
 * concatenated per dataset id (deduplicated by timestamp), annotations
 * deduplicated by identity (the BFF returns boundary-crossing spans in
 * both adjacent chunks — a naive merge would double-count them), LOCF
 * seeds from the oldest chunk.
 * @param chunks - Report payloads, oldest chunk first.
 * @returns A single-report array for the chart pipeline.
 */
export const mergeHomeReportChunks = (
  chunks: readonly (readonly HomeReportData[])[],
): HomeReportData[] => {
  const reports = chunks.flat()
  const [first] = reports
  if (first === undefined || reports.length === 1) {
    return [...reports]
  }
  return [
    {
      ...first,
      annotations: mergeChunkAnnotations(reports),
      datasets: mergeChunkDatasets(reports),
    },
  ]
}

// A year at the 7-day annotation cap is 53 requests — too many for
// one parallel burst — but batches must stay wide: the BFF absorbs at
// least 10 parallel report calls with no wall-clock penalty (probed
// 2026-07-19, `scripts/probe-report-load.ts`) while every extra batch
// costs ~9 s. Batches run this many chunks at a time; the recursive
// shape (over a loop) keeps the batch sequencing loop-free, and a
// failed batch short-circuits the remainder.
const MAX_PARALLEL_CHUNKS = 16

const fetchChunkBatches = async (
  fetch: (chunk: HomeChartWindow) => Promise<Result<HomeReportData[]>>,
  chunks: readonly HomeChartWindow[],
): Promise<Result<HomeReportData[]>[]> => {
  if (chunks.length === 0) {
    return []
  }
  const batch = await Promise.all(
    chunks.slice(0, MAX_PARALLEL_CHUNKS).map(async (chunk) => fetch(chunk)),
  )
  if (batch.some((result) => !result.ok)) {
    return batch
  }
  return [
    ...batch,
    ...(await fetchChunkBatches(fetch, chunks.slice(MAX_PARALLEL_CHUNKS))),
  ]
}

/**
 * Fetch a report over the window in chunks of at most `chunkDays`
 * days, batched in parallel, and merge the responses: wide single
 * requests time out (minute-grained payloads) or come back with
 * summarized annotations (collapsed mode durations).
 * @param fetch - One report request (endpoint bound by the caller).
 * @param window - Resolved chart window.
 * @param chunkDays - Chunk span cap ({@link MAX_REPORT_CHUNK_DAYS} by
 * default; {@link MAX_ANNOTATION_CHUNK_DAYS} keeps every chunk on the
 * `Hourly` period, whose annotations are faithful).
 * @returns The merged report, or the first chunk failure.
 */
export const fetchHomeReportChunks = async (
  fetch: (params: {
    from: string
    period: string
    to: string
  }) => Promise<Result<HomeReportData[]>>,
  window: HomeChartWindow,
  chunkDays?: number,
): Promise<Result<HomeReportData[]>> => {
  const results = await fetchChunkBatches(
    async (chunk) =>
      fetch({ ...toHomeWireWindow(chunk), period: toHomeReportPeriod(chunk) }),
    splitHomeReportWindow(window, chunkDays),
  )
  const values: HomeReportData[][] = []
  for (const result of results) {
    if (!result.ok) {
      return result
    }
    values.push([...result.value])
  }
  return ok(mergeHomeReportChunks(values))
}

// The Home wire speaks UTC wall-clock on queries and samples alike
// (live-probed 2026-07-18: the freshest sample equals "now" in UTC).
const WIRE_TIME_ZONE = 'UTC'

// Hourly grids up to this span; daily grids beyond (169 points max).
const MAX_HOURLY_GRID_DAYS = 7

// Observed BFF retention is ~75-91 days: clamp open-ended queries so a
// Classic-style epoch default cannot produce a multi-year grid.
const MAX_REPORT_SPAN_DAYS = 92

const MILLISECONDS_PER_DAY = 86_400_000

// A "one day" query resolves a hair over 1.0 days (the caller stamps
// `from` a few milliseconds before the library stamps `to`), so the
// hourly-bucket cutoff sits halfway to the next whole-day option.
const MAX_HOURLY_ENERGY_DAYS = 1.5

// Up to a month, energy day buckets aggregate hourly wire buckets per
// calendar day of the display timezone; beyond, the wire's UTC day
// buckets are charted as-is.
const MAX_LOCAL_DAY_ENERGY_DAYS = 31

const MODE_OVERLAY_PREFIX = 'REPORT.COMFORT_GRAPH.OVERLAY_KEY.'

// Comfort-graph overlay keys mapped onto the Classic operation-mode
// vocabulary (`getOperationModes` pie labels). Unknown future keys fall
// back to a generic SNAKE_CASE → PascalCase conversion.
const overlayModeNames: Record<string, string> = {
  COOLING: 'Cooling',
  FREEZE_STAT: 'FreezeStat',
  HEATING: 'Heating',
  HOT_WATER: 'HotWater',
  LEGIONELLA: 'LegionellaPrevention',
}

// Unannotated time in the Classic pie vocabulary; Home cannot separate
// `Stop` from `PowerOff`, so the whole idle remainder maps to `Stop`.
const IDLE_MODE_NAME = 'Stop'

// Classic wire pie order (minus the underivable `PowerOff`) — display
// order, not sorted.
const pieModeOrder: readonly string[] = [
  IDLE_MODE_NAME,
  'HotWater',
  'Heating',
  'Cooling',
  'FreezeStat',
  'LegionellaPrevention',
]

const knownPieModes = new Set(pieModeOrder)

// Dataset ids mapped onto the Classic legend vocabulary where the
// generic snake_case → PascalCase conversion does not match.
const seriesNameOverrides: Record<string, string> = {
  outside_temperature: 'OutdoorTemperature',
}

const durationByUnit: Record<HomeChartGridUnit, Temporal.DurationLike> = {
  day: { days: 1 },
  fiveMinutes: { minutes: 5 },
  hour: { hours: 1 },
  minute: { minutes: 1 },
}

const capitalize = (part: string): string =>
  `${part.charAt(0).toUpperCase()}${part.slice(1)}`

/**
 * Map a Home dataset id onto the Classic series vocabulary
 * (`room_temperature` → `RoomTemperature`, `outside_temperature` →
 * `OutdoorTemperature`, ...).
 * @param id - Home dataset id in snake_case.
 * @returns The Classic-style PascalCase series name.
 */
export const toHomeSeriesName = (id: string): string =>
  seriesNameOverrides[id] ??
  id
    .split('_')
    .map((part) => capitalize(part))
    .join('')

// Wire samples use either `T` or a space separator, with up to nine
// fractional-second digits; both parse as plain wall-clock datetimes.
const parseWireDateTime = (value: string): Temporal.PlainDateTime =>
  Temporal.PlainDateTime.from(value.replace(' ', 'T'))

const toEpochMilliseconds = (value: string): number =>
  parseWireDateTime(value).toZonedDateTime(WIRE_TIME_ZONE).epochMilliseconds

// Query dates carrying an offset (`Z`, `+02:00`) pin an absolute
// instant; zoneless dates are wall-clock in the display timezone —
// matching how callers already feed Classic-style local datetimes.
const parseQueryDate = (
  iso: string,
  timezone: string,
): Temporal.ZonedDateTime => {
  try {
    return Temporal.Instant.from(iso).toZonedDateTimeISO(timezone)
  } catch {
    return Temporal.PlainDateTime.from(iso).toZonedDateTime(timezone)
  }
}

/**
 * Resolve a Classic-style report query into an absolute window in the
 * display timezone, clamped to the observed BFF retention span.
 * @param query - Optional ISO date range (zoneless dates are wall-clock
 * in `timezone`).
 * @param timezone - IANA display timezone (UTC when unset).
 * @returns The resolved window.
 */
export const resolveHomeReportWindow = (
  query: ReportQuery | undefined,
  timezone: string,
): HomeChartWindow => {
  const to =
    query?.to === undefined ?
      Temporal.Now.zonedDateTimeISO(timezone)
    : parseQueryDate(query.to, timezone)
  const earliest = to.subtract({ days: MAX_REPORT_SPAN_DAYS })
  const from =
    query?.from === undefined ? earliest : parseQueryDate(query.from, timezone)
  return {
    from: Temporal.ZonedDateTime.compare(from, earliest) < 0 ? earliest : from,
    to,
  }
}

/**
 * Resolve the one-hour window of `hour` today in the display timezone
 * (the current hour when omitted) — the Home counterpart of the Classic
 * `getSignalStrength`/`getHourlyTemperatures` hour contract.
 * @param hour - Hour of today (0-23); defaults to the current hour.
 * @param timezone - IANA display timezone (UTC when unset).
 * @returns The resolved one-hour window.
 */
export const resolveHomeHourWindow = (
  hour: Hour | undefined,
  timezone: string,
): HomeChartWindow => {
  const now = Temporal.Now.zonedDateTimeISO(timezone)
  const from = now.with({
    hour: hour ?? now.hour,
    microsecond: 0,
    millisecond: 0,
    minute: 0,
    nanosecond: 0,
    second: 0,
  })
  return { from, to: from.add({ hours: 1 }) }
}

/** Display bucket granularity of the Home energy charts. */
export type HomeEnergyBucketUnit = 'day' | 'hour' | 'localDay'

/**
 * Display bucket granularity for an energy-report window: hourly on a
 * one-day span — matching the Classic one-day report — calendar days
 * of the display timezone up to a month (aggregated from hourly wire
 * buckets: the wire's own day buckets are UTC days, which smear
 * evening usage onto the next bar in UTC+ zones), raw UTC wire days
 * beyond (an hourly pull over a year is unproven and the shift is
 * invisible at that zoom).
 * @param window - Resolved chart window.
 * @returns The display bucket unit.
 */
export const toHomeEnergyBucketUnit = (
  window: HomeChartWindow,
): HomeEnergyBucketUnit => {
  const days = windowDaysOf(window)
  if (days <= MAX_HOURLY_ENERGY_DAYS) {
    return 'hour'
  }
  return days <= MAX_LOCAL_DAY_ENERGY_DAYS ? 'localDay' : 'day'
}

/**
 * Resolve today's full-day window in the display timezone — what the
 * "today" charts (fine temperatures, signal) cover — plus the "now"
 * cutoff after which their grids stay blank.
 * @param timezone - IANA display timezone (UTC when unset).
 * @returns The full-day window and the cutoff.
 */
export const resolveHomeDayWindow = (
  timezone: string,
): { cutoff: Temporal.ZonedDateTime; window: HomeChartWindow } => {
  const now = Temporal.Now.zonedDateTimeISO(timezone)
  const from = now.startOfDay()
  // The window spans the whole day so the axis always reads 00:00-24:00;
  // the cutoff marks "now" — slots beyond it chart as gaps, not LOCF.
  return { cutoff: now, window: { from, to: from.add({ days: 1 }) } }
}

/**
 * Serialize a window into the ISO instant pair consumed by the raw
 * report/telemetry endpoints.
 * @param window - Resolved chart window.
 * @returns Instant strings for the wire query.
 */
export const toHomeWireWindow = (
  window: HomeChartWindow,
): { from: string; to: string } => ({
  from: window.from.toInstant().toString(),
  to: window.to.toInstant().toString(),
})

const chooseGridUnit = (window: HomeChartWindow): HomeChartGridUnit =>
  (
    window.from
      .until(window.to)
      .total({ relativeTo: window.from, unit: 'days' }) > MAX_HOURLY_GRID_DAYS
  ) ?
    'day'
  : 'hour'

const buildGrid = (
  window: HomeChartWindow,
  unit: HomeChartGridUnit,
): Temporal.ZonedDateTime[] => {
  const step = durationByUnit[unit]
  const points: Temporal.ZonedDateTime[] = []
  for (
    let point = window.from;
    Temporal.ZonedDateTime.compare(point, window.to) <= 0;
    point = point.add(step)
  ) {
    points.push(point)
  }
  return points
}

// The polyfill's `Intl` types do not re-export `DateTimeFormatOptions`;
// derive the options shape from the constructor instead.
type DateTimeFormatOptions = ConstructorParameters<
  typeof Intl.DateTimeFormat
>[1]

const gridLabelOptions = (
  unit: HomeChartGridUnit,
  window: HomeChartWindow,
): DateTimeFormatOptions => {
  if (unit === 'day') {
    return { day: 'numeric', month: 'short' }
  }
  if (unit === 'fiveMinutes' || unit === 'minute') {
    return { hour: '2-digit', minute: '2-digit' }
  }
  // Only the hourly unit reaches this point.
  const isMultiDay =
    window.from.until(window.to).total({
      relativeTo: window.from,
      unit: 'days',
    }) > 1
  return isMultiDay ?
      { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short' }
    : { hour: '2-digit', minute: '2-digit' }
}

const formatGridLabels = ({
  grid,
  locale,
  unit,
  window,
}: {
  grid: readonly Temporal.ZonedDateTime[]
  locale: string | undefined
  unit: HomeChartGridUnit
  window: HomeChartWindow
}): string[] => {
  const formatter = new Intl.DateTimeFormat(
    locale,
    gridLabelOptions(unit, window),
  )
  return grid.map((point) => formatter.format(point.toPlainDateTime()))
}

type SamplePoint = readonly [epochMilliseconds: number, value: number]

const toSamplePoints = (points: readonly HomeReportPoint[]): SamplePoint[] =>
  points
    .map((point): SamplePoint => [toEpochMilliseconds(point.x), point.y])
    .toSorted(([first], [second]) => first - second)

// Last-observation-carried-forward: each grid slot takes the freshest
// sample at or before it, `null` before the first sample and past the
// cutoff (the not-yet-elapsed remainder of a full-day grid).
const resampleSeries = (
  samples: readonly SamplePoint[],
  grid: readonly Temporal.ZonedDateTime[],
  cutoffMilliseconds = Infinity,
): (number | null)[] => {
  let index = 0
  let last: number | null = null
  return grid.map((slot) => {
    const limit = slot.epochMilliseconds
    if (limit > cutoffMilliseconds) {
      return null
    }
    for (; index < samples.length; index += 1) {
      const sample = samples[index]
      if (sample === undefined || sample[0] > limit) {
        break
      }
      last = sample[1]
    }
    return last
  })
}

// The wire's LOCF seeds: the last pre-window sample per series (`value`
// `null` with a far-future sentinel when a series has no history).
const mergeTriggerSeeds = (
  reports: readonly HomeReportData[],
): Map<string, HomeReportPoint> => {
  const seeds = new Map<string, HomeReportPoint>()
  for (const report of reports) {
    const triggers = report.previousTriggers ?? []
    for (const { measure, trigger, value } of triggers) {
      if (value !== null && !seeds.has(measure)) {
        /* eslint-disable id-length -- match the wire point shape */
        seeds.set(measure, { x: trigger, y: value })
        /* eslint-enable id-length */
      }
    }
  }
  return seeds
}

// First non-empty report wins per dataset id: the ATW temperatures
// union fetches comfort-graph before internal-temperatures and the tank
// series exist in both with identical samples — but either copy can be
// empty over a short window, so an empty first copy must not shadow a
// populated second one. Each series is seeded with its pre-window
// trigger sample so sparse setpoint series do not start the window
// blank (matching the Home UI).
const mergeDatasets = (
  reports: readonly HomeReportData[],
): { id: string; points: HomeReportPoint[] }[] => {
  const merged = new Map<string, HomeReportPoint[]>()
  for (const report of reports) {
    for (const dataset of report.datasets) {
      if ((merged.get(dataset.id)?.length ?? 0) === 0) {
        merged.set(dataset.id, dataset.data)
      }
    }
  }
  const seeds = mergeTriggerSeeds(reports)
  return [...merged].map(([id, points]) => {
    const seed = seeds.get(id)
    return { id, points: seed === undefined ? points : [seed, ...points] }
  })
}

const hasModeLabel = (
  annotation: HomeReportAnnotation,
): annotation is HomeReportAnnotation & { label: string } =>
  annotation.label?.startsWith(MODE_OVERLAY_PREFIX) === true

const toModeName = (label: string): string => {
  const key = label.slice(MODE_OVERLAY_PREFIX.length)
  return overlayModeNames[key] ?? toHomeSeriesName(key.toLowerCase())
}

// Index of the grid bucket containing the timestamp: the last slot at
// or before it, clamped into the grid.
const floorGridIndex = (
  grid: readonly Temporal.ZonedDateTime[],
  epochMilliseconds: number,
): number => {
  let index = 0
  for (const [slot, point] of grid.entries()) {
    if (point.epochMilliseconds > epochMilliseconds) {
      break
    }
    index = slot
  }
  return index
}

const toBands = (
  reports: readonly HomeReportData[],
  grid: readonly Temporal.ZonedDateTime[],
  window: HomeChartWindow,
): ReportChartBand[] => {
  const fromMs = window.from.epochMilliseconds
  const toMs = window.to.epochMilliseconds
  return reports
    .flatMap((report) => report.annotations ?? [])
    .filter(hasModeLabel)
    .flatMap((annotation) => {
      const min = toEpochMilliseconds(annotation.xMin)
      const max = toEpochMilliseconds(annotation.xMax)
      if (max < fromMs || min > toMs) {
        return []
      }
      return [
        {
          from: floorGridIndex(grid, Math.max(min, fromMs)),
          label: toModeName(annotation.label),
          to: floorGridIndex(grid, Math.min(max, toMs)),
        },
      ]
    })
}

/**
 * Rebuild Home report datasets into Classic-shaped line chart options:
 * regular grid, LOCF-resampled series under Classic legend names, and
 * operation-mode background bands from the comfort-graph annotations.
 * @param options - Conversion inputs.
 * @param options.cutoff - Instant after which grid slots stay blank
 * (the not-yet-elapsed remainder of a full-day window).
 * @param options.gridUnit - Grid resolution override (auto: hourly up
 * to seven days, daily beyond).
 * @param options.locale - BCP-47 locale tag for axis labels.
 * @param options.reports - Report payloads (one or more endpoints).
 * @param options.unit - Measurement unit label (e.g. `'°C'`).
 * @param options.window - Resolved chart window (in the display timezone).
 * @returns Structured line chart options.
 */
export const toHomeLineOptions = ({
  cutoff,
  gridUnit,
  locale,
  reports,
  unit,
  window,
}: {
  reports: readonly HomeReportData[]
  unit: string
  window: HomeChartWindow
  cutoff?: Temporal.ZonedDateTime | undefined
  gridUnit?: HomeChartGridUnit | undefined
  locale?: string | undefined
}): ReportChartLineOptions => {
  const resolvedUnit = gridUnit ?? chooseGridUnit(window)
  const grid = buildGrid(window, resolvedUnit)
  const bands = toBands(reports, grid, window)
  return {
    ...(bands.length > 0 && { bands }),
    from: window.from.toPlainDateTime().toString(),
    labels: formatGridLabels({ grid, locale, unit: resolvedUnit, window }),
    series: mergeDatasets(reports)
      .filter(({ points }) => points.length > 0)
      .map(({ id, points }) => ({
        data: resampleSeries(
          toSamplePoints(points),
          grid,
          cutoff?.epochMilliseconds,
        ),
        name: toHomeSeriesName(id),
      })),
    to: window.to.toPlainDateTime().toString(),
    unit,
  }
}

// Sum the labelled annotation spans per mode, clipped to the window,
// in fractional days.
const sumModeDurations = (
  reports: readonly HomeReportData[],
  window: HomeChartWindow,
): Map<string, number> => {
  const durations = new Map<string, number>()
  const modeAnnotations = reports
    .flatMap((report) => report.annotations ?? [])
    .filter(hasModeLabel)
  for (const annotation of modeAnnotations) {
    const min = Math.max(
      toEpochMilliseconds(annotation.xMin),
      window.from.epochMilliseconds,
    )
    const max = Math.min(
      toEpochMilliseconds(annotation.xMax),
      window.to.epochMilliseconds,
    )
    if (max > min) {
      const mode = toModeName(annotation.label)
      durations.set(
        mode,
        (durations.get(mode) ?? 0) + (max - min) / MILLISECONDS_PER_DAY,
      )
    }
  }
  return durations
}

/**
 * Aggregate the comfort-graph operation-mode annotations into
 * Classic-shaped pie chart options: one slice per mode, values in
 * fractional days over the window, idle remainder as `Stop`.
 * @param reports - Comfort-graph payloads.
 * @param window - Resolved chart window.
 * @returns Structured pie chart options.
 */
export const toHomeOperationModeOptions = (
  reports: readonly HomeReportData[],
  window: HomeChartWindow,
): ReportChartPieOptions => {
  const durations = sumModeDurations(reports, window)
  const windowDays =
    (window.to.epochMilliseconds - window.from.epochMilliseconds) /
    MILLISECONDS_PER_DAY
  const active = durations.values().reduce((sum, value) => sum + value, 0)
  durations.set(IDLE_MODE_NAME, Math.max(0, windowDays - active))
  const labels = [
    ...pieModeOrder,
    ...durations.keys().filter((mode) => !knownPieModes.has(mode)),
  ]
  return {
    from: window.from.toPlainDateTime().toString(),
    labels,
    series: labels.map((mode) => durations.get(mode) ?? 0),
    to: window.to.toPlainDateTime().toString(),
  }
}

// Energy buckets are UTC calendar days (or hours) on the wire:
// enumerate them by their literal timestamps instead of shifting them
// into the display timezone.
const buildUtcDayGrid = (window: HomeChartWindow): string[] => {
  const last = window.to.withTimeZone(WIRE_TIME_ZONE).toPlainDate()
  const days: string[] = []
  for (
    let day = window.from.withTimeZone(WIRE_TIME_ZONE).toPlainDate();
    Temporal.PlainDate.compare(day, last) <= 0;
    day = day.add({ days: 1 })
  ) {
    days.push(day.toPlainDateTime().toString())
  }
  return days
}

// Local-day buckets enumerate the calendar days of the display
// timezone the window spans (its bounds already live in that zone).
const buildLocalDayGrid = (window: HomeChartWindow): string[] => {
  const last = window.to.toPlainDate()
  const days: string[] = []
  for (
    let day = window.from.toPlainDate();
    Temporal.PlainDate.compare(day, last) <= 0;
    day = day.add({ days: 1 })
  ) {
    days.push(day.toString())
  }
  return days
}

const toWireHour = (bound: Temporal.ZonedDateTime): Temporal.PlainDateTime =>
  bound
    .withTimeZone(WIRE_TIME_ZONE)
    .toPlainDateTime()
    .round({ roundingMode: 'floor', smallestUnit: 'hour' })

const buildUtcHourGrid = (window: HomeChartWindow): string[] => {
  const last = toWireHour(window.to)
  const hours: string[] = []
  for (
    let hour = toWireHour(window.from);
    Temporal.PlainDateTime.compare(hour, last) <= 0;
    hour = hour.add({ hours: 1 })
  ) {
    hours.push(hour.toString())
  }
  return hours
}

// Slot key of one wire bucket timestamp (UTC wall-clock): the floored
// hour, the local calendar day in the display timezone, or the UTC
// calendar day — matching the grid the unit builds.
const toEnergySlotKey = (
  time: Temporal.PlainDateTime,
  bucketUnit: HomeEnergyBucketUnit,
  timezone: string,
): string => {
  if (bucketUnit === 'hour') {
    return time
      .round({ roundingMode: 'floor', smallestUnit: 'hour' })
      .toString()
  }
  if (bucketUnit === 'localDay') {
    return time
      .toZonedDateTime(WIRE_TIME_ZONE)
      .withTimeZone(timezone)
      .toPlainDate()
      .toString()
  }
  return time.toPlainDate().toPlainDateTime().toString()
}

const sumEnergyBySlot = (
  data: HomeEnergyData,
  {
    bucketUnit,
    scale,
    timezone,
  }: { bucketUnit: HomeEnergyBucketUnit; scale: number; timezone: string },
): Map<string, number> => {
  const bySlot = new Map<string, number>()
  const points = data.measureData.flatMap((measure) => measure.values)
  for (const point of points) {
    const slot = toEnergySlotKey(
      parseWireDateTime(point.time),
      bucketUnit,
      timezone,
    )
    bySlot.set(slot, (bySlot.get(slot) ?? 0) + Number(point.value) * scale)
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
      .toZonedDateTime(WIRE_TIME_ZONE)
      .withTimeZone(timezone)
      .toPlainDateTime()
  }
  return (
    bucketUnit === 'localDay' ?
      Temporal.PlainDate
    : Temporal.PlainDateTime).from(slot)
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
 * Rebuild sparse energy telemetry buckets into Classic-shaped line
 * chart options on a daily grid: one series per source, missing days
 * as `0` (the wire omits idle buckets entirely).
 * @param options - Conversion inputs.
 * @param options.bucketUnit - Display bucket granularity (UTC days by
 * default; `localDay` sums hourly wire buckets per calendar day of the
 * display timezone; `hour` matches the Classic one-day report).
 * @param options.locale - BCP-47 locale tag for axis labels.
 * @param options.sources - One entry per charted series.
 * @param options.window - Resolved chart window (in the display timezone).
 * @returns Structured line chart options (`kWh`).
 */
export const toHomeEnergyOptions = ({
  bucketUnit = 'day',
  locale,
  sources,
  window,
}: {
  sources: readonly {
    readonly data: HomeEnergyData
    readonly name: string
    readonly scale: number
  }[]
  window: HomeChartWindow
  bucketUnit?: HomeEnergyBucketUnit | undefined
  locale?: string | undefined
}): ReportChartLineOptions => {
  const timezone = window.from.timeZoneId
  const slots = energyGridBuilders[bucketUnit](window)
  const formatter = new Intl.DateTimeFormat(
    locale,
    bucketUnit === 'hour' ?
      { hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'short' },
  )
  return {
    from: window.from.toPlainDateTime().toString(),
    labels: slots.map((slot) =>
      formatter.format(toEnergySlotLabel(slot, bucketUnit, timezone)),
    ),
    series: sources.map(({ data, name, scale }) => {
      const bySlot = sumEnergyBySlot(data, { bucketUnit, scale, timezone })
      return { data: slots.map((slot) => bySlot.get(slot) ?? 0), name }
    }),
    to: window.to.toPlainDateTime().toString(),
    unit: 'kWh',
  }
}

/**
 * Rebuild RSSI telemetry into Classic-shaped line chart options on a
 * minute grid over the requested hour.
 * @param options - Conversion inputs.
 * @param options.cutoff - Instant after which grid slots stay blank
 * (the not-yet-elapsed remainder of a full-day window).
 * @param options.data - Telemetry payload (`rssi` samples).
 * @param options.gridUnit - Grid resolution (minute by default).
 * @param options.locale - BCP-47 locale tag for axis labels.
 * @param options.name - Series name (the device display name, matching
 * the Classic signal legend).
 * @param options.window - Resolved window (in the display timezone).
 * @returns Structured line chart options (`dBm`).
 */
export const toHomeSignalOptions = ({
  cutoff,
  data,
  gridUnit = 'minute',
  locale,
  name,
  window,
}: {
  data: HomeEnergyData
  name: string
  window: HomeChartWindow
  cutoff?: Temporal.ZonedDateTime | undefined
  gridUnit?: HomeChartGridUnit | undefined
  locale?: string | undefined
}): ReportChartLineOptions => {
  const samples = data.measureData
    .flatMap((measure) => measure.values)
    .map((point): SamplePoint => [
      toEpochMilliseconds(point.time),
      Number(point.value),
    ])
    .toSorted(([first], [second]) => first - second)
  const grid = buildGrid(window, gridUnit)
  return {
    from: window.from.toPlainDateTime().toString(),
    labels: formatGridLabels({ grid, locale, unit: gridUnit, window }),
    series: [
      { data: resampleSeries(samples, grid, cutoff?.epochMilliseconds), name },
    ],
    to: window.to.toPlainDateTime().toString(),
    unit: 'dBm',
  }
}
