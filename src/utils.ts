import { DateTime, Settings as LuxonSettings } from 'luxon'

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

// API encodes year-month as YYYYMM integer (e.g., 202306 for June 2023)
const YEAR_MONTH_DIVISOR = 100

// 2024-01-01 was a Monday (ISO weekday 1), so UTC day N of Jan 2024 maps cleanly to weekday N.
const DAY_OF_WEEK_BASE_YEAR = 2024
const MONTH_NAME_BASE_YEAR = 2024

interface LabelFormatterCache {
  readonly dayOfWeek: Intl.DateTimeFormat
  readonly locale: string | null | undefined
  readonly month: Intl.DateTimeFormat
}

let formatterCache: LabelFormatterCache | null = null

// Tracks LuxonSettings.defaultLocale so output stays consistent with the rest
// of the codebase's datetime formatting without re-creating Intl.DateTimeFormat per call.
const getLabelFormatters = (): LabelFormatterCache => {
  const { defaultLocale: locale } = LuxonSettings
  if (formatterCache?.locale === locale) {
    return formatterCache
  }
  // Luxon types defaultLocale as `string` but emits `null` at runtime when unset; Intl throws on null.
  const base: string | undefined =
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- see above
    locale ?? undefined
  const cache: LabelFormatterCache = {
    dayOfWeek: new Intl.DateTimeFormat(base, {
      timeZone: 'UTC',
      weekday: 'short',
    }),
    locale,
    month: new Intl.DateTimeFormat(base, {
      month: 'short',
      timeZone: 'UTC',
    }),
  }
  formatterCache = cache
  return cache
}

/**
 * Get the current date/time as an ISO 8601 string without timezone offset.
 * @returns The current date/time as an ISO string.
 */
export const now = (): string => DateTime.now().toISO({ includeOffset: false })

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
export const fromSetToListAta: Record<
  KeyOfClassicSetDeviceDataAtaNotInList,
  keyof ClassicSetDeviceDataAtaInList
> = {
  SetFanSpeed: 'FanSpeed',
  VaneHorizontal: 'VaneHorizontalDirection',
  VaneVertical: 'VaneVerticalDirection',
}

/**
 * Type guard for ATA set-command keys that differ from list-data keys.
 * @param value - The key to check.
 * @returns Whether the key is a set-command key not present in list data.
 */
export const isSetDeviceDataAtaNotInList = isKeyOf(fromSetToListAta)

/** Maps ATA list-data keys to their corresponding set-command keys. */
export const fromListToSetAta: Record<
  keyof ClassicSetDeviceDataAtaInList,
  KeyOfClassicSetDeviceDataAtaNotInList
> = {
  FanSpeed: 'SetFanSpeed',
  VaneHorizontalDirection: 'VaneHorizontal',
  VaneVerticalDirection: 'VaneVertical',
}

/**
 * Type guard for ATA list-data keys that map to different set-command keys.
 * @param value - The key to check.
 * @returns Whether the key is a list-data key with a different set-command key.
 */
export const isSetDeviceDataAtaInList = isKeyOf(fromListToSetAta)

/*
 * Strategy map: transform raw API label formats into human-readable strings
 * based on report granularity (day of week, month name, year-month, etc.)
 */
const labelFormatters: Record<ClassicLabelType, (label: string) => string> = {
  [ClassicLabelType.day_of_week]: (label) =>
    getLabelFormatters().dayOfWeek.format(
      Date.UTC(DAY_OF_WEEK_BASE_YEAR, 0, Number(label)),
    ),
  [ClassicLabelType.month]: (label) =>
    getLabelFormatters().month.format(
      Date.UTC(MONTH_NAME_BASE_YEAR, Number(label) - 1, 1),
    ),
  [ClassicLabelType.month_of_year]: (label) => {
    const year = Math.floor(Number(label) / YEAR_MONTH_DIVISOR)
    const month = (Number(label) % YEAR_MONTH_DIVISOR) - 1
    // Format month and year separately to preserve the "MMM yyyy" ordering
    // across locales; `Intl.DateTimeFormat` with both fields reorders (e.g. ja → "yyyy年M月").
    const monthName = getLabelFormatters().month.format(
      Date.UTC(year, month, 1),
    )
    return `${monthName} ${String(year)}`
  },
  [ClassicLabelType.raw]: (label) => label,
  [ClassicLabelType.time]: (label) => label,
}

const formatLabels = (
  labels: readonly string[],
  labelType: ClassicLabelType,
): string[] => labels.map((label) => labelFormatters[labelType](label))

/**
 * Type-safe `Object.keys` that preserves the key type of the input object.
 * @param object - The object to extract keys from.
 * @returns The object's keys with their type preserved.
 */
export const typedKeys = <T extends Record<string, unknown>>(
  object: T,
): (string & keyof T)[] => Object.keys(object) as (string & keyof T)[]

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
  legend: (string | undefined)[]
}): { data: (number | null)[]; name: string }[] =>
  data
    .map((values, index) => ({ data: values, name: legend[index] }))
    .filter(
      (item): item is { data: (number | null)[]; name: string } =>
        item.name !== undefined,
    )

/**
 * Transform raw API report data into structured line chart options with formatted labels.
 * @param root0 - The raw report data from the Classic API.
 * @param root0.Data - The data series arrays.
 * @param root0.FromDate - The start date of the report period.
 * @param root0.LabelType - The label format type determining how labels are parsed.
 * @param root0.Labels - The raw label strings from the Classic API.
 * @param root0.ToDate - The end date of the report period.
 * @param legend - Legend entries for each data series.
 * @param unit - The unit of measurement for the data.
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
  legend: (string | undefined)[],
  unit: string,
): ReportChartLineOptions => ({
  from,
  labels: formatLabels(labels, labelType),
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
