import { DateTime } from 'luxon'

import type {
  ReportChartLineOptions,
  ReportChartPieOptions,
  ReportQuery,
} from './facades/index.ts'
import type {
  KeyofSetDeviceDataAtaNotInList,
  SetDeviceDataAtaInList,
} from './types/ata.ts'
import type {
  OperationModeLogData,
  ReportData,
  UpdateDeviceData,
} from './types/common.ts'

import { type DeviceType, LabelType } from './enums.ts'

const YEAR_MONTH_DIVISOR = 100

export const now = (): string => DateTime.now().toISO({ includeOffset: false })

export const fromSetToListAta: Record<
  KeyofSetDeviceDataAtaNotInList,
  keyof SetDeviceDataAtaInList
> = {
  SetFanSpeed: 'FanSpeed',
  VaneHorizontal: 'VaneHorizontalDirection',
  VaneVertical: 'VaneVerticalDirection',
}

export const isSetDeviceDataAtaNotInList = (
  value: string,
): value is KeyofSetDeviceDataAtaNotInList => value in fromSetToListAta

export const fromListToSetAta: Record<
  keyof SetDeviceDataAtaInList,
  KeyofSetDeviceDataAtaNotInList
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
> = Object.fromEntries(
  Object.entries(fromSetToListAta).map(([key, value]) => [value, key]),
) as Record<keyof SetDeviceDataAtaInList, KeyofSetDeviceDataAtaNotInList>

export const isSetDeviceDataAtaInList = (
  value: string,
): value is keyof SetDeviceDataAtaInList => value in fromListToSetAta

const formatLabels = (
  labels: readonly string[],
  labelType: LabelType,
): string[] => {
  switch (labelType) {
    case LabelType.day_of_week:
      return labels.map((label) =>
        DateTime.fromFormat(label, 'c').toFormat('ccc'),
      )
    case LabelType.month:
      return labels.map((label) =>
        DateTime.fromObject({ month: Number(label) }).toFormat('MMM'),
      )
    case LabelType.month_of_year:
      return labels.map((label) =>
        DateTime.local(
          Math.floor(Number(label) / YEAR_MONTH_DIVISOR),
          Number(label) % YEAR_MONTH_DIVISOR,
        ).toFormat('MMM yyyy'),
      )
    case LabelType.raw:
    case LabelType.time:
    default:
      return [...labels]
  }
}

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

export const getChartPieOptions = (
  data: OperationModeLogData,
  { from, to }: Required<ReportQuery>,
): ReportChartPieOptions => ({
  from,
  labels: data.map(({ Key: label }) => label),
  series: data.map(({ Value: value }) => value),
  to,
})
