import { describe, expect, it } from 'vitest'

import type { ReportChartLineOptions } from '../../src/facades/index.ts'
import { Temporal } from '../../src/temporal.ts'
import { err, ok } from '../../src/types/index.ts'
import {
  fromListToSetAta,
  fromSetToListAta,
  hoursUpTo,
  isSetDeviceDataAtaInList,
  isSetDeviceDataAtaNotInList,
  isUninitializedWireDate,
  isUpdateDeviceData,
  mergeHourlyChartResults,
  omitUndefined,
  padHourlyChartToMidnight,
  toEpochMs,
  toUtcWallClock,
  toZonedWallClock,
  typedFromEntries,
} from '../../src/utils.ts'
import { okValue } from '../helpers.ts'

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
    const failure = err({ cause: new Error('fail'), kind: 'network' })

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

describe.concurrent(padHourlyChartToMidnight, () => {
  it('pads the not-yet-elapsed hours with clock labels and blanks', () => {
    const padded = padHourlyChartToMidnight(
      okValue(hourOptions(['22:30'], [-60])),
      { afterHour: 22, locale: 'fr-FR' },
    )

    expect(padded.labels).toHaveLength(61)
    expect(padded.labels[0]).toBe('22:30')
    expect(padded.labels[1]).toBe('23:00')
    expect(padded.labels.at(-1)).toBe('23:59')
    expect(padded.series).toStrictEqual([
      {
        data: [-60, ...Array.from({ length: 60 }, () => null)],
        name: 'Signal',
      },
    ])
  })

  it('returns the chart untouched during the last hour of the day', () => {
    const padded = padHourlyChartToMidnight(
      okValue(hourOptions(['23:30'], [-60])),
      { afterHour: 23, locale: 'fr-FR' },
    )

    expect(padded.labels).toStrictEqual(['23:30'])
    expect(padded.series).toStrictEqual([{ data: [-60], name: 'Signal' }])
  })
})

// The wall-clock projections are the holiday-mode contract's floor: the
// caller speaks its own zone, the wires store UTC. The pair must be
// exact inverses outside DST transitions, and each direction carries
// its own failure posture — a write throws before I/O, a read passes
// verbatim rather than taking a sync down.
describe('wall-clock projections', () => {
  it('projects a summer wall clock onto UTC and back', () => {
    const utc = toUtcWallClock('2026-07-10T20:30', 'Europe/Paris')

    expect(utc.toString()).toBe('2026-07-10T18:30:00')
    expect(toZonedWallClock(utc.toString(), 'Europe/Paris')).toBe(
      '2026-07-10T20:30:00',
    )
  })

  it('projects a winter wall clock with the winter offset', () => {
    expect(toUtcWallClock('2026-03-01T09:15', 'Europe/Paris').toString()).toBe(
      '2026-03-01T08:15:00',
    )
  })

  it('resolves a DST-gap wall clock per compatible disambiguation', () => {
    // 02:30 does not exist on 2026-03-29 in Paris: the clock jumps
    // 02:00 -> 03:00, and 'compatible' shifts forward.
    expect(toUtcWallClock('2026-03-29T02:30', 'Europe/Paris').toString()).toBe(
      '2026-03-29T01:30:00',
    )
  })

  it('falls back to the host zone when none is given', () => {
    const zone = Temporal.Now.timeZoneId()

    expect(toUtcWallClock('2026-07-10T20:30').toString()).toBe(
      Temporal.PlainDateTime.from('2026-07-10T20:30')
        .toZonedDateTime(zone)
        .withTimeZone('UTC')
        .toPlainDateTime()
        .toString(),
    )
    expect(toZonedWallClock('2026-07-10T18:30')).toBe(
      Temporal.PlainDateTime.from('2026-07-10T18:30')
        .toZonedDateTime('UTC')
        .withTimeZone(zone)
        .toPlainDateTime()
        .toString(),
    )
  })

  it('throws on a malformed write-side datetime', () => {
    expect(() => toUtcWallClock('not-a-date', 'Europe/Paris')).toThrow(
      RangeError,
    )
  })

  it('passes a malformed read-side datetime through verbatim', () => {
    expect(toZonedWallClock('not-a-date', 'Europe/Paris')).toBe('not-a-date')
  })
})

describe('epoch projections', () => {
  it('takes an offset-carrying value as the instant it already spells', () => {
    expect(toEpochMs('2026-03-01T06:00:00Z')).toBe(
      Temporal.Instant.from('2026-03-01T06:00:00Z').epochMilliseconds,
    )
  })

  it('resolves a DST-gap wall clock forward per compatible disambiguation', () => {
    // 02:30 does not exist on 2026-03-29 in Paris (the clock jumps
    // 02:00 -> 03:00): 'compatible' shifts forward to 03:30+02:00.
    expect(toEpochMs('2026-03-29T02:30:00', 'Europe/Paris')).toBe(
      Temporal.Instant.from('2026-03-29T01:30:00Z').epochMilliseconds,
    )
  })

  it('resolves a DST-overlap wall clock to the earlier offset', () => {
    // 02:30 happens twice on 2026-10-25 in Paris (the clock falls back
    // 03:00 -> 02:00): 'compatible' keeps the first pass, +02:00.
    expect(toEpochMs('2026-10-25T02:30:00', 'Europe/Paris')).toBe(
      Temporal.Instant.from('2026-10-25T00:30:00Z').epochMilliseconds,
    )
  })

  it('answers null for a value it cannot parse', () => {
    expect(toEpochMs('not-a-date', 'Europe/Paris')).toBeNull()
  })

  it('recognizes the year-1 sentinel in every spelling', () => {
    expect(isUninitializedWireDate('0001-01-01T00:00:00')).toBe(true)
    expect(isUninitializedWireDate('0001-01-01T00:00:00Z')).toBe(true)
    // The offset spelling lands in UTC year 0 — still the sentinel: no
    // real MELCloud timestamp can reach a year at or below 1.
    expect(isUninitializedWireDate('0001-01-01T00:00:00+01:00')).toBe(true)
    expect(isUninitializedWireDate('2026-03-01T06:00:00')).toBe(false)
    expect(isUninitializedWireDate('not-a-date')).toBe(false)
  })
})
