import { cast, mockTemporalNowZoned } from '@olivierzal/api-core/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EntityNotFoundError } from '../../src/errors/index.ts'
import { HomeDeviceAtwFacade } from '../../src/facades/home-device-atw.ts'
import { Temporal } from '../../src/temporal.ts'
import { type HomeAtwDeviceCapabilities, ok } from '../../src/types/index.ts'
import { okValue } from '../helpers.ts'
import {
  createMockHomeApi,
  homeAtwDevice,
  homeEnergyReport,
  homeReportPoint,
  pruneHomeDevice,
  resetHomeDevices,
} from '../home-fixtures.ts'

// The unit's own zone, UTC+1 in winter and UTC+2 in summer: every
// combined-energy label is read on that clock, and every request opens
// on one of its midnights.
const BRUSSELS = 'Europe/Brussels'

const createModel = (
  settings: Record<string, string> = {},
  capabilities: Partial<HomeAtwDeviceCapabilities> = {},
): ReturnType<typeof homeAtwDevice> =>
  homeAtwDevice({
    capabilities,
    id: 'atw-1',
    name: 'Test ATW',
    rssi: -50,
    settings,
    timeZone: BRUSSELS,
  })

const epochMs = (instant: string): number =>
  Temporal.Instant.from(instant).epochMilliseconds

// The combined-energy requests a read made, one `[from, to, period]`
// per request in call order: where the requests fall on the unit's
// calendar is what the cases pin.
const requestedPeriods = (
  api: ReturnType<typeof createMockHomeApi>,
): string[][] =>
  vi
    .mocked(api.getAtwEnergy)
    .mock.calls.map(([, { from, period, to }]) => [from, to, period])

describe('home device atw facade', () => {
  beforeEach(resetHomeDevices)

  describe('normalized modes', () => {
    it.each([
      ['CoolFlowTemperature', 'flow_cool'],
      ['CoolRoomTemperature', 'room_cool'],
      ['CoolThermostat', 'room_cool'],
      ['HeatCurve', 'curve'],
      ['HeatFlowTemperature', 'flow'],
      ['HeatRoomTemperature', 'room'],
      ['HeatThermostat', 'room'],
      ['SomeNewFtcMode', 'room'],
    ])('normalizes zone mode %s to %s', (wire, expected) => {
      const facade = new HomeDeviceAtwFacade(
        createMockHomeApi(),
        createModel({ OperationModeZone1: wire }),
      )

      expect(facade.operationModeZone1).toBe(expected)
    })

    it('degrades an unknown zone-2 mode to room on a two-zone unit', () => {
      const facade = new HomeDeviceAtwFacade(
        createMockHomeApi(),
        createModel(
          { OperationModeZone2: 'SomeNewFtcMode' },
          { hasZone2: true },
        ),
      )

      expect(facade.operationModeZone2).toBe('room')
    })

    it.each([
      ['Cooling', 'cooling'],
      ['Defrost', 'defrost'],
      ['Heating', 'heating'],
      ['HotWater', 'dhw'],
      ['Idle', 'idle'],
      ['LegionellaPrevention', 'legionella'],
      ['Stop', 'idle'],
    ])('derives the operational state %s as %s', (wire, expected) => {
      const facade = new HomeDeviceAtwFacade(
        createMockHomeApi(),
        createModel({ OperationMode: wire }),
      )

      expect(facade.operationalState).toBe(expected)
    })

    it.each([
      ['Cooling', 'cooling'],
      ['Defrost', 'defrost'],
      ['Heating', 'heating'],
      ['HotWater', 'idle'],
      ['Idle', 'idle'],
      ['LegionellaPrevention', 'idle'],
      ['SomeNewFtcMode', 'idle'],
      ['Stop', 'idle'],
    ])('projects the zone-1 state of %s as %s', (wire, expected) => {
      const facade = new HomeDeviceAtwFacade(
        createMockHomeApi(),
        createModel({ OperationMode: wire }),
      )

      expect(facade.operationalStateZone1).toBe(expected)
    })

    it('mirrors the zone-1 projection on zone 2 when present', () => {
      const facade = new HomeDeviceAtwFacade(
        createMockHomeApi(),
        createModel({ OperationMode: 'Heating' }, { hasZone2: true }),
      )

      expect(facade.operationalStateZone2).toBe('heating')
    })

    it('reads a null zone-2 state on a single-zone unit', () => {
      const facade = new HomeDeviceAtwFacade(
        createMockHomeApi(),
        createModel({ OperationMode: 'Heating' }, { hasZone2: false }),
      )

      expect(facade.operationalStateZone2).toBeNull()
    })

    it('reads a null operational state for an unknown mode', () => {
      const facade = new HomeDeviceAtwFacade(
        createMockHomeApi(),
        createModel({ OperationMode: 'SomeNewFtcMode' }),
      )

      expect(facade.operationalState).toBeNull()
    })
  })

  describe('settings accessors', () => {
    it('reads power, standby, and operation mode from settings', () => {
      const facade = new HomeDeviceAtwFacade(
        createMockHomeApi(),
        createModel({
          InStandbyMode: 'False',
          OperationMode: 'Stop',
          Power: 'True',
        }),
      )

      expect(facade.power).toBe(true)
      expect(facade.inStandbyMode).toBe(false)
      expect(facade.operationMode).toBe('Stop')
    })

    it('reads each zone snapshot off its own settings', () => {
      const facade = new HomeDeviceAtwFacade(
        createMockHomeApi(),
        createModel(
          {
            OperationModeZone1: 'HeatRoomTemperature',
            OperationModeZone2: 'CoolRoomTemperature',
            RoomTemperatureZone1: '21',
            RoomTemperatureZone2: '19',
            SetTemperatureZone1: '22',
            SetTemperatureZone2: '20',
          },
          { hasZone2: true },
        ),
      )
      const { zone2 } = facade

      expect(facade.zone1.operationMode).toBe('room')
      expect(facade.zone1.roomTemperature).toBe(21)
      expect(facade.zone1.setTemperature).toBe(22)
      expect(zone2?.operationMode).toBe('room_cool')
      expect(zone2?.roomTemperature).toBe(19)
      expect(zone2?.setTemperature).toBe(20)
    })

    it('reads the setpoint step from the advertised increment', () => {
      const facade = new HomeDeviceAtwFacade(
        createMockHomeApi(),
        createModel({}, { temperatureIncrement: 0.5 }),
      )

      expect(facade.temperatureStep).toBe(0.5)
    })

    it('reads zone-1 temperatures and setpoint as numbers', () => {
      const facade = new HomeDeviceAtwFacade(
        createMockHomeApi(),
        createModel({
          OperationModeZone1: 'HeatRoomTemperature',
          RoomTemperatureZone1: '19.5',
          SetTemperatureZone1: '18',
        }),
      )

      expect(facade.operationModeZone1).toBe('room')
      expect(facade.roomTemperatureZone1).toBe(19.5)
      expect(facade.setTemperatureZone1).toBe(18)
    })

    it('returns null for zone-2 accessors when capabilities.hasZone2 is false', () => {
      const facade = new HomeDeviceAtwFacade(
        createMockHomeApi(),
        createModel(
          { RoomTemperatureZone2: '20', SetTemperatureZone2: '21' },
          { hasZone2: false },
        ),
      )

      expect(facade.operationModeZone2).toBeNull()
      expect(facade.roomTemperatureZone2).toBeNull()
      expect(facade.setTemperatureZone2).toBeNull()
    })

    it('exposes zone-2 accessors when capabilities.hasZone2 is true', () => {
      const facade = new HomeDeviceAtwFacade(
        createMockHomeApi(),
        createModel(
          {
            OperationModeZone2: 'CoolRoomTemperature',
            RoomTemperatureZone2: '22.5',
            SetTemperatureZone2: '21',
          },
          { hasZone2: true },
        ),
      )

      expect(facade.operationModeZone2).toBe('room_cool')
      expect(facade.roomTemperatureZone2).toBe(22.5)
      expect(facade.setTemperatureZone2).toBe(21)
    })

    it('reads tank, outdoor, and hot-water flags', () => {
      const facade = new HomeDeviceAtwFacade(
        createMockHomeApi(),
        createModel({
          ForcedHotWaterMode: 'True',
          HasCoolingMode: 'True',
          OutdoorTemperature: '12',
          ProhibitHotWater: 'False',
          SetTankWaterTemperature: '50',
          TankWaterTemperature: '25',
        }),
      )

      expect(facade.tankWaterTemperature).toBe(25)
      expect(facade.setTankWaterTemperature).toBe(50)
      expect(facade.outdoorTemperature).toBe(12)
      expect(facade.forcedHotWaterMode).toBe(true)
      expect(facade.prohibitHotWater).toBe(false)
      expect(facade.hasCoolingMode).toBe(true)
    })

    it.each([
      {
        expected: 'dhw',
        label: 'forced production wins',
        settings: { ForcedHotWaterMode: 'True', ProhibitHotWater: 'True' },
      },
      {
        expected: 'prohibited',
        label: 'prohibit flag',
        settings: { ForcedHotWaterMode: 'False', ProhibitHotWater: 'True' },
      },
      {
        expected: 'dhw',
        label: 'active DHW production',
        settings: { OperationMode: 'HotWater' },
      },
      {
        expected: 'legionella',
        label: 'legionella cycle',
        settings: { OperationMode: 'LegionellaPrevention' },
      },
      {
        expected: 'idle',
        label: 'any other operation mode',
        settings: { OperationMode: 'Cooling' },
      },
      { expected: 'idle', label: 'absent operation mode', settings: {} },
    ])(
      'derives the hot-water operational state ($label)',
      ({ expected, settings }) => {
        const facade = new HomeDeviceAtwFacade(
          createMockHomeApi(),
          createModel(settings),
        )

        expect(facade.hotWaterOperationalState).toBe(expected)
      },
    )
  })

  describe('updateValues', () => {
    it('drops undefined-valued keys before forwarding', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtwFacade(api, createModel())

      await facade.updateValues(
        cast({ power: false, setTemperatureZone1: undefined }),
      )

      expect(vi.mocked(api.updateValues).mock.lastCall?.[1]).toStrictEqual({
        power: false,
      })
    })

    it('clamps zone-1 setpoint to capability bounds before forwarding', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtwFacade(
        api,
        createModel({}, { maxSetTemperature: 28, minSetTemperature: 12 }),
      )

      await facade.updateValues({ setTemperatureZone1: 60 })

      expect(api.updateValues).toHaveBeenCalledWith('atw-1', {
        setTemperatureZone1: 28,
      })
    })

    it('clamps zone-2 setpoint to capability bounds before forwarding', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtwFacade(
        api,
        createModel({}, { maxSetTemperature: 28, minSetTemperature: 12 }),
      )

      await facade.updateValues({ setTemperatureZone2: 5 })

      expect(api.updateValues).toHaveBeenCalledWith('atw-1', {
        setTemperatureZone2: 12,
      })
    })

    it('clamps tank setpoint to tank-temperature bounds', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtwFacade(
        api,
        createModel(
          {},
          { maxSetTankTemperature: 55, minSetTankTemperature: 35 },
        ),
      )

      await facade.updateValues({ setTankWaterTemperature: 10 })

      expect(api.updateValues).toHaveBeenCalledWith('atw-1', {
        setTankWaterTemperature: 35,
      })
    })

    it('forwards non-temperature fields unchanged', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtwFacade(api, createModel())

      await facade.updateValues({
        forcedHotWaterMode: true,
        operationModeZone1: 'room',
        power: false,
      })

      expect(api.updateValues).toHaveBeenCalledWith('atw-1', {
        forcedHotWaterMode: true,
        operationModeZone1: 'room',
        power: false,
      })
    })
  })

  describe('updatePower', () => {
    it('forwards a power-only payload, defaulting to on', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtwFacade(api, createModel())

      await facade.updatePower()

      expect(api.updateValues).toHaveBeenCalledWith('atw-1', { power: true })
    })

    it('powers off when passed false', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtwFacade(api, createModel())

      await facade.updatePower(false)

      expect(api.updateValues).toHaveBeenCalledWith('atw-1', { power: false })
    })
  })

  describe('ownership', () => {
    it('exposes isOwner from the backing model', () => {
      const owned = new HomeDeviceAtwFacade(createMockHomeApi(), createModel())

      expect(owned.isOwner).toBe(true)

      const guest = new HomeDeviceAtwFacade(
        createMockHomeApi(),
        homeAtwDevice({ id: 'atw-1' }, false),
      )

      expect(guest.isOwner).toBe(false)
    })
  })

  describe('telemetry passthroughs', () => {
    // The shapes are the wire's own (live-probed 2026-11-21): labels on
    // the unit's wall clock, idle hours left out, the hour in progress
    // last, an outdoor-temperature dataset beside the two energy ones.
    it('reads the hourly energy of both directions in one request per day of the unit', async () => {
      const api = createMockHomeApi()
      vi.mocked(api.getAtwEnergy).mockResolvedValue(
        ok([
          homeEnergyReport({
            interval_energy_consumed: [
              ['2026-11-21T00:00:00', 0.5],
              ['2026-11-21T01:00:00', 0.25],
              ['2026-11-21T07:00:00', 0.125],
            ],
            interval_energy_produced: [
              ['2026-11-21T01:00:00', 2],
              ['2026-11-21T07:00:00', 1.5],
            ],
            outside_temperature: [['2026-11-21T07:00:00', 3.5]],
          }),
        ]),
      )
      const facade = new HomeDeviceAtwFacade(api, createModel())

      const series = okValue(
        await facade.getEnergySeries({
          from: '2026-11-21T00:30:00Z',
          to: '2026-11-21T06:51:00Z',
        }),
      )

      // One day of the unit, midnight to midnight on its own clock.
      expect(api.getAtwEnergy).toHaveBeenCalledExactlyOnceWith('atw-1', {
        from: '2026-11-20T23:00:00Z',
        period: 'Daily',
        to: '2026-11-21T23:00:00Z',
      })
      // The 00:00 bucket closed at 00:00Z, before the window opens; the
      // 01:00 one holds its start, the 07:00 one is in progress.
      expect(series).toStrictEqual({
        consumed: [
          { atEpochMs: epochMs('2026-11-21T00:00:00Z'), kilowattHours: 0.25 },
          { atEpochMs: epochMs('2026-11-21T06:00:00Z'), kilowattHours: 0.125 },
        ],
        produced: [
          { atEpochMs: epochMs('2026-11-21T00:00:00Z'), kilowattHours: 2 },
          { atEpochMs: epochMs('2026-11-21T06:00:00Z'), kilowattHours: 1.5 },
        ],
      })
    })

    // Past one day the wire repeats a point at the midnight it crosses,
    // counted in its own totals (live-probed 2026-11-21): a window over
    // the unit's midnight is two requests, never one.
    it('reads a window across the midnight of the unit day by day, oldest first', async () => {
      const api = createMockHomeApi()
      vi.mocked(api.getAtwEnergy)
        .mockResolvedValueOnce(
          ok([
            homeEnergyReport({
              interval_energy_consumed: [['2026-11-20T23:00:00', 0.5]],
            }),
          ]),
        )
        .mockResolvedValueOnce(
          ok([
            homeEnergyReport({
              interval_energy_consumed: [['2026-11-21T00:00:00', 0.25]],
            }),
          ]),
        )
      const facade = new HomeDeviceAtwFacade(api, createModel())

      const { consumed, produced } = okValue(
        await facade.getEnergySeries({
          from: '2026-11-20T22:00:00Z',
          to: '2026-11-21T01:00:00Z',
        }),
      )

      expect(requestedPeriods(api)).toStrictEqual([
        ['2026-11-19T23:00:00Z', '2026-11-20T23:00:00Z', 'Daily'],
        ['2026-11-20T23:00:00Z', '2026-11-21T23:00:00Z', 'Daily'],
      ])
      expect(consumed.map(({ kilowattHours }) => kilowattHours)).toStrictEqual([
        0.5, 0.25,
      ])
      expect(produced).toStrictEqual([])
    })

    it.each([
      {
        dayKind: 'a window closing on the midnight of the unit',
        expected: { from: '2026-11-20T23:00:00Z', to: '2026-11-21T23:00:00Z' },
        query: { from: '2026-11-21T10:00:00Z', to: '2026-11-21T23:00:00Z' },
      },
      {
        // The clocks go back at 03:00: the day is 25 hours long.
        dayKind: 'the day the clocks go back',
        expected: { from: '2026-10-24T22:00:00Z', to: '2026-10-25T23:00:00Z' },
        query: { from: '2026-10-25T10:00:00Z', to: '2026-10-25T11:00:00Z' },
      },
    ])('asks one whole day for $dayKind', async ({ expected, query }) => {
      const api = createMockHomeApi()
      vi.mocked(api.getAtwEnergy).mockResolvedValue(ok([homeEnergyReport({})]))
      const facade = new HomeDeviceAtwFacade(api, createModel())

      okValue(await facade.getEnergySeries(query))

      expect(api.getAtwEnergy).toHaveBeenCalledExactlyOnceWith('atw-1', {
        ...expected,
        period: 'Daily',
      })
    })

    it('degrades a gap to a null energy and a garbled label to a null instant', async () => {
      const api = createMockHomeApi()
      vi.mocked(api.getAtwEnergy).mockResolvedValue(
        ok([
          homeEnergyReport({
            interval_energy_consumed: [
              ['2026-11-21T05:00:00', null],
              ['not-a-date', 0.5],
            ],
          }),
        ]),
      )
      const facade = new HomeDeviceAtwFacade(api, createModel())

      const { consumed } = okValue(
        await facade.getEnergySeries({
          from: '2026-11-21T00:00:00Z',
          to: '2026-11-21T08:00:00Z',
        }),
      )

      expect(consumed).toStrictEqual([
        { atEpochMs: epochMs('2026-11-21T04:00:00Z'), kilowattHours: null },
        { atEpochMs: null, kilowattHours: 0.5 },
      ])
    })

    it('answers the failure of a day for the whole series', async () => {
      const api = createMockHomeApi()
      const failure = { error: { kind: 'server' as const }, ok: false as const }
      vi.mocked(api.getAtwEnergy).mockResolvedValue(cast(failure))
      const facade = new HomeDeviceAtwFacade(api, createModel())

      await expect(
        facade.getEnergySeries({
          from: '2026-11-21T00:00:00Z',
          to: '2026-11-21T08:00:00Z',
        }),
      ).resolves.toBe(failure)
    })

    // The unit's zone lives on its registry model: an id the registry
    // dropped has no clock to read the labels on.
    it('rejects an energy read of an id the registry no longer holds', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtwFacade(api, createModel())
      pruneHomeDevice('atw-1')

      await expect(
        facade.getEnergySeries({
          from: '2026-11-21T00:00:00Z',
          to: '2026-11-21T08:00:00Z',
        }),
      ).rejects.toThrow(EntityNotFoundError)
      await expect(facade.getEnergyReport()).rejects.toThrow(
        EntityNotFoundError,
      )
      expect(api.getAtwEnergy).not.toHaveBeenCalled()
    })

    it('delegates the protection writes with its own ATW unit bucket', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtwFacade(api, createModel())

      await facade.updateFrostProtection({ isEnabled: true, max: 12, min: 6 })
      await facade.updateOverheatProtection({
        isEnabled: true,
        max: 37,
        min: 35,
      })

      expect(api.updateFrostProtection).toHaveBeenCalledWith({
        enabled: true,
        max: 12,
        min: 6,
        units: { ATW: ['atw-1'] },
      })
      expect(api.updateOverheatProtection).not.toHaveBeenCalled()
      expect(facade.supportsOverheat).toBe(false)
    })

    it('delegates getErrorLog and projects the neutral entries', async () => {
      const api = createMockHomeApi()
      vi.mocked(api.getErrorLog).mockResolvedValue(
        ok([
          {
            clearedTimestamp: '2026-03-02T08:00:00Z',
            errorCode: 'E9',
            errorReason: null,
            timestamp: '2026-03-01T06:00:00Z',
          },
        ]),
      )
      const facade = new HomeDeviceAtwFacade(api, createModel())
      const value = okValue(await facade.getErrorLog())

      expect(api.getErrorLog).toHaveBeenCalledWith('atw-1')
      expect(value).toStrictEqual([
        {
          at: '2026-03-01T06:00:00Z',
          atEpochMs: Temporal.Instant.from('2026-03-01T06:00:00Z')
            .epochMilliseconds,
          clearedAt: '2026-03-02T08:00:00Z',
          clearedAtEpochMs: Temporal.Instant.from('2026-03-02T08:00:00Z')
            .epochMilliseconds,
          code: 'E9',
          deviceId: 'atw-1',
        },
      ])
    })

    it('builds the internal-temperatures chart from its report', async () => {
      const api = createMockHomeApi()
      vi.mocked(api.getAtwInternalTemperatures).mockResolvedValue(
        ok([
          {
            datasets: [
              {
                data: [homeReportPoint('2026-05-09T01:00:00', 24)],
                id: 'flow_temperature',
                label: 'ignored',
              },
            ],
            reportPeriod: 'hourly',
          },
        ]),
      )
      const facade = new HomeDeviceAtwFacade(api, createModel())

      const value = okValue(
        await facade.getInternalTemperatures({
          from: '2026-05-09T00:00:00Z',
          to: '2026-05-10T00:00:00Z',
        }),
      )

      expect(api.getAtwInternalTemperatures).toHaveBeenCalledWith('atw-1', {
        from: '2026-05-09T00:00:00Z',
        period: 'Hourly',
        to: '2026-05-10T00:00:00Z',
      })
      expect(value.unit).toBe('°C')
      expect(value.series[0]?.name).toBe('FlowTemperature')
    })
  })

  describe('temperature charts', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(
        Temporal.Instant.from('2026-05-09T09:30:00Z').epochMilliseconds,
      )
      mockTemporalNowZoned()
    })

    afterEach(() => {
      vi.mocked(Temporal.Now.zonedDateTimeISO).mockRestore()
      vi.useRealTimers()
    })

    const comfortReport = {
      annotations: [
        {
          label: 'REPORT.COMFORT_GRAPH.OVERLAY_KEY.HOT_WATER',
          xMax: '2026-05-09T03:00:00',
          xMin: '2026-05-09T01:00:00',
        },
      ],
      datasets: [
        {
          data: [homeReportPoint('2026-05-09T00:30:00', 25)],
          id: 'room_temperature_zone1',
          label: 'ignored',
        },
        { data: [], id: 'tank_water_temperature', label: 'ignored' },
      ],
      reportPeriod: 0,
    }
    const internalReport = {
      datasets: [
        {
          data: [homeReportPoint('2026-05-09T00:15:00', 49)],
          id: 'tank_water_temperature',
          label: 'ignored',
        },
      ],
      reportPeriod: 'hourly',
    }

    it('merges comfort and internal series with mode bands', async () => {
      const api = createMockHomeApi()
      vi.mocked(api.getTemperatures).mockResolvedValue(ok([comfortReport]))
      vi.mocked(api.getAtwInternalTemperatures).mockResolvedValue(
        ok([internalReport]),
      )
      const facade = new HomeDeviceAtwFacade(api, createModel())

      const value = okValue(
        await facade.getTemperatures({
          from: '2026-05-09T00:00:00Z',
          to: '2026-05-10T00:00:00Z',
        }),
      )

      const params = {
        from: '2026-05-09T00:00:00Z',
        period: 'Hourly',
        to: '2026-05-10T00:00:00Z',
      }

      expect(api.getTemperatures).toHaveBeenCalledWith('atw-1', params)
      expect(api.getAtwInternalTemperatures).toHaveBeenCalledWith(
        'atw-1',
        params,
      )
      expect(value.series.map(({ name }) => name)).toStrictEqual([
        'RoomTemperatureZone1',
        'TankWaterTemperature',
      ])
      expect(value.bands).toStrictEqual([{ from: 1, label: 'HotWater', to: 3 }])
    })

    it('propagates a comfort-graph failure untouched', async () => {
      const api = createMockHomeApi()
      const failure = { ok: false as const, status: 500 }
      vi.mocked(api.getTemperatures).mockResolvedValue(cast(failure))
      vi.mocked(api.getAtwInternalTemperatures).mockResolvedValue(ok([]))
      const facade = new HomeDeviceAtwFacade(api, createModel())

      await expect(facade.getTemperatures()).resolves.toBe(failure)
    })

    it('propagates an internal-temperatures failure untouched', async () => {
      const api = createMockHomeApi()
      const failure = { ok: false as const, status: 500 }
      vi.mocked(api.getTemperatures).mockResolvedValue(ok([]))
      vi.mocked(api.getAtwInternalTemperatures).mockResolvedValue(cast(failure))
      const facade = new HomeDeviceAtwFacade(api, createModel())

      await expect(facade.getHourlyTemperatures(9)).resolves.toBe(failure)
    })

    it('builds one specific hour on a minute grid', async () => {
      const api = createMockHomeApi()
      vi.mocked(api.getTemperatures).mockResolvedValue(ok([comfortReport]))
      vi.mocked(api.getAtwInternalTemperatures).mockResolvedValue(ok([]))
      const facade = new HomeDeviceAtwFacade(api, createModel())

      const value = okValue(await facade.getHourlyTemperatures(9))

      expect(api.getTemperatures).toHaveBeenCalledWith('atw-1', {
        from: '2026-05-09T09:00:00Z',
        period: 'Hourly',
        to: '2026-05-09T10:00:00Z',
      })
      expect(value.labels).toHaveLength(61)
    })

    it('covers today on a five-minute grid when no hour is given', async () => {
      // Pin the label locale: the runner's default is not ours.
      const api = createMockHomeApi({ locale: 'fr-FR' })
      vi.mocked(api.getTemperatures).mockResolvedValue(ok([comfortReport]))
      vi.mocked(api.getAtwInternalTemperatures).mockResolvedValue(ok([]))
      const facade = new HomeDeviceAtwFacade(api, createModel())

      const value = okValue(await facade.getHourlyTemperatures())

      // Pinned to 09:30 UTC: the whole day on 5-minute slots, blank
      // after now.
      expect(api.getTemperatures).toHaveBeenCalledWith('atw-1', {
        from: '2026-05-09T00:00:00Z',
        period: 'Hourly',
        to: '2026-05-10T00:00:00Z',
      })
      expect(value.labels).toHaveLength(289)
      expect(value.labels[0]).toBe('00:00')
      // LOCF holds through now (09:30 = slot 114), blank afterwards.
      expect(value.series[0]?.data[114]).toBe(25)
      expect(value.series[0]?.data[115]).toBeNull()
    })

    it('chunks a wide window and merges the reports', async () => {
      const api = createMockHomeApi()
      vi.mocked(api.getTemperatures).mockResolvedValue(ok([comfortReport]))
      vi.mocked(api.getAtwInternalTemperatures).mockResolvedValue(ok([]))
      const facade = new HomeDeviceAtwFacade(api, createModel())

      const value = okValue(
        await facade.getTemperatures({
          from: '2026-03-01T00:00:00Z',
          to: '2026-05-09T00:00:00Z',
        }),
      )

      // 69 days sits beyond the band load budget: the comfort-graph
      // falls back to the fast 30-day Weekly chunking and the
      // truncated annotations are dropped instead of charted.
      expect(api.getTemperatures).toHaveBeenCalledTimes(3)
      expect(api.getTemperatures).toHaveBeenNthCalledWith(1, 'atw-1', {
        from: '2026-03-01T00:00:00Z',
        period: 'Weekly',
        to: '2026-03-31T00:00:00Z',
      })
      expect(api.getTemperatures).toHaveBeenNthCalledWith(3, 'atw-1', {
        from: '2026-04-30T00:00:00Z',
        period: 'Weekly',
        to: '2026-05-09T00:00:00Z',
      })
      expect(value.bands).toBeUndefined()
      // Identical chunk payloads merge to one deduplicated series.
      expect(value.series).toHaveLength(1)
    })

    it('drops the bands just beyond the hourly grid', async () => {
      const api = createMockHomeApi()
      vi.mocked(api.getTemperatures).mockResolvedValue(ok([comfortReport]))
      vi.mocked(api.getAtwInternalTemperatures).mockResolvedValue(ok([]))
      const facade = new HomeDeviceAtwFacade(api, createModel())

      const value = okValue(
        await facade.getTemperatures({
          from: '2026-04-25T00:00:00Z',
          to: '2026-05-10T00:00:00Z',
        }),
      )

      // 15 days renders on a daily grid, where bands inflate into a
      // solid wall: one fast Weekly call, annotations dropped.
      expect(api.getTemperatures).toHaveBeenCalledTimes(1)
      expect(api.getTemperatures).toHaveBeenCalledWith('atw-1', {
        from: '2026-04-25T00:00:00Z',
        period: 'Weekly',
        to: '2026-05-10T00:00:00Z',
      })
      expect(value.bands).toBeUndefined()
    })

    it('propagates a chunk failure untouched', async () => {
      const api = createMockHomeApi()
      const failure = { ok: false as const, status: 503 }
      vi.mocked(api.getTemperatures)
        .mockResolvedValueOnce(ok([comfortReport]))
        .mockResolvedValueOnce(cast(failure))
        .mockResolvedValue(ok([comfortReport]))
      vi.mocked(api.getAtwInternalTemperatures).mockResolvedValue(ok([]))
      const facade = new HomeDeviceAtwFacade(api, createModel())

      await expect(
        facade.getTemperatures({
          from: '2026-03-01T00:00:00Z',
          to: '2026-05-09T00:00:00Z',
        }),
      ).resolves.toBe(failure)
    })

    it('aggregates operation modes into Classic-shaped pie data', async () => {
      const api = createMockHomeApi()
      vi.mocked(api.getTemperatures).mockResolvedValue(ok([comfortReport]))
      const facade = new HomeDeviceAtwFacade(api, createModel())

      const value = okValue(
        await facade.getOperationModes({
          from: '2026-05-09T00:00:00Z',
          to: '2026-05-10T00:00:00Z',
        }),
      )

      expect(value.labels[0]).toBe('Stop')
      expect(value.labels[1]).toBe('HotWater')
      // 2 hours of hot water out of 24; the rest idles as Stop.
      expect(value.series[1]).toBeCloseTo(2 / 24)
      expect(value.series[0]).toBeCloseTo(22 / 24)
    })
  })

  describe('energy report', () => {
    it('charts consumed and produced hour buckets over one day', async () => {
      const api = createMockHomeApi({ locale: 'fr-FR', timezone: BRUSSELS })
      vi.mocked(api.getAtwEnergy).mockResolvedValue(
        ok([
          homeEnergyReport({
            interval_energy_consumed: [['2026-11-21T07:00:00', 2.5]],
            interval_energy_produced: [['2026-11-21T07:00:00', 13.5]],
          }),
        ]),
      )
      const facade = new HomeDeviceAtwFacade(api, createModel())

      const value = okValue(
        await facade.getEnergyReport({
          from: '2026-11-20T23:00:00Z',
          to: '2026-11-21T23:00:00Z',
        }),
      )

      expect(api.getAtwEnergy).toHaveBeenCalledExactlyOnceWith('atw-1', {
        from: '2026-11-20T23:00:00Z',
        period: 'Daily',
        to: '2026-11-21T23:00:00Z',
      })
      expect(value.unit).toBe('kWh')
      expect(value.series.map(({ name }) => name)).toStrictEqual([
        'Consumed',
        'Produced',
      ])
      // The 07:00 label of the unit is the eighth hour of its day.
      expect(value.labels[7]).toBe('07:00')
      expect(value.series[0]?.data[7]).toBe(2.5)
      expect(value.series[1]?.data[7]).toBe(13.5)
    })

    // Beyond a day the wire's own day buckets are charted, asked 28 days
    // at a time: past one month it repeats a point at each month it
    // crosses (live-probed 2026-11-21), and no month is shorter. A day
    // bucket is a calendar date of the unit's, so it charts under that
    // date even on a display clock far to the west.
    it('charts the day buckets of the unit beyond one day, 28 days per request', async () => {
      const api = createMockHomeApi({
        locale: 'fr-FR',
        timezone: 'America/New_York',
      })
      vi.mocked(api.getAtwEnergy)
        .mockResolvedValueOnce(
          ok([
            homeEnergyReport({
              interval_energy_consumed: [['2026-11-19T00:00:00', 5.75]],
              interval_energy_produced: [['2026-11-19T00:00:00', 30.25]],
            }),
          ]),
        )
        .mockResolvedValueOnce(
          ok([
            homeEnergyReport({
              interval_energy_consumed: [['2026-11-20T00:00:00', 2.5]],
            }),
          ]),
        )
      const facade = new HomeDeviceAtwFacade(api, createModel())

      const value = okValue(
        await facade.getEnergyReport({
          from: '2026-10-23T12:00:00Z',
          to: '2026-11-21T12:00:00Z',
        }),
      )

      expect(requestedPeriods(api)).toStrictEqual([
        ['2026-10-22T22:00:00Z', '2026-11-19T23:00:00Z', 'Monthly'],
        ['2026-11-19T23:00:00Z', '2026-11-21T23:00:00Z', 'Monthly'],
      ])

      const [consumedByLabel, producedByLabel] = value.series.map(({ data }) =>
        Object.fromEntries(
          value.labels.map((label, index) => [label, data[index]]),
        ),
      )

      expect(consumedByLabel).toMatchObject({
        '18 nov.': 0,
        '19 nov.': 5.75,
        '20 nov.': 2.5,
      })
      expect(producedByLabel).toMatchObject({ '19 nov.': 30.25, '20 nov.': 0 })
    })

    it('propagates an energy failure untouched', async () => {
      const api = createMockHomeApi()
      const failure = { ok: false as const, status: 429 }
      vi.mocked(api.getAtwEnergy).mockResolvedValue(cast(failure))
      const facade = new HomeDeviceAtwFacade(api, createModel())

      await expect(facade.getEnergyReport()).resolves.toBe(failure)
    })
  })
})
