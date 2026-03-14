import { DateTime, Settings as LuxonSettings } from 'luxon'
import { describe, expect, it } from 'vitest'

import type { OperationModeLogData, ReportData } from '../../src/types/index.ts'

import { LabelType } from '../../src/constants.ts'
import {
  getChartLineOptions,
  getChartPieOptions,
  now,
} from '../../src/utils.ts'

describe('now', () => {
  it('returns an ISO string without offset', () => {
    const result = now()

    expect(result).not.toContain('+')
    expect(result).not.toContain('Z')
    expect(() => DateTime.fromISO(result)).not.toThrow()
  })
})

describe('formatLabels (via getChartLineOptions)', () => {
  const baseReportData: ReportData = {
    Data: [[1, 2]],
    FromDate: '2024-01-01',
    Labels: [],
    LabelType: LabelType.raw,
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
      LabelType: LabelType.time,
    }
    const result = getChartLineOptions(data, ['Series 1'], 'unit')

    expect(result.labels).toStrictEqual(['12:00', '13:00'])
  })

  it('formats day_of_week labels', () => {
    LuxonSettings.defaultLocale = 'en'
    const data = {
      ...baseReportData,
      Labels: ['1', '2', '3'],
      LabelType: LabelType.day_of_week,
    }
    const result = getChartLineOptions(data, ['Series 1'], 'unit')

    expect(result.labels).toHaveLength(3)
    expect(result.labels[0]).toBe('Mon')
  })

  it('formats month labels', () => {
    LuxonSettings.defaultLocale = 'en'
    const data = {
      ...baseReportData,
      Labels: ['1', '6', '12'],
      LabelType: LabelType.month,
    }
    const result = getChartLineOptions(data, ['Series 1'], 'unit')

    expect(result.labels[0]).toBe('Jan')
    expect(result.labels[1]).toBe('Jun')
    expect(result.labels[2]).toBe('Dec')
  })

  it('formats month_of_year labels', () => {
    LuxonSettings.defaultLocale = 'en'
    const data = {
      ...baseReportData,
      Labels: ['202401', '202412'],
      LabelType: LabelType.month_of_year,
    }
    const result = getChartLineOptions(data, ['Series 1'], 'unit')

    expect(result.labels[0]).toBe('Jan 2024')
    expect(result.labels[1]).toBe('Dec 2024')
  })
})

describe('getChartLineOptions', () => {
  const reportData: ReportData = {
    Data: [
      [1, 2, 3],
      [4, 5, 6],
    ],
    FromDate: '2024-01-01',
    Labels: ['a', 'b', 'c'],
    LabelType: LabelType.raw,
    Points: 3,
    Series: 2,
    ToDate: '2024-01-03',
  }

  it('maps data series with legend names', () => {
    const result = getChartLineOptions(
      reportData,
      ['Temperature', 'Humidity'],
      '°C',
    )

    expect(result.series).toHaveLength(2)
    expect(result.series[0]?.name).toBe('Temperature')
    expect(result.series[1]?.name).toBe('Humidity')
    expect(result.unit).toBe('°C')
    expect(result.from).toBe('2024-01-01')
    expect(result.to).toBe('2024-01-03')
  })

  it('filters out series with undefined legend entries', () => {
    const result = getChartLineOptions(
      reportData,
      ['Temperature', undefined],
      '°C',
    )

    expect(result.series).toHaveLength(1)
    expect(result.series[0]?.name).toBe('Temperature')
  })

  it('returns empty series when all legends are undefined', () => {
    const result = getChartLineOptions(reportData, [undefined, undefined], '°C')

    expect(result.series).toHaveLength(0)
  })
})

describe('getChartPieOptions', () => {
  it('maps operation mode log data', () => {
    const data: OperationModeLogData = [
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
