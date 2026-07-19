import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { HomeReportData } from '../../src/types/index.ts'
import {
  mergeHomeReportChunks,
  resolveHomeHourWindow,
  resolveHomeReportWindow,
  splitHomeReportWindow,
  toHomeEnergyOptions,
  toHomeLineOptions,
  toHomeOperationModeOptions,
  toHomeReportPeriod,
  toHomeSeriesName,
  toHomeSignalOptions,
  toHomeWireWindow,
} from '../../src/facades/home-report.ts'
import { Temporal } from '../../src/temporal.ts'
import { mockTemporalNowZoned } from '../helpers.ts'
import { homeReportPoint } from '../home-fixtures.ts'

const PARIS = 'Europe/Paris'

// 2026-07-18T20:00:00Z — 22:00 in Paris (CEST).
const NOW_ISO = '2026-07-18T20:00:00Z'

const OVERLAY_PREFIX = 'REPORT.COMFORT_GRAPH.OVERLAY_KEY.'

const report = (overrides: Partial<HomeReportData> = {}): HomeReportData => ({
  datasets: [],
  reportPeriod: 'hourly',
  ...overrides,
})

// One-day window in UTC wall-clock, matching the wire frame.
const utcDayWindow = resolveHomeReportWindow(
  { from: '2026-07-17T00:00:00', to: '2026-07-18T00:00:00' },
  'UTC',
)

describe.concurrent(toHomeSeriesName, () => {
  it.each([
    { expected: 'RoomTemperature', id: 'room_temperature' },
    { expected: 'SetTemperatureZone1', id: 'set_temperature_zone1' },
    { expected: 'FlowTemperatureBoiler', id: 'flow_temperature_boiler' },
    { expected: 'OutdoorTemperature', id: 'outside_temperature' },
  ])('maps $id to $expected', ({ expected, id }) => {
    expect(toHomeSeriesName(id)).toBe(expected)
  })
})

describe(resolveHomeReportWindow, () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(Temporal.Instant.from(NOW_ISO).epochMilliseconds)
    mockTemporalNowZoned()
  })

  afterEach(() => {
    vi.mocked(Temporal.Now.zonedDateTimeISO).mockRestore()
    vi.useRealTimers()
  })

  it('interprets zoneless dates as wall-clock in the display timezone', () => {
    const window = resolveHomeReportWindow(
      { from: '2026-07-17T00:00:00', to: '2026-07-18T00:00:00' },
      PARIS,
    )

    expect(window.from.toInstant().toString()).toBe('2026-07-16T22:00:00Z')
    expect(window.to.toInstant().toString()).toBe('2026-07-17T22:00:00Z')
  })

  it('keeps offset-bearing dates at their absolute instant', () => {
    const window = resolveHomeReportWindow(
      { from: '2026-07-17T00:00:00Z', to: '2026-07-18T00:00:00Z' },
      PARIS,
    )

    expect(window.from.toInstant().toString()).toBe('2026-07-17T00:00:00Z')
    expect(window.from.timeZoneId).toBe(PARIS)
  })

  it('defaults to a retention-bounded window ending now', () => {
    const window = resolveHomeReportWindow(undefined, PARIS)

    expect(window.to.toInstant().toString()).toBe('2026-07-18T20:00:00Z')
    expect(
      window.from
        .until(window.to)
        .total({ relativeTo: window.from, unit: 'days' }),
    ).toBe(92)
  })

  it('clamps a Classic-style epoch start to the retention span', () => {
    const window = resolveHomeReportWindow({ from: '1970-01-01' }, PARIS)

    expect(
      window.from
        .until(window.to)
        .total({ relativeTo: window.from, unit: 'days' }),
    ).toBe(92)
  })
})

describe(resolveHomeHourWindow, () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(Temporal.Instant.from(NOW_ISO).epochMilliseconds)
    mockTemporalNowZoned()
  })

  afterEach(() => {
    vi.mocked(Temporal.Now.zonedDateTimeISO).mockRestore()
    vi.useRealTimers()
  })

  it('resolves the requested hour of today in the display timezone', () => {
    const window = resolveHomeHourWindow(9, PARIS)

    expect(window.from.toString()).toBe(
      '2026-07-18T09:00:00+02:00[Europe/Paris]',
    )
    expect(window.to.toString()).toBe('2026-07-18T10:00:00+02:00[Europe/Paris]')
  })

  it('defaults to the current hour', () => {
    const window = resolveHomeHourWindow(undefined, PARIS)

    expect(window.from.toString()).toBe(
      '2026-07-18T22:00:00+02:00[Europe/Paris]',
    )
  })
})

describe.concurrent(splitHomeReportWindow, () => {
  it('keeps a window within the chunk cap whole', () => {
    const window = resolveHomeReportWindow(
      { from: '2026-06-18T00:00:00', to: '2026-07-18T00:00:00' },
      'UTC',
    )

    expect(splitHomeReportWindow(window)).toStrictEqual([window])
  })

  it('splits a wide window into contiguous 30-day chunks', () => {
    const window = resolveHomeReportWindow(
      { from: '2026-04-19T00:00:00', to: '2026-07-18T00:00:00' },
      'UTC',
    )

    const chunks = splitHomeReportWindow(window)

    expect(
      chunks.map(({ from, to }) => [
        from.toPlainDateTime().toString(),
        to.toPlainDateTime().toString(),
      ]),
    ).toStrictEqual([
      ['2026-04-19T00:00:00', '2026-05-19T00:00:00'],
      ['2026-05-19T00:00:00', '2026-06-18T00:00:00'],
      ['2026-06-18T00:00:00', '2026-07-18T00:00:00'],
    ])
  })

  it('clips the last chunk to the window end', () => {
    const window = resolveHomeReportWindow(
      { from: '2026-06-13T00:00:00', to: '2026-07-18T00:00:00' },
      'UTC',
    )

    const chunks = splitHomeReportWindow(window)

    expect(chunks).toHaveLength(2)
    expect(chunks[1]?.to.toPlainDateTime().toString()).toBe(
      '2026-07-18T00:00:00',
    )
  })
})

describe.concurrent(toHomeReportPeriod, () => {
  it('falls back to the whole window when it is empty', () => {
    const window = resolveHomeReportWindow(
      { from: '2026-07-18T00:00:00', to: '2026-07-18T00:00:00' },
      'UTC',
    )

    expect(splitHomeReportWindow(window)).toStrictEqual([window])
  })

  it.each([
    { expected: 'Hourly', from: '2026-07-11T00:00:00' },
    { expected: 'Weekly', from: '2026-07-10T00:00:00' },
  ])('requests $expected from $from', ({ expected, from }) => {
    const window = resolveHomeReportWindow(
      { from, to: '2026-07-18T00:00:00' },
      'UTC',
    )

    expect(toHomeReportPeriod(window)).toBe(expected)
  })
})

describe.concurrent(mergeHomeReportChunks, () => {
  it('passes a single chunk through untouched', () => {
    const single = [report()]

    expect(mergeHomeReportChunks([single])).toStrictEqual(single)
  })

  it('concatenates samples per id and deduplicates boundary spans', () => {
    const boundarySpan = {
      label: `${OVERLAY_PREFIX}HOT_WATER`,
      xMax: '2026-07-01T01:00:00',
      xMin: '2026-06-30T23:00:00',
    }
    const merged = mergeHomeReportChunks([
      [
        report({
          annotations: [boundarySpan],
          datasets: [
            {
              data: [
                homeReportPoint('2026-06-30T12:00:00', 20),
                homeReportPoint('2026-06-30T23:59:00', 21),
              ],
              id: 'room_temperature',
              label: 'first',
            },
          ],
          previousTriggers: [
            {
              measure: 'room_temperature',
              trigger: '2026-06-29T00:00:00',
              value: 19,
            },
          ],
        }),
      ],
      [
        report({
          // The BFF returns the same boundary-crossing span to both
          // adjacent chunks: it must merge to ONE annotation.
          annotations: [boundarySpan],
          datasets: [
            {
              data: [
                homeReportPoint('2026-06-30T23:59:00', 21),
                homeReportPoint('2026-07-01T12:00:00', 22),
              ],
              id: 'room_temperature',
              label: 'second',
            },
          ],
        }),
      ],
    ])

    expect(merged).toHaveLength(1)

    const [result] = merged

    expect(result?.annotations).toStrictEqual([boundarySpan])
    expect(result?.datasets).toHaveLength(1)
    expect(result?.datasets[0]?.data).toStrictEqual([
      homeReportPoint('2026-06-30T12:00:00', 20),
      homeReportPoint('2026-06-30T23:59:00', 21),
      homeReportPoint('2026-07-01T12:00:00', 22),
    ])
    // LOCF seeds come from the oldest chunk.
    expect(result?.previousTriggers).toStrictEqual([
      {
        measure: 'room_temperature',
        trigger: '2026-06-29T00:00:00',
        value: 19,
      },
    ])
  })

  it('keeps unlabelled missing-data spans distinct while merging', () => {
    const grey = { xMax: '2026-07-01T02:00:00', xMin: '2026-07-01T01:00:00' }
    const merged = mergeHomeReportChunks([
      [report({ annotations: [grey] })],
      [report({ annotations: [grey] })],
      // A chunk with no annotations key at all contributes nothing.
      [report()],
    ])

    expect(merged[0]?.annotations).toStrictEqual([grey])
  })
})

describe.concurrent(toHomeWireWindow, () => {
  it('serializes the window bounds as ISO instants', () => {
    const window = resolveHomeReportWindow(
      { from: '2026-07-17T00:00:00', to: '2026-07-18T12:30:00' },
      PARIS,
    )

    expect(toHomeWireWindow(window)).toStrictEqual({
      from: '2026-07-16T22:00:00Z',
      to: '2026-07-18T10:30:00Z',
    })
  })
})

describe.concurrent(toHomeLineOptions, () => {
  it('resamples irregular samples onto an hourly LOCF grid', () => {
    const options = toHomeLineOptions({
      reports: [
        report({
          datasets: [
            {
              data: [
                homeReportPoint('2026-07-17T00:30:00', 20),
                homeReportPoint('2026-07-17T02:10:00', 21.5),
              ],
              id: 'room_temperature',
              label: 'ignored',
            },
          ],
        }),
      ],
      unit: '°C',
      window: utcDayWindow,
    })

    expect(options.unit).toBe('°C')
    expect(options.labels).toHaveLength(25)

    const [series] = options.series

    expect(series?.name).toBe('RoomTemperature')
    // Null before the first sample, then LOCF: 20 from 01:00, 21.5 from 03:00.
    expect(series?.data.slice(0, 4)).toStrictEqual([null, 20, 20, 21.5])
    expect(series?.data.at(-1)).toBe(21.5)
  })

  it('switches to a daily grid beyond seven days', () => {
    const window = resolveHomeReportWindow(
      { from: '2026-07-01T00:00:00', to: '2026-07-18T00:00:00' },
      'UTC',
    )
    const options = toHomeLineOptions({
      reports: [report()],
      unit: '°C',
      window,
    })

    expect(options.labels).toHaveLength(18)
  })

  it('honors the minute grid override', () => {
    const window = resolveHomeReportWindow(
      { from: '2026-07-17T09:00:00', to: '2026-07-17T10:00:00' },
      'UTC',
    )
    const options = toHomeLineOptions({
      gridUnit: 'minute',
      reports: [report()],
      unit: '°C',
      window,
    })

    expect(options.labels).toHaveLength(61)
  })

  it('lets a populated later dataset win over an empty earlier one', () => {
    const options = toHomeLineOptions({
      reports: [
        report({
          datasets: [
            { data: [], id: 'tank_water_temperature', label: 'comfort' },
          ],
        }),
        report({
          datasets: [
            {
              data: [homeReportPoint('2026-07-17T01:00:00', 49)],
              id: 'tank_water_temperature',
              label: 'internal',
            },
          ],
        }),
      ],
      unit: '°C',
      window: utcDayWindow,
    })

    expect(options.series).toHaveLength(1)
    expect(options.series[0]?.data.at(-1)).toBe(49)
  })

  it('keeps the first copy when both reports carry the series', () => {
    const options = toHomeLineOptions({
      reports: [
        report({
          datasets: [
            {
              data: [homeReportPoint('2026-07-17T01:00:00', 49)],
              id: 'tank_water_temperature',
              label: 'comfort',
            },
          ],
        }),
        report({
          datasets: [
            {
              data: [homeReportPoint('2026-07-17T01:00:00', 51)],
              id: 'tank_water_temperature',
              label: 'internal',
            },
          ],
        }),
      ],
      unit: '°C',
      window: utcDayWindow,
    })

    expect(options.series).toHaveLength(1)
    expect(options.series[0]?.data.at(-1)).toBe(49)
  })

  it('drops series with no samples at all', () => {
    const options = toHomeLineOptions({
      reports: [
        report({
          datasets: [{ data: [], id: 'flow_temperature_boiler', label: '' }],
        }),
      ],
      unit: '°C',
      window: utcDayWindow,
    })

    expect(options.series).toHaveLength(0)
  })

  it('seeds sparse series with their pre-window trigger sample', () => {
    const options = toHomeLineOptions({
      reports: [
        report({
          datasets: [
            {
              data: [homeReportPoint('2026-07-17T14:00:00', 18)],
              id: 'set_temperature_zone1',
              label: '',
            },
          ],
          previousTriggers: [
            {
              measure: 'set_temperature_zone1',
              trigger: '2026-07-15T08:00:00',
              value: 22.5,
            },
            {
              measure: 'set_tank_water_temperature',
              trigger: '9999-12-31T23:59:59',
              value: null,
            },
          ],
        }),
      ],
      unit: '°C',
      window: utcDayWindow,
    })

    const [series] = options.series

    // The trigger seed covers the window start; the sample takes over.
    expect(series?.data[0]).toBe(22.5)
    expect(series?.data.at(-1)).toBe(18)
  })

  it('projects labelled mode annotations into clipped grid bands', () => {
    const options = toHomeLineOptions({
      reports: [
        report({
          annotations: [
            {
              label: `${OVERLAY_PREFIX}HOT_WATER`,
              xMax: '2026-07-17T03:30:00',
              xMin: '2026-07-17T01:30:00',
            },
            // Unlabelled: a missing-data range, never a band.
            { xMax: '2026-07-17T06:00:00', xMin: '2026-07-17T05:00:00' },
            // Outside the window entirely.
            {
              label: `${OVERLAY_PREFIX}HEATING`,
              xMax: '2026-07-16T02:00:00',
              xMin: '2026-07-16T01:00:00',
            },
          ],
          datasets: [
            {
              data: [homeReportPoint('2026-07-17T00:00:00', 49)],
              id: 'tank_water_temperature',
              label: '',
            },
          ],
        }),
      ],
      unit: '°C',
      window: utcDayWindow,
    })

    expect(options.bands).toStrictEqual([{ from: 1, label: 'HotWater', to: 3 }])
  })

  it('omits the bands key when no mode annotation intersects', () => {
    const options = toHomeLineOptions({
      reports: [report()],
      unit: '°C',
      window: utcDayWindow,
    })

    expect(options.bands).toBeUndefined()
  })

  it('formats axis labels with the provided locale', () => {
    const options = toHomeLineOptions({
      locale: 'fr-FR',
      reports: [report()],
      unit: '°C',
      window: resolveHomeReportWindow(
        { from: '2026-07-16T00:00:00', to: '2026-07-18T00:00:00' },
        'UTC',
      ),
    })

    expect(options.labels[0]).toBe('16 juil., 00:00')
  })
})

describe.concurrent(toHomeOperationModeOptions, () => {
  it('sums clipped mode durations and fills the idle remainder', () => {
    const options = toHomeOperationModeOptions(
      [
        report({
          annotations: [
            {
              label: `${OVERLAY_PREFIX}HOT_WATER`,
              xMax: '2026-07-17T03:00:00',
              xMin: '2026-07-16T21:00:00',
            },
            {
              label: `${OVERLAY_PREFIX}COOLING`,
              xMax: '2026-07-17T18:00:00',
              xMin: '2026-07-17T12:00:00',
            },
            { xMax: '2026-07-17T06:00:00', xMin: '2026-07-17T05:00:00' },
          ],
        }),
      ],
      utcDayWindow,
    )

    expect(options.labels).toStrictEqual([
      'Stop',
      'HotWater',
      'Heating',
      'Cooling',
      'FreezeStat',
      'LegionellaPrevention',
    ])
    // HotWater clipped to 3h, Cooling 6h, Stop the remaining 15h.
    expect(options.series).toStrictEqual([0.625, 0.125, 0, 0.25, 0, 0])
  })

  it('accumulates repeated spans of the same mode', () => {
    const options = toHomeOperationModeOptions(
      [
        report({
          annotations: [
            {
              label: `${OVERLAY_PREFIX}COOLING`,
              xMax: '2026-07-17T02:00:00',
              xMin: '2026-07-17T01:00:00',
            },
            {
              label: `${OVERLAY_PREFIX}COOLING`,
              xMax: '2026-07-17T05:00:00',
              xMin: '2026-07-17T03:00:00',
            },
          ],
        }),
      ],
      utcDayWindow,
    )

    // 1h + 2h of cooling out of 24.
    expect(options.series[3]).toBeCloseTo(3 / 24)
  })

  it('charts a full idle window when nothing is annotated', () => {
    const options = toHomeOperationModeOptions(
      [
        report(),
        report({
          annotations: [
            // Fully outside the window: contributes nothing.
            {
              label: `${OVERLAY_PREFIX}HEATING`,
              xMax: '2026-07-16T02:00:00',
              xMin: '2026-07-16T01:00:00',
            },
          ],
        }),
      ],
      utcDayWindow,
    )

    expect(options.series[0]).toBeCloseTo(1)
    expect(options.series.slice(1)).toStrictEqual([0, 0, 0, 0, 0])
  })

  it('appends unknown overlay modes after the Classic order', () => {
    const options = toHomeOperationModeOptions(
      [
        report({
          annotations: [
            {
              label: `${OVERLAY_PREFIX}FROST_PROTECTION`,
              xMax: '2026-07-17T12:00:00',
              xMin: '2026-07-17T00:00:00',
            },
          ],
        }),
      ],
      utcDayWindow,
    )

    expect(options.labels.at(-1)).toBe('FrostProtection')
    expect(options.series.at(-1)).toBe(0.5)
  })
})

describe.concurrent(toHomeEnergyOptions, () => {
  it('densifies sparse buckets to zero and applies the scale', () => {
    const options = toHomeEnergyOptions({
      sources: [
        {
          data: {
            measureData: [
              {
                type: 'cumulative_energy_consumed_since_last_upload',
                values: [
                  { time: '2026-07-15 00:00:00.000000000', value: '0.0' },
                  { time: '2026-07-17 00:00:00.000000000', value: '571.0' },
                ],
              },
            ],
          },
          name: 'Consumed',
          scale: 0.001,
        },
      ],
      window: resolveHomeReportWindow(
        { from: '2026-07-14T00:00:00', to: '2026-07-18T00:00:00' },
        'UTC',
      ),
    })

    expect(options.unit).toBe('kWh')
    expect(options.labels).toHaveLength(5)

    const [consumed] = options.series

    // Scale in watt-hours to sidestep the 571 × 0.001 float artifact.
    expect(
      consumed?.data.map((value) =>
        value === null ? value : Math.round(value * 1000),
      ),
    ).toStrictEqual([0, 0, 0, 571, 0])
  })

  it('charts one series per source', () => {
    const bucket = { time: '2026-07-17 00:00:00.000000000', value: '2.5' }
    const options = toHomeEnergyOptions({
      sources: [
        {
          data: { measureData: [{ type: 'consumed', values: [bucket] }] },
          name: 'Consumed',
          scale: 1,
        },
        {
          data: { measureData: [{ type: 'produced', values: [bucket] }] },
          name: 'Produced',
          scale: 1,
        },
      ],
      window: utcDayWindow,
    })

    expect(options.series.map(({ name }) => name)).toStrictEqual([
      'Consumed',
      'Produced',
    ])
  })
})

describe.concurrent(toHomeSignalOptions, () => {
  it('resamples string-valued RSSI onto the minute grid', () => {
    const window = resolveHomeReportWindow(
      { from: '2026-07-17T09:00:00', to: '2026-07-17T10:00:00' },
      'UTC',
    )
    const options = toHomeSignalOptions({
      data: {
        measureData: [
          {
            type: 'rssi',
            values: [
              { time: '2026-07-17 08:58:00.000000000', value: '-70' },
              { time: '2026-07-17 09:30:30.000000000', value: '-66' },
            ],
          },
        ],
      },
      name: 'Garage',
      window: { from: window.from, to: window.to },
    })

    expect(options.unit).toBe('dBm')
    expect(options.labels).toHaveLength(61)

    const [series] = options.series

    expect(series?.name).toBe('Garage')
    expect(series?.data[0]).toBe(-70)
    expect(series?.data.at(-1)).toBe(-66)
  })
})
