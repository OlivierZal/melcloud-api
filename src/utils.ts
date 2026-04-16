import { DateTime } from 'luxon'

import type {
  ReportChartLineOptions,
  ReportChartPieOptions,
  ReportQuery,
} from './facades/index.ts'
import type {
  KeyOfSetDeviceDataAtaNotInList,
  OperationModeLogData,
  ReportData,
  SetDeviceDataAtaInList,
  UpdateDeviceData,
} from './types/index.ts'
import { type ClassicDeviceType, LabelType } from './constants.ts'

// API encodes year-month as YYYYMM integer (e.g., 202306 for June 2023)
const YEAR_MONTH_DIVISOR = 100

/**
 * Get the current date/time as an ISO 8601 string without timezone offset.
 * @returns The current date/time as an ISO string.
 */
export const now = (): string => DateTime.now().toISO({ includeOffset: false })

/** Maps ATA set-command keys to their corresponding list-data keys. */
export const fromSetToListAta: Record<
  KeyOfSetDeviceDataAtaNotInList,
  keyof SetDeviceDataAtaInList
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
export const isSetDeviceDataAtaNotInList = (
  value: string,
): value is KeyOfSetDeviceDataAtaNotInList => value in fromSetToListAta

/** Maps ATA list-data keys to their corresponding set-command keys. */
export const fromListToSetAta: Record<
  keyof SetDeviceDataAtaInList,
  KeyOfSetDeviceDataAtaNotInList
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
export const isSetDeviceDataAtaInList = (
  value: string,
): value is keyof SetDeviceDataAtaInList => value in fromListToSetAta

/*
 * Strategy map: transform raw API label formats into human-readable strings
 * based on report granularity (day of week, month name, year-month, etc.)
 */
const labelFormatters: Record<LabelType, (label: string) => string> = {
  [LabelType.day_of_week]: (label) =>
    DateTime.fromFormat(label, 'c').toFormat('ccc'),
  [LabelType.month]: (label) =>
    DateTime.fromObject({ month: Number(label) }).toFormat('MMM'),
  [LabelType.month_of_year]: (label) =>
    DateTime.local(
      Math.floor(Number(label) / YEAR_MONTH_DIVISOR),
      Number(label) % YEAR_MONTH_DIVISOR,
    ).toFormat('MMM yyyy'),
  [LabelType.raw]: (label) => label,
  [LabelType.time]: (label) => label,
}

const formatLabels = (
  labels: readonly string[],
  labelType: LabelType,
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
  data: Record<keyof UpdateDeviceData<T>, unknown>,
  key: string,
): key is string & keyof UpdateDeviceData<T> => key in data

const getChartLineSeries = ({
  data,
  legend,
}: {
  data: readonly (readonly (number | null)[])[]
  legend: (string | undefined)[]
}): { data: (number | null)[]; name: string }[] =>
  data
    .map((values, index) => ({ data: values, name: legend.at(index) }))
    .filter(
      (item): item is { data: (number | null)[]; name: string } =>
        item.name !== undefined,
    )

/**
 * Transform raw API report data into structured line chart options with formatted labels.
 * @param root0 - The raw report data from the Classic API.
 * @param root0.Data - The data series arrays.
 * @param root0.FromDate - The start date of the report period.
 * @param root0.Labels - The raw label strings from the Classic API.
 * @param root0.LabelType - The label format type determining how labels are parsed.
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
  }: ReportData,
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
  data: OperationModeLogData,
  { from, to }: Required<ReportQuery>,
): ReportChartPieOptions => ({
  from,
  labels: data.map(({ Key: label }) => label),
  series: data.map(({ Value: value }) => value),
  to,
})
