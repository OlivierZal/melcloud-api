import { describe, expect, it } from 'vitest'

import {
  fromListToSetAta,
  fromSetToListAta,
  isSetDeviceDataAtaInList,
  isSetDeviceDataAtaNotInList,
  isUpdateDeviceData,
  typedFromEntries,
} from '../../src/utils.ts'

describe.concurrent('ata set-to-list conversion', () => {
  it('maps set keys to list keys', () => {
    expect(fromSetToListAta.SetFanSpeed).toBe('FanSpeed')
    expect(fromSetToListAta.VaneHorizontal).toBe('VaneHorizontalDirection')
    expect(fromSetToListAta.VaneVertical).toBe('VaneVerticalDirection')
  })
})

describe.concurrent('ata list-to-set conversion', () => {
  it('maps list keys to set keys', () => {
    expect(fromListToSetAta.FanSpeed).toBe('SetFanSpeed')
    expect(fromListToSetAta.VaneHorizontalDirection).toBe('VaneHorizontal')
    expect(fromListToSetAta.VaneVerticalDirection).toBe('VaneVertical')
  })

  it('is the inverse of fromSetToListAta', () => {
    for (const [key, value] of Object.entries(fromSetToListAta)) {
      expect(fromListToSetAta[value]).toBe(key)
    }
  })
})

describe.concurrent(isSetDeviceDataAtaNotInList, () => {
  it('returns true for keys in fromSetToListAta', () => {
    expect(isSetDeviceDataAtaNotInList('SetFanSpeed')).toBe(true)
    expect(isSetDeviceDataAtaNotInList('VaneHorizontal')).toBe(true)
    expect(isSetDeviceDataAtaNotInList('VaneVertical')).toBe(true)
  })

  it('returns false for keys not in fromSetToListAta', () => {
    expect(isSetDeviceDataAtaNotInList('Power')).toBe(false)
    expect(isSetDeviceDataAtaNotInList('FanSpeed')).toBe(false)
  })
})

describe.concurrent(isSetDeviceDataAtaInList, () => {
  it('returns true for keys in fromListToSetAta', () => {
    expect(isSetDeviceDataAtaInList('FanSpeed')).toBe(true)
    expect(isSetDeviceDataAtaInList('VaneHorizontalDirection')).toBe(true)
    expect(isSetDeviceDataAtaInList('VaneVerticalDirection')).toBe(true)
  })

  it('returns false for keys not in fromListToSetAta', () => {
    expect(isSetDeviceDataAtaInList('SetFanSpeed')).toBe(false)
    expect(isSetDeviceDataAtaInList('Power')).toBe(false)
  })
})

describe.concurrent(typedFromEntries, () => {
  it('converts entries to an object', () => {
    const entries: [string, number][] = [
      ['key1', 1],
      ['key2', 2],
    ]

    expect(typedFromEntries(entries)).toStrictEqual({ key1: 1, key2: 2 })
  })
})

describe.concurrent(isUpdateDeviceData, () => {
  const data = { Power: 0, SetTemperature: 0 }

  it('returns true for keys in the data record', () => {
    const key = 'Power' as string

    expect(isUpdateDeviceData(data, key)).toBe(true)
  })

  it('returns false for keys not in the data record', () => {
    const key = 'NonExistent' as string

    expect(isUpdateDeviceData(data, key)).toBe(false)
  })
})
