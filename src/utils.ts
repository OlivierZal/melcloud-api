import { DateTime } from 'luxon'

import type {
  KeyofSetDeviceDataAtaNotInList,
  SetDeviceDataAtaInList,
} from './types/ata.ts'

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
