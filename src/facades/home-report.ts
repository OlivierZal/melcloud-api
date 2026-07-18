import type {
  HomeEnergyData,
  HomeReportAnnotation,
  HomeReportData,
  HomeReportPoint,
  Hour,
} from '../types/index.ts'
import { Intl, Temporal } from '../temporal.ts'
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
export type HomeChartGridUnit = 'day' | 'hour' | 'minute'

/**
 * Report window resolved to absolute instants in the display timezone.
 * @category Facades
 */
export interface HomeChartWindow {
  readonly from: Temporal.ZonedDateTime
  readonly to: Temporal.ZonedDateTime
}

/** Aggregation period passed to the Home report endpoints. */
export const HOME_REPORT_PERIOD = 'Hourly'

// The Home wire speaks UTC wall-clock on queries and samples alike
// (live-probed 2026-07-18: the freshest sample equals "now" in UTC).
const WIRE_TIME_ZONE = 'UTC'

// Hourly grids up to this span; daily grids beyond (169 points max).
const MAX_HOURLY_GRID_DAYS = 7

// Observed BFF retention is ~75-91 days: clamp open-ended queries so a
// Classic-style epoch default cannot produce a multi-year grid.
const MAX_REPORT_SPAN_DAYS = 92

const MILLISECONDS_PER_DAY = 86_400_000

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
  const isMultiDay =
    unit === 'hour' &&
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
// sample at or before it, `null` before the first sample.
const resampleSeries = (
  samples: readonly SamplePoint[],
  grid: readonly Temporal.ZonedDateTime[],
): (number | null)[] => {
  let index = 0
  let last: number | null = null
  return grid.map((slot) => {
    const limit = slot.epochMilliseconds
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
 * @param options.gridUnit - Grid resolution override (auto: hourly up
 * to seven days, daily beyond).
 * @param options.locale - BCP-47 locale tag for axis labels.
 * @param options.reports - Report payloads (one or more endpoints).
 * @param options.unit - Measurement unit label (e.g. `'°C'`).
 * @param options.window - Resolved chart window (in the display timezone).
 * @returns Structured line chart options.
 */
export const toHomeLineOptions = ({
  gridUnit,
  locale,
  reports,
  unit,
  window,
}: {
  reports: readonly HomeReportData[]
  unit: string
  window: HomeChartWindow
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
        data: resampleSeries(toSamplePoints(points), grid),
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

// Energy buckets are UTC calendar days on the wire: enumerate them by
// their literal date instead of shifting them into the display timezone.
const buildUtcDayGrid = (window: HomeChartWindow): string[] => {
  const last = window.to.withTimeZone(WIRE_TIME_ZONE).toPlainDate()
  const days: string[] = []
  for (
    let day = window.from.withTimeZone(WIRE_TIME_ZONE).toPlainDate();
    Temporal.PlainDate.compare(day, last) <= 0;
    day = day.add({ days: 1 })
  ) {
    days.push(day.toString())
  }
  return days
}

const sumEnergyByDay = (
  data: HomeEnergyData,
  scale: number,
): Map<string, number> => {
  const byDay = new Map<string, number>()
  const points = data.measureData.flatMap((measure) => measure.values)
  for (const point of points) {
    const day = parseWireDateTime(point.time).toPlainDate().toString()
    byDay.set(day, (byDay.get(day) ?? 0) + Number(point.value) * scale)
  }
  return byDay
}

/**
 * Rebuild sparse energy telemetry buckets into Classic-shaped line
 * chart options on a daily grid: one series per source, missing days
 * as `0` (the wire omits idle buckets entirely).
 * @param options - Conversion inputs.
 * @param options.locale - BCP-47 locale tag for axis labels.
 * @param options.sources - One entry per charted series.
 * @param options.window - Resolved chart window (in the display timezone).
 * @returns Structured line chart options (`kWh`).
 */
export const toHomeEnergyOptions = ({
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
  locale?: string | undefined
}): ReportChartLineOptions => {
  const days = buildUtcDayGrid(window)
  const formatter = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
  })
  return {
    from: window.from.toPlainDateTime().toString(),
    labels: days.map((day) => formatter.format(Temporal.PlainDate.from(day))),
    series: sources.map(({ data, name, scale }) => {
      const byDay = sumEnergyByDay(data, scale)
      return { data: days.map((day) => byDay.get(day) ?? 0), name }
    }),
    to: window.to.toPlainDateTime().toString(),
    unit: 'kWh',
  }
}

/**
 * Rebuild RSSI telemetry into Classic-shaped line chart options on a
 * minute grid over the requested hour.
 * @param options - Conversion inputs.
 * @param options.data - Telemetry payload (`rssi` samples).
 * @param options.locale - BCP-47 locale tag for axis labels.
 * @param options.name - Series name (the device display name, matching
 * the Classic signal legend).
 * @param options.window - Resolved one-hour window (in the display
 * timezone).
 * @returns Structured line chart options (`dBm`).
 */
export const toHomeSignalOptions = ({
  data,
  locale,
  name,
  window,
}: {
  data: HomeEnergyData
  name: string
  window: HomeChartWindow
  locale?: string | undefined
}): ReportChartLineOptions => {
  const samples = data.measureData
    .flatMap((measure) => measure.values)
    .map((point): SamplePoint => [
      toEpochMilliseconds(point.time),
      Number(point.value),
    ])
    .toSorted(([first], [second]) => first - second)
  const grid = buildGrid(window, 'minute')
  return {
    from: window.from.toPlainDateTime().toString(),
    labels: formatGridLabels({ grid, locale, unit: 'minute', window }),
    series: [{ data: resampleSeries(samples, grid), name }],
    to: window.to.toPlainDateTime().toString(),
    unit: 'dBm',
  }
}
