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

import { type DeviceType, LabelType } from './enums.ts'

// API encodes year-month as YYYYMM integer (e.g., 202306 for June 2023)
const YEAR_MONTH_DIVISOR = 100

/** Get the current date/time as an ISO 8601 string without timezone offset. */
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

/** Type guard for ATA set-command keys that differ from list-data keys. */
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

/** Type guard for ATA list-data keys that map to different set-command keys. */
export const isSetDeviceDataAtaInList = (
  value: string,
): value is keyof SetDeviceDataAtaInList => value in fromListToSetAta

/*
 * Transform raw API label formats into human-readable strings based on
 * report granularity (day of week, month name, year-month, etc.)
 */
const formatLabels = (
  labels: readonly string[],
  labelType: LabelType,
): string[] => {
  switch (labelType) {
    case LabelType.day_of_week: {
      return labels.map((label) =>
        DateTime.fromFormat(label, 'c').toFormat('ccc'),
      )
    }
    case LabelType.month: {
      return labels.map((label) =>
        DateTime.fromObject({ month: Number(label) }).toFormat('MMM'),
      )
    }
    case LabelType.month_of_year: {
      return labels.map((label) =>
        DateTime.local(
          Math.floor(Number(label) / YEAR_MONTH_DIVISOR),
          Number(label) % YEAR_MONTH_DIVISOR,
        ).toFormat('MMM yyyy'),
      )
    }
    case LabelType.raw:
    case LabelType.time: {
      return [...labels]
    }
    // No default
  }
}

/** Type guard checking whether a key belongs to the updatable device data fields. */
export const isUpdateDeviceData = <T extends DeviceType>(
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

/** Transform raw API report data into structured line chart options with formatted labels. */
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

/** Transform operation mode log data into structured pie chart options. */
export const getChartPieOptions = (
  data: OperationModeLogData,
  { from, to }: Required<ReportQuery>,
): ReportChartPieOptions => ({
  from,
  labels: data.map(({ Key: label }) => label),
  series: data.map(({ Value: value }) => value),
  to,
})
