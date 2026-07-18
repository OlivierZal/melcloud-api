import { describe, expect, it } from 'vitest'

import type { ReportChartLineOptions } from '../../src/facades/index.ts'
import { ok } from '../../src/types/index.ts'
import {
  fromListToSetAta,
  fromSetToListAta,
  hoursUpTo,
  isSetDeviceDataAtaInList,
  isSetDeviceDataAtaNotInList,
  isUpdateDeviceData,
  mergeHourlyChartResults,
  omitUndefined,
  typedFromEntries,
} from '../../src/utils.ts'
import { cast, okValue } from '../helpers.ts'

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

  it('is the inverse of fromSetToListAta', ({ expect }) => {
    expect.assertions(3)

    for (const [key, value] of Object.entries(fromSetToListAta)) {
      expect(fromListToSetAta[value]).toBe(key)
    }
  })
})

describe.concurrent(isSetDeviceDataAtaNotInList, () => {
  it('returns true for every key in fromSetToListAta', ({ expect }) => {
    expect.assertions(3)

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
  it('returns true for every key in fromListToSetAta', ({ expect }) => {
    expect.assertions(3)

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

describe.concurrent(omitUndefined, () => {
  it('drops undefined-valued keys and keeps null-valued ones', () => {
    expect(
      omitUndefined({ fanSpeed: null, power: true, temperature: undefined }),
    ).toStrictEqual({ fanSpeed: null, power: true })
  })

  it('returns an empty object when every value is undefined', () => {
    expect(omitUndefined({ temperature: undefined })).toStrictEqual({})
  })
})

describe.concurrent(hoursUpTo, () => {
  it('lists midnight through the given hour', () => {
    expect(hoursUpTo(0)).toStrictEqual([0])
    expect(hoursUpTo(3)).toStrictEqual([0, 1, 2, 3])
    expect(hoursUpTo(23)).toHaveLength(24)
  })
})

const hourOptions = (
  labels: string[],
  data: (number | null)[],
): ReturnType<typeof ok<ReportChartLineOptions>> =>
  ok({
    from: labels[0] ?? '',
    labels,
    series: [{ data, name: 'Signal' }],
    to: labels.at(-1) ?? '',
    unit: 'dBm',
  })

describe.concurrent(mergeHourlyChartResults, () => {
  it('concatenates consecutive hours into one chart', () => {
    const merged = okValue(
      mergeHourlyChartResults([
        hourOptions(['00:00', '00:30'], [-60, -61]),
        hourOptions(['01:00', '01:30'], [-62, null]),
      ]),
    )

    expect(merged.labels).toStrictEqual(['00:00', '00:30', '01:00', '01:30'])
    expect(merged.series).toStrictEqual([
      { data: [-60, -61, -62, null], name: 'Signal' },
    ])
    expect(merged.from).toBe('00:00')
    expect(merged.to).toBe('01:30')
    expect(merged.unit).toBe('dBm')
  })

  it('propagates the first hourly failure untouched', () => {
    const failure: ReturnType<typeof mergeHourlyChartResults> = cast({
      ok: false,
    })

    expect(
      mergeHourlyChartResults([hourOptions(['00:00'], [-60]), failure]),
    ).toBe(failure)
  })

  it('pads a series absent from a later hour with nothing', () => {
    const merged = okValue(
      mergeHourlyChartResults([
        hourOptions(['00:00'], [-60]),
        ok({
          from: '01:00',
          labels: ['01:00'],
          series: [],
          to: '01:00',
          unit: 'dBm',
        }),
      ]),
    )

    expect(merged.series).toStrictEqual([{ data: [-60], name: 'Signal' }])
  })

  it('resolves an empty chart for an empty day', () => {
    const merged = okValue(mergeHourlyChartResults([]))

    expect(merged.labels).toStrictEqual([])
    expect(merged.series).toStrictEqual([])
  })
})
