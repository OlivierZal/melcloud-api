import { DateTime } from 'luxon'

import { LabelType } from './enums.ts'

import type { ReportChart } from './facades/interfaces.ts'
import type {
  KeyofSetDeviceDataAtaNotInList,
  SetDeviceDataAtaInList,
} from './types/ata.ts'
import type { ReportData } from './types/common.ts'

const YEAR_MONTH_DIVISOR = 100

export const now = (): string => DateTime.now().toISO({ includeOffset: false })

export const fromSetToListAta: Record<
  KeyofSetDeviceDataAtaNotInList,
  keyof SetDeviceDataAtaInList
> = {
  SetFanSpeed: 'FanSpeed',
  VaneHorizontal: 'VaneHorizontalDirection',
  VaneVertical: 'VaneVerticalDirection',
} as const

export const isKeyofSetDeviceDataAtaNotInList = (
  key: string,
): key is KeyofSetDeviceDataAtaNotInList => key in fromSetToListAta

export const fromListToSetAta: Record<
  keyof SetDeviceDataAtaInList,
  KeyofSetDeviceDataAtaNotInList
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
> = Object.fromEntries(
  Object.entries(fromSetToListAta).map(([key, value]) => [value, key]),
) as Record<keyof SetDeviceDataAtaInList, KeyofSetDeviceDataAtaNotInList>

export const isKeyofSetDeviceDataAtaInList = (
  key: string,
): key is keyof SetDeviceDataAtaInList => key in fromListToSetAta

const formatLabels = (
  labels: readonly string[],
  labelType: LabelType,
): readonly string[] => {
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
    case LabelType.day:
    case LabelType.hour:
    default:
      return labels
  }
}

export const renderForChart = (
  {
    Data: data,
    FromDate: from,
    Labels: labels,
    LabelType: labelType,
    ToDate: to,
  }: ReportData,
  legend: (string | undefined)[],
): ReportChart => ({
  from,
  labels: formatLabels(labels, labelType),
  series: legend
    .filter((name) => name !== undefined)
    .map((name, index) => ({ data: [...(data.at(index) ?? [])], name })),
  to,
})
