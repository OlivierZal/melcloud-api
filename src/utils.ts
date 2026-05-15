import type {
  ReportChartLineOptions,
  ReportChartPieOptions,
  ReportQuery,
} from './facades/index.ts'
import type {
  ClassicOperationModeLogData,
  ClassicReportData,
  ClassicSetDeviceDataAtaInList,
  ClassicUpdateDeviceData,
  KeyOfClassicSetDeviceDataAtaNotInList,
} from './types/index.ts'
import { type ClassicDeviceType, ClassicLabelType } from './constants.ts'
import { Temporal } from './temporal.ts'

// API encodes year-month as YYYYMM integer (e.g., 202306 for June 2023)
const YEAR_MONTH_DIVISOR = 100

// 2024-01-01 was a Monday (ISO weekday 1), so UTC day N of Jan 2024 maps cleanly to weekday N.
const DAY_OF_WEEK_BASE_YEAR = 2024
const MONTH_NAME_BASE_YEAR = 2024

interface LabelFormatterCache {
  readonly dayOfWeek: Intl.DateTimeFormat
  readonly month: Intl.DateTimeFormat
}

// Per-locale `Intl.DateTimeFormat` cache. Keyed on the locale string
// (or `''` for the runtime default) so repeat calls with the same
// locale reuse the same formatter pair without re-allocating on each
// chart-options call. Modern best practice: the locale is carried as
// an explicit argument by each call site, never via a mutable global.
const formatterCacheByLocale = new Map<string, LabelFormatterCache>()

const getLabelFormatters = (
  locale: string | undefined,
): LabelFormatterCache => {
  const key = locale ?? ''
  const cached = formatterCacheByLocale.get(key)
  if (cached !== undefined) {
    return cached
  }
  const cache: LabelFormatterCache = {
    dayOfWeek: new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC',
      weekday: 'short',
    }),
    month: new Intl.DateTimeFormat(locale, {
      month: 'short',
      timeZone: 'UTC',
    }),
  }
  formatterCacheByLocale.set(key, cache)
  return cache
}

/**
 * Clamp a numeric value into the inclusive `[min, max]` range.
 *
 * Shared by every device facade (Classic ATA, Classic ATW, Home ATA)
 * that enforces target-temperature limits before sending updates to
 * their respective upstream APIs.
 * @param value - The value to clamp.
 * @param range - Inclusive bounds.
 * @param range.max - Upper bound (inclusive).
 * @param range.min - Lower bound (inclusive).
 * @returns `value`, clamped to `[range.min, range.max]`.
 */
export const clampToRange = (
  value: number,
  range: { max: number; min: number },
): number => Math.min(Math.max(value, range.min), range.max)

/**
 * Get the current date/time as an ISO 8601 string without timezone offset.
 *
 * When a timezone is supplied, the wall-clock time is taken in that
 * zone; otherwise the runtime's system zone is used. The returned
 * string is the local `PlainDateTime` ISO form (no `Z`, no `+HH:MM`).
 * @param timeZone - IANA timezone identifier, or omitted for system zone.
 * @returns The current date/time as an ISO string.
 */
export const now = (timeZone?: string): string =>
  Temporal.Now.plainDateTimeISO(timeZone).toString({
    smallestUnit: 'millisecond',
  })

/**
 * Factory for a type guard that narrows a key to the own keys of `record`.
 * Uses `Object.hasOwn` so prototype-chain pollution cannot produce false positives.
 * @param record - The record whose keys the returned guard recognises.
 * @returns A type guard checking own-key membership on `record`.
 */
export const isKeyOf =
  <T extends object>(record: T) =>
  (key: PropertyKey): key is keyof T =>
    Object.hasOwn(record, key)

/** Maps ATA set-command keys to their corresponding list-data keys. */
export const fromSetToListAta: {
  readonly SetFanSpeed: 'FanSpeed'
  readonly VaneHorizontal: 'VaneHorizontalDirection'
  readonly VaneVertical: 'VaneVerticalDirection'
} = {
  SetFanSpeed: 'FanSpeed',
  VaneHorizontal: 'VaneHorizontalDirection',
  VaneVertical: 'VaneVerticalDirection',
} as const satisfies Record<
  KeyOfClassicSetDeviceDataAtaNotInList,
  keyof ClassicSetDeviceDataAtaInList
>

/**
 * Type guard for ATA set-command keys that differ from list-data keys.
 * @param value - The key to check.
 * @returns Whether the key is a set-command key not present in list data.
 */
export const isSetDeviceDataAtaNotInList: (
  key: PropertyKey,
) => key is KeyOfClassicSetDeviceDataAtaNotInList = isKeyOf(fromSetToListAta)

/** Maps ATA list-data keys to their corresponding set-command keys. */
export const fromListToSetAta: {
  readonly FanSpeed: 'SetFanSpeed'
  readonly VaneHorizontalDirection: 'VaneHorizontal'
  readonly VaneVerticalDirection: 'VaneVertical'
} = {
  FanSpeed: 'SetFanSpeed',
  VaneHorizontalDirection: 'VaneHorizontal',
  VaneVerticalDirection: 'VaneVertical',
} as const satisfies Record<
  keyof ClassicSetDeviceDataAtaInList,
  KeyOfClassicSetDeviceDataAtaNotInList
>

/**
 * Type guard for ATA list-data keys that map to different set-command keys.
 * @param value - The key to check.
 * @returns Whether the key is a list-data key with a different set-command key.
 */
export const isSetDeviceDataAtaInList: (
  key: PropertyKey,
) => key is keyof ClassicSetDeviceDataAtaInList = isKeyOf(fromListToSetAta)

// Strategy map: transform raw API label formats into human-readable strings
// based on report granularity (day of week, month name, year-month, etc.)
// The closure receives the resolved per-call locale so repeat calls with
// different locales stay isolated and the cache stays consistent.
const buildLabelFormatters = (
  locale: string | undefined,
): Record<ClassicLabelType, (label: string) => string> => {
  const formatters = getLabelFormatters(locale)
  return {
    [ClassicLabelType.day_of_week]: (label) =>
      formatters.dayOfWeek.format(
        Date.UTC(DAY_OF_WEEK_BASE_YEAR, 0, Number(label)),
      ),
    [ClassicLabelType.month]: (label) =>
      formatters.month.format(
        Date.UTC(MONTH_NAME_BASE_YEAR, Number(label) - 1, 1),
      ),
    [ClassicLabelType.month_of_year]: (label): string => {
      const year = Math.floor(Number(label) / YEAR_MONTH_DIVISOR)
      const month = (Number(label) % YEAR_MONTH_DIVISOR) - 1

      // Format month and year separately to preserve the "MMM yyyy" ordering
      // across locales; `Intl.DateTimeFormat` with both fields reorders (e.g. ja → "yyyy年M月").
      const monthName = formatters.month.format(Date.UTC(year, month, 1))
      return `${monthName} ${String(year)}`
    },
    [ClassicLabelType.raw]: (label) => label,
    [ClassicLabelType.time]: (label) => label,
  }
}

const formatLabels = (
  labels: readonly string[],
  labelType: ClassicLabelType,
  locale: string | undefined,
): string[] => {
  const formatters = buildLabelFormatters(locale)
  return labels.map((label) => formatters[labelType](label))
}

/**
 * Type-safe `Object.keys` that preserves the key type of the input object.
 * @param object - The object to extract keys from.
 * @returns The object's keys with their type preserved.
 */
export const typedKeys = <T extends Record<string, unknown>>(
  object: T,
): (string & keyof T)[] => Object.keys(object)

/**
 * Type-safe `Object.fromEntries` that returns a properly typed object.
 * @param entries - The key-value pairs to convert into an object.
 * @returns The constructed object.
 */
export function typedFromEntries<T extends Record<string, unknown>>(
  entries: Iterable<readonly [PropertyKey, T[keyof T]]>,
): T
export function typedFromEntries(
  entries: Iterable<readonly [PropertyKey, unknown]>,
): Record<string, unknown> {
  return Object.fromEntries(entries)
}

/**
 * Type guard checking whether a key belongs to the updatable device data fields.
 * @param data - The update data record to check against.
 * @param key - The key to verify.
 * @returns Whether the key is a valid updatable field.
 */
export const isUpdateDeviceData = <T extends ClassicDeviceType>(
  data: Record<keyof ClassicUpdateDeviceData<T>, unknown>,
  key: string,
): key is string & keyof ClassicUpdateDeviceData<T> => Object.hasOwn(data, key)

const getChartLineSeries = ({
  data,
  legend,
}: {
  data: readonly (readonly (number | null)[])[]
  legend: readonly (string | undefined)[]
}): { data: (number | null)[]; name: string }[] =>
  data
    .map((values, index) => ({
      // Copy so the returned mutable `data` does not alias the readonly
      // source; the public `ReportChartLineOptions.series[].data` is
      // typed as a mutable array and consumers may mutate in place.
      data: [...values],
      name: legend[index],
    }))
    .filter(
      (item): item is { data: (number | null)[]; name: string } =>
        item.name !== undefined,
    )

/**
 * Options for {@link getChartLineOptions}. Carried as an object so
 * `locale` stays an explicit, named, per-call argument (no global
 * mutable locale state).
 */
export interface ChartLineFormatOptions {
  /** Legend entries for each data series. */
  readonly legend: readonly (string | undefined)[]
  /** Unit of measurement for the data. */
  readonly unit: string
  /**
   * BCP-47 locale tag for day-of-week and month-name labels. Defaults
   * to the runtime locale when omitted.
   */
  readonly locale?: string
}

/**
 * Transform raw API report data into structured line chart options
 * with formatted labels.
 *
 * Per modern library conventions, this function carries no mutable
 * locale global — the caller decides via `options.locale`.
 * @param root0 - The raw report data from the Classic API.
 * @param root0.Data - The data series arrays.
 * @param root0.FromDate - The start date of the report period.
 * @param root0.LabelType - The label format type determining how labels are parsed.
 * @param root0.Labels - The raw label strings from the Classic API.
 * @param root0.ToDate - The end date of the report period.
 * @param options - Legend, unit, and locale for label formatting.
 * @param options.legend - Legend entries for each data series.
 * @param options.locale - BCP-47 locale tag; defaults to the runtime locale when omitted.
 * @param options.unit - Unit of measurement for the data.
 * @returns Structured line chart options.
 */
export const getChartLineOptions = (
  {
    Data: data,
    FromDate: from,
    Labels: labels,
    LabelType: labelType,
    ToDate: to,
  }: ClassicReportData,
  { legend, locale, unit }: ChartLineFormatOptions,
): ReportChartLineOptions => ({
  from,
  labels: formatLabels(labels, labelType, locale),
  series: getChartLineSeries({ data, legend }),
  to,
  unit,
})

/**
 * Transform operation mode log data into structured pie chart options.
 * @param data - The operation mode log entries.
 * @param root0 - The report query date range.
 * @param root0.from - The start date of the report period.
 * @param root0.to - The end date of the report period.
 * @returns Structured pie chart options.
 */
export const getChartPieOptions = (
  data: ClassicOperationModeLogData,
  { from, to }: Required<ReportQuery>,
): ReportChartPieOptions => ({
  from,
  labels: data.map(({ Key: label }) => label),
  series: data.map(({ Value: value }) => value),
  to,
})
