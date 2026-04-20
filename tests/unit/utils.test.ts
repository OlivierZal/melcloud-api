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
  it('returns true for every key in fromSetToListAta', () => {
    for (const key of Object.keys(fromSetToListAta)) {
      expect(isSetDeviceDataAtaNotInList(key)).toBe(true)
    }
  })

  it.each(['Power', 'FanSpeed'])(
    'returns false for %s (not in fromSetToListAta)',
    (key) => {
      expect(isSetDeviceDataAtaNotInList(key)).toBe(false)
    },
  )
})

describe.concurrent(isSetDeviceDataAtaInList, () => {
  it('returns true for every key in fromListToSetAta', () => {
    for (const key of Object.keys(fromListToSetAta)) {
      expect(isSetDeviceDataAtaInList(key)).toBe(true)
    }
  })

  it.each(['SetFanSpeed', 'Power'])(
    'returns false for %s (not in fromListToSetAta)',
    (key) => {
      expect(isSetDeviceDataAtaInList(key)).toBe(false)
    },
  )
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
