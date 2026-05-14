import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type {
  ClassicOperationModeLogData,
  ClassicReportData,
} from '../../src/types/index.ts'
import { ClassicLabelType } from '../../src/constants.ts'
import { Temporal } from '../../src/temporal.ts'
import {
  getChartLineOptions,
  getChartPieOptions,
  getReportLocale,
  now,
  setReportLocale,
} from '../../src/utils.ts'

describe.concurrent(now, () => {
  it('returns an ISO string without offset', () => {
    const result = now()

    expect(result).not.toContain('+')
    expect(result).not.toContain('Z')
    expect(() => Temporal.PlainDateTime.from(result)).not.toThrow()
  })
})

// Not `describe.concurrent`: these specs mutate the module-level report
// locale via `setReportLocale`, so concurrent execution would interleave
// different locale values and make label assertions flaky. The `beforeEach`/
// `afterEach` pair pins each spec to `'en'` and restores the original
// locale on exit so the suite cannot leak into later suites either.
describe('formatLabels (via getChartLineOptions)', () => {
  let originalLocale: string | null = null

  beforeEach(() => {
    originalLocale = getReportLocale()
    setReportLocale('en')
  })

  afterEach(() => {
    setReportLocale(originalLocale)
  })

  const baseReportData: ClassicReportData = {
    Data: [[1, 2]],
    FromDate: '2024-01-01',
    Labels: [],
    LabelType: ClassicLabelType.raw,
    Points: 2,
    Series: 1,
    ToDate: '2024-01-02',
  }

  it('passes raw labels unchanged', () => {
    const data = { ...baseReportData, Labels: ['foo', 'bar'] }
    const result = getChartLineOptions(data, ['Series 1'], 'unit')

    expect(result.labels).toStrictEqual(['foo', 'bar'])
  })

  it('passes time labels unchanged', () => {
    const data = {
      ...baseReportData,
      Labels: ['12:00', '13:00'],
      LabelType: ClassicLabelType.time,
    }
    const result = getChartLineOptions(data, ['Series 1'], 'unit')

    expect(result.labels).toStrictEqual(['12:00', '13:00'])
  })

  it('formats day_of_week labels', () => {
    const data = {
      ...baseReportData,
      Labels: ['1', '2', '3'],
      LabelType: ClassicLabelType.day_of_week,
    }
    const result = getChartLineOptions(data, ['Series 1'], 'unit')

    expect(result.labels).toHaveLength(3)
    expect(result.labels[0]).toBe('Mon')
  })

  it('formats month labels', () => {
    const data = {
      ...baseReportData,
      Labels: ['1', '6', '12'],
      LabelType: ClassicLabelType.month,
    }
    const result = getChartLineOptions(data, ['Series 1'], 'unit')

    expect(result.labels[0]).toBe('Jan')
    expect(result.labels[1]).toBe('Jun')
    expect(result.labels[2]).toBe('Dec')
  })

  it('formats month_of_year labels', () => {
    const data = {
      ...baseReportData,
      Labels: ['202401', '202412'],
      LabelType: ClassicLabelType.month_of_year,
    }
    const result = getChartLineOptions(data, ['Series 1'], 'unit')

    expect(result.labels[0]).toBe('Jan 2024')
    expect(result.labels[1]).toBe('Dec 2024')
  })
})

describe.concurrent(getChartLineOptions, () => {
  const classicReportData: ClassicReportData = {
    Data: [
      [1, 2, 3],
      [4, 5, 6],
    ],
    FromDate: '2024-01-01',
    Labels: ['a', 'b', 'c'],
    LabelType: ClassicLabelType.raw,
    Points: 3,
    Series: 2,
    ToDate: '2024-01-03',
  }

  it('maps data series with legend names', () => {
    const result = getChartLineOptions(
      classicReportData,
      ['ClassicTemperature', 'Humidity'],
      '°C',
    )

    expect(result.series).toHaveLength(2)
    expect(result.series[0]?.name).toBe('ClassicTemperature')
    expect(result.series[1]?.name).toBe('Humidity')
    expect(result.unit).toBe('°C')
    expect(result.from).toBe('2024-01-01')
    expect(result.to).toBe('2024-01-03')
  })

  it('filters out series with undefined legend entries', () => {
    const result = getChartLineOptions(
      classicReportData,
      ['ClassicTemperature', undefined],
      '°C',
    )

    expect(result.series).toHaveLength(1)
    expect(result.series[0]?.name).toBe('ClassicTemperature')
  })

  it('returns empty series when all legends are undefined', () => {
    const result = getChartLineOptions(
      classicReportData,
      [undefined, undefined],
      '°C',
    )

    expect(result.series).toHaveLength(0)
  })
})

describe.concurrent(getChartPieOptions, () => {
  it('maps operation mode log data', () => {
    const data: ClassicOperationModeLogData = [
      { Key: 'Heating', Value: 60 },
      { Key: 'Cooling', Value: 30 },
      { Key: 'Idle', Value: 10 },
    ]
    const result = getChartPieOptions(data, {
      from: '2024-01-01',
      to: '2024-01-31',
    })

    expect(result.labels).toStrictEqual(['Heating', 'Cooling', 'Idle'])
    expect(result.series).toStrictEqual([60, 30, 10])
    expect(result.from).toBe('2024-01-01')
    expect(result.to).toBe('2024-01-31')
  })
})

describe('formatLabels with unset report locale', () => {
  it('falls back to system locale when the report locale is null', () => {
    const originalLocale = getReportLocale()
    try {
      setReportLocale(null)
      const data: ClassicReportData = {
        Data: [[1]],
        FromDate: '2024-01-01',
        Labels: ['1'],
        LabelType: ClassicLabelType.month,
        Points: 1,
        Series: 1,
        ToDate: '2024-01-02',
      }
      const result = getChartLineOptions(data, ['Series 1'], 'unit')

      expect(result.labels).toHaveLength(1)
      expect(result.labels[0]).toBeDefined()
    } finally {
      setReportLocale(originalLocale)
    }
  })
})
