import { DateTime } from 'luxon'

import type {
  KeysOfSetDeviceDataAtaNotInList,
  SetDeviceDataAtaInList,
} from './types/index.js'

export const DEFAULT_YEAR = '1970-01-01'

export const now = (): string => DateTime.now().toISO({ includeOffset: false })

export const fromSetToListAta: Record<
  KeysOfSetDeviceDataAtaNotInList,
  keyof SetDeviceDataAtaInList
> = {
  SetFanSpeed: 'FanSpeed',
  VaneHorizontal: 'VaneHorizontalDirection',
  VaneVertical: 'VaneVerticalDirection',
} as const

export const fromListToSetAta: Record<
  keyof SetDeviceDataAtaInList,
  KeysOfSetDeviceDataAtaNotInList
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
> = Object.fromEntries(
  Object.entries(fromSetToListAta).map(([key, value]) => [value, key]),
) as Record<keyof SetDeviceDataAtaInList, KeysOfSetDeviceDataAtaNotInList>
