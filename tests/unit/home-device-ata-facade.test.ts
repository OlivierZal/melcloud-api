import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ReportChartLineOptions,
  ReportQuery,
} from '../../src/facades/report-types.ts'
import { ClassicOperationMode } from '../../src/constants.ts'
import { EntityNotFoundError, NoChangesError } from '../../src/errors/index.ts'
import { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import { Temporal } from '../../src/temporal.ts'
import { type HomeAtaDeviceCapabilities, ok } from '../../src/types/index.ts'
import { cast, mockTemporalNowZoned, okValue } from '../helpers.ts'
import {
  createMockHomeApi,
  homeDevice,
  homeEnergyEnvelope,
  homeReportPoint,
  pruneHomeDevice,
  resetHomeDevices,
} from '../home-fixtures.ts'

const createModel = (
  settings: Record<string, string> = {},
  capabilities: Partial<HomeAtaDeviceCapabilities> = {},
  rssi = -50,
): ReturnType<typeof homeDevice> =>
  homeDevice({
    capabilities,
    id: 'device-1',
    name: 'Test ClassicDevice',
    rssi,
    settings,
  })

// Stage a consumption series behind `getEnergy` and chart it over
// `range`: the mechanism the energy-report cases share, each pinning
// its own bucket-policy assertions at the call site.
const chartEnergyReport = async (
  range: ReportQuery,
  values: Parameters<typeof homeEnergyEnvelope>[1],
  api: ReturnType<typeof createMockHomeApi> = createMockHomeApi(),
): Promise<ReportChartLineOptions> => {
  vi.mocked(api.getEnergy).mockResolvedValue(
    ok(
      homeEnergyEnvelope(
        'cumulative_energy_consumed_since_last_upload',
        values,
      ),
    ),
  )
  const facade = new HomeDeviceAtaFacade(api, createModel())
  return okValue(await facade.getEnergyReport(range))
}

describe('home device ata facade', () => {
  beforeEach(resetHomeDevices)

  describe('protection accessors', () => {
    it('keeps a freshly disconnected unit available within the persistence window', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        homeDevice({ id: 'device-1', isConnected: false }),
      )

      expect(facade.isAvailable).toBe(true)
    })

    it('reports the unit unavailable after a day of continuous disconnection, then clears on reconnect', () => {
      const device = homeDevice({ id: 'device-1', isConnected: false })
      const facade = new HomeDeviceAtaFacade(createMockHomeApi(), device)
      const later = Temporal.Now.plainDateTimeISO('UTC').add({ hours: 25 })
      const spy = vi
        .spyOn(Temporal.Now, 'plainDateTimeISO')
        .mockReturnValue(later)

      expect(facade.isAvailable).toBe(false)

      device.sync({ ...device.data, isConnected: true }, true, device.building)

      expect(facade.isAvailable).toBe(true)

      spy.mockRestore()
    })

    it('resolves the registry model by id, never a pinned snapshot', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        homeDevice({ id: 'device-1', isConnected: false }),
      )
      homeDevice({ id: 'device-1', isConnected: true })

      expect(facade.isAvailable).toBe(true)
    })

    it('reports existence and throws once the registry drops the id', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        homeDevice({ id: 'device-gone' }),
      )

      expect(facade.exists).toBe(true)

      pruneHomeDevice('device-gone')

      expect(facade.exists).toBe(false)
      expect(facade.id).toBe('device-gone')
      expect(() => facade.isAvailable).toThrow(EntityNotFoundError)
    })

    it('returns null when protection is not configured', async () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        homeDevice({ id: 'device-1' }),
      )

      expect(okValue(await facade.getFrostProtection())).toBeNull()
      expect(okValue(await facade.getHolidayMode())).toBeNull()
      expect(okValue(await facade.getOverheatProtection())).toBeNull()
    })
  })

  describe('settings accessors', () => {
    it('should read operation mode from settings', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        createModel({ OperationMode: 'Heat' }),
      )

      expect(facade.operationMode).toBe('Heat')
    })

    it('should read power as boolean', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        createModel({ Power: 'True' }),
      )

      expect(facade.power).toBe(true)
    })

    it('should read standby as boolean', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        createModel({ InStandbyMode: 'True', Power: 'True' }),
      )

      expect(facade.inStandbyMode).toBe(true)
    })

    it('should read temperatures as numbers', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        createModel({ RoomTemperature: '21.5', SetTemperature: '20' }),
      )

      expect(facade.roomTemperature).toBe(21.5)
      expect(facade.setTemperature).toBe(20)
    })

    it('should read fan speed and vane directions from settings', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        createModel({
          SetFanSpeed: 'Auto',
          VaneHorizontalDirection: 'Centre',
          VaneVerticalDirection: 'Swing',
        }),
      )

      expect(facade.setFanSpeed).toBe('Auto')
      expect(facade.vaneHorizontalDirection).toBe('Centre')
      expect(facade.vaneVerticalDirection).toBe('Swing')
    })

    it('should normalize numeric fan speed string from Home API', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        createModel({ SetFanSpeed: '0' }),
      )

      expect(facade.setFanSpeed).toBe('Auto')
    })

    it('should read rssi from device data', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        createModel({}, {}, -42),
      )

      expect(facade.rssi).toBe(-42)
    })

    it('should return defaults for missing settings', () => {
      const facade = new HomeDeviceAtaFacade(createMockHomeApi(), createModel())

      expect(facade.operationMode).toBe('')
      expect(facade.power).toBe(false)
      expect(facade.roomTemperature).toBe(0)
      expect(facade.setFanSpeed).toBe('Auto')
      expect(facade.vaneHorizontalDirection).toBe('')
      expect(facade.vaneVerticalDirection).toBe('')
    })

    it('should read device name', () => {
      const facade = new HomeDeviceAtaFacade(createMockHomeApi(), createModel())

      expect(facade.name).toBe('Test ClassicDevice')
    })

    it('should expose device capabilities', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        createModel({}, { minTempHeat: 8 }),
      )

      expect(facade.capabilities.minTempHeat).toBe(8)
    })
  })

  describe('updateValues validation', () => {
    it('should throw on empty values', async () => {
      const facade = new HomeDeviceAtaFacade(createMockHomeApi(), createModel())

      await expect(facade.updateValues({})).rejects.toThrow(
        new NoChangesError('device-1'),
      )
    })

    it('should treat explicitly-undefined values as absent', async () => {
      const facade = new HomeDeviceAtaFacade(createMockHomeApi(), createModel())

      await expect(
        facade.updateValues(cast({ setTemperature: undefined })),
      ).rejects.toThrow(new NoChangesError('device-1'))
    })

    it('should drop undefined-valued keys before forwarding', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(api, createModel())

      await facade.updateValues(
        cast({ power: true, setTemperature: undefined }),
      )

      expect(vi.mocked(api.updateValues).mock.lastCall?.[1]).toStrictEqual({
        power: true,
      })
    })
  })

  describe('updatePower', () => {
    it('forwards a power-only payload, defaulting to on', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(api, createModel())

      await facade.updatePower()

      expect(api.updateValues).toHaveBeenCalledWith('device-1', { power: true })
    })

    it('powers off when passed false', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(api, createModel())

      await facade.updatePower(false)

      expect(api.updateValues).toHaveBeenCalledWith('device-1', {
        power: false,
      })
    })
  })

  describe('temperature range and step', () => {
    it('should read the per-mode range from the device capabilities', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        createModel(
          { OperationMode: 'Heat' },
          { maxTempHeat: 31, minTempHeat: 10 },
        ),
      )

      expect(facade.getTemperatureRange()).toStrictEqual({ max: 31, min: 10 })

      expect(facade.getTemperatureRange('Cool')).toStrictEqual({
        max: 31,
        min: 16,
      })

      // The cross-dialect widening: a Classic numeric mode resolves
      // through the total bijection to the same range as its Home twin,
      // and an out-of-vocabulary number degrades to no-clamp.
      expect(
        facade.getTemperatureRange(ClassicOperationMode.cool),
      ).toStrictEqual({ max: 31, min: 16 })
      expect(facade.getTemperatureRange(cast(99))).toBeNull()

      expect(facade.getTemperatureRange(cast('Unknown'))).toBeNull()
    })

    // Mutation guard: the range follows the dialect fixture, so a bound
    // changed at the source changes what consumers render.
    it('should follow the advertised bounds', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        createModel(
          { OperationMode: 'Heat' },
          { maxTempHeat: 28, minTempHeat: 12 },
        ),
      )

      expect(facade.getTemperatureRange()).toStrictEqual({ max: 28, min: 12 })
    })

    it('should step by a half degree when the unit advertises it', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        createModel({}, { hasHalfDegreeIncrements: true }),
      )

      expect(facade.temperatureStep).toBe(0.5)
    })

    it('should step by a whole degree otherwise', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        createModel({}, { hasHalfDegreeIncrements: false }),
      )

      expect(facade.temperatureStep).toBe(1)
    })
  })

  describe('temperature clamping', () => {
    it('should clamp temperature to heat range', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(
        api,
        createModel(
          { OperationMode: 'Heat' },
          { maxTempHeat: 31, minTempHeat: 10 },
        ),
      )
      await facade.updateValues({ setTemperature: 5 })

      expect(api.updateValues).toHaveBeenCalledWith('device-1', {
        setTemperature: 10,
      })
    })

    it('should clamp temperature to cool range', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(
        api,
        createModel(
          { OperationMode: 'Cool' },
          { maxTempCoolDry: 31, minTempCoolDry: 16 },
        ),
      )
      await facade.updateValues({ setTemperature: 35 })

      expect(api.updateValues).toHaveBeenCalledWith('device-1', {
        setTemperature: 31,
      })
    })

    it('should clamp temperature to automatic range', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(
        api,
        createModel(
          { OperationMode: 'Automatic' },
          { maxTempAutomatic: 31, minTempAutomatic: 16 },
        ),
      )
      await facade.updateValues({ setTemperature: 10 })

      expect(api.updateValues).toHaveBeenCalledWith('device-1', {
        setTemperature: 16,
      })
    })

    it('should clamp temperature to dry range', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(
        api,
        createModel(
          { OperationMode: 'Dry' },
          { maxTempCoolDry: 31, minTempCoolDry: 16 },
        ),
      )
      await facade.updateValues({ setTemperature: 10 })

      expect(api.updateValues).toHaveBeenCalledWith('device-1', {
        setTemperature: 16,
      })
    })

    it('should use requested operation mode for clamping when changing both', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(
        api,
        createModel(
          { OperationMode: 'Heat' },
          { maxTempCoolDry: 31, minTempCoolDry: 16 },
        ),
      )
      await facade.updateValues({ operationMode: 'Cool', setTemperature: 10 })

      expect(api.updateValues).toHaveBeenCalledWith('device-1', {
        operationMode: 'Cool',
        setTemperature: 16,
      })
    })

    it('should pass through temperature when no clamping needed', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(
        api,
        createModel({ OperationMode: 'Heat' }),
      )
      await facade.updateValues({ setTemperature: 21 })

      expect(api.updateValues).toHaveBeenCalledWith('device-1', {
        setTemperature: 21,
      })
    })

    it('should not modify values without temperature', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(
        api,
        createModel({ OperationMode: 'Heat' }),
      )
      await facade.updateValues({ power: true })

      expect(api.updateValues).toHaveBeenCalledWith('device-1', { power: true })
    })

    it('should pass through temperature for unknown operation mode', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(
        api,
        createModel({ OperationMode: '' }),
      )
      await facade.updateValues({ setTemperature: 5 })

      expect(api.updateValues).toHaveBeenCalledWith('device-1', {
        setTemperature: 5,
      })
    })
  })

  describe('api delegation', () => {
    it('should delegate getEnergy with device id', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(api, createModel())
      const params = { from: '2026-03-01', interval: 'Day', to: '2026-03-02' }
      await facade.getEnergy(params)

      expect(api.getEnergy).toHaveBeenCalledWith('device-1', params)
    })

    it('delegates the protection writes with its own ATA unit bucket', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(api, createModel())

      await facade.updateFrostProtection({ isEnabled: true, max: 20, min: 2 })
      await facade.updateHolidayMode({
        endDate: '2026-08-05T00:00:00',
        isEnabled: false,
        startDate: '2026-08-01T00:00:00',
      })
      await facade.updateOverheatProtection({
        isEnabled: true,
        max: 37,
        min: 35,
      })

      expect(api.updateFrostProtection).toHaveBeenCalledWith({
        enabled: true,
        max: 16,
        min: 4,
        units: { ATA: ['device-1'] },
      })
      expect(api.updateHolidayMode).toHaveBeenCalledWith({
        enabled: false,
        endDate: '2026-08-05T00:00:00',
        startDate: '2026-08-01T00:00:00',
        units: { ATA: ['device-1'] },
      })
      expect(api.updateOverheatProtection).toHaveBeenCalledWith({
        enabled: true,
        max: 37,
        min: 35,
        units: { ATA: ['device-1'] },
      })
      expect(facade.supportsOverheat).toBe(true)
    })

    it('should delegate getErrorLog and project the neutral entries', async () => {
      const api = createMockHomeApi()
      vi.mocked(api.getErrorLog).mockResolvedValue(
        ok([
          {
            clearedTimestamp: null,
            errorCode: 'E202',
            errorReason: 'Communication error',
            timestamp: '2026-03-01T06:00:00Z',
          },
        ]),
      )
      const facade = new HomeDeviceAtaFacade(api, createModel())
      const value = okValue(await facade.getErrorLog())

      expect(api.getErrorLog).toHaveBeenCalledWith('device-1')
      expect(value).toStrictEqual([
        {
          at: '2026-03-01T06:00:00Z',
          atEpochMs: Temporal.Instant.from('2026-03-01T06:00:00Z')
            .epochMilliseconds,
          code: 'E202',
          deviceId: 'device-1',
          message: 'Communication error',
        },
      ])
    })

    it('should delegate getSignal with device id', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(api, createModel())
      const params = { from: '2026-03-01', to: '2026-03-02' }
      await facade.getSignal(params)

      expect(api.getSignal).toHaveBeenCalledWith('device-1', params)
    })

    it('builds the temperature chart from the trend-summary report', async () => {
      const api = createMockHomeApi()
      vi.mocked(api.getTemperatures).mockResolvedValue(
        ok([
          {
            datasets: [
              {
                data: [homeReportPoint('2026-03-01T01:00:00', 21)],
                id: 'room_temperature',
                label: 'ignored',
              },
            ],
            reportPeriod: 'hourly',
          },
        ]),
      )
      const facade = new HomeDeviceAtaFacade(api, createModel())

      const value = okValue(
        await facade.getTemperatures({
          from: '2026-03-01T00:00:00Z',
          to: '2026-03-02T00:00:00Z',
        }),
      )

      expect(api.getTemperatures).toHaveBeenCalledWith('device-1', {
        from: '2026-03-01T00:00:00Z',
        period: 'Hourly',
        to: '2026-03-02T00:00:00Z',
      })
      expect(value.unit).toBe('°C')
      expect(value.labels).toHaveLength(25)
      expect(value.series[0]?.name).toBe('RoomTemperature')
    })

    it('propagates a trend-summary failure untouched', async () => {
      const api = createMockHomeApi()
      const failure = { ok: false as const, status: 500 }
      vi.mocked(api.getTemperatures).mockResolvedValue(cast(failure))
      const facade = new HomeDeviceAtaFacade(api, createModel())

      await expect(facade.getTemperatures()).resolves.toBe(failure)
    })

    it('charts a multi-day energy report in local-day kWh buckets', async () => {
      const api = createMockHomeApi()
      const value = await chartEnergyReport(
        { from: '2026-03-01T00:00:00Z', to: '2026-03-03T00:00:00Z' },
        [{ time: '2026-03-01 00:00:00.000000000', value: '571.0' }],
        api,
      )

      // Up to a month, day buckets aggregate hourly wire buckets per
      // display-timezone calendar day.
      expect(api.getEnergy).toHaveBeenCalledWith('device-1', {
        from: '2026-03-01T00:00:00Z',
        interval: 'Hour',
        to: '2026-03-03T00:00:00Z',
      })
      expect(value.unit).toBe('kWh')
      expect(value.series[0]?.name).toBe('Consumed')
      expect(value.series[0]?.data[0]).toBeCloseTo(0.571)
    })

    it('lands evening UTC buckets on the next local calendar day', async () => {
      const value = await chartEnergyReport(
        { from: '2026-02-28T23:00:00Z', to: '2026-03-02T22:00:00Z' },
        // 23:30 UTC = 00:30 the next day in winter Paris time.
        [{ time: '2026-03-01 23:30:00.000000000', value: '100.0' }],
        // Pin the label locale: the runner's default is not ours.
        createMockHomeApi({ locale: 'fr-FR', timezone: 'Europe/Paris' }),
      )

      expect(value.labels).toStrictEqual(['1 mars', '2 mars'])
      expect(value.series[0]?.data).toStrictEqual([0, 0.1])
    })

    it('switches a one-day energy report to hourly buckets', async () => {
      const api = createMockHomeApi()
      const value = await chartEnergyReport(
        { from: '2026-03-01T00:00:00Z', to: '2026-03-02T00:00:00Z' },
        [{ time: '2026-03-01 09:00:00.000000000', value: '200.0' }],
        api,
      )

      // One day: hourly wire buckets, matching the Classic report.
      expect(api.getEnergy).toHaveBeenCalledWith('device-1', {
        from: '2026-03-01T00:00:00Z',
        interval: 'Hour',
        to: '2026-03-02T00:00:00Z',
      })
      expect(value.labels).toHaveLength(25)
      expect(value.series[0]?.data[9]).toBeCloseTo(0.2)
    })

    // The wire interval tracks the window length; an empty measure set
    // keeps the charted value out of the way of the pinned call shape.
    it.each([
      {
        interval: 'Day',
        range: { from: '2026-01-01T00:00:00Z', to: '2026-03-01T00:00:00Z' },
        windowKind: 'a window beyond a month',
      },
      {
        interval: 'Hour',
        // The caller stamps `from` a beat before the library stamps
        // `to`.
        range: { from: '2026-03-01T00:00:00Z', to: '2026-03-02T00:00:00.250Z' },
        windowKind: 'a one-day window drifting by ms',
      },
    ])(
      'requests $interval wire buckets for $windowKind',
      async ({ interval, range }) => {
        const api = createMockHomeApi()
        vi.mocked(api.getEnergy).mockResolvedValue(ok({ measureData: [] }))
        const facade = new HomeDeviceAtaFacade(api, createModel())

        okValue(await facade.getEnergyReport(range))

        expect(vi.mocked(api.getEnergy).mock.calls[0]?.[1]?.interval).toBe(
          interval,
        )
      },
    )
  })

  describe('signal chart', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(
        Temporal.Instant.from('2026-03-01T12:00:00Z').epochMilliseconds,
      )
      mockTemporalNowZoned()
    })

    afterEach(() => {
      vi.mocked(Temporal.Now.zonedDateTimeISO).mockRestore()
      vi.useRealTimers()
    })

    it('builds the signal chart over the requested hour', async () => {
      const api = createMockHomeApi()
      vi.mocked(api.getSignal).mockResolvedValue(
        ok(
          homeEnergyEnvelope('rssi', [
            { time: '2026-03-01 09:05:00.000000000', value: '-66' },
          ]),
        ),
      )
      const facade = new HomeDeviceAtaFacade(api, createModel())

      const value = okValue(await facade.getSignalStrength(9))

      expect(api.getSignal).toHaveBeenCalledWith('device-1', {
        from: '2026-03-01T09:00:00Z',
        to: '2026-03-01T10:00:00Z',
      })
      expect(value.unit).toBe('dBm')
      expect(value.labels).toHaveLength(61)
      expect(value.series[0]?.name).toBe('Test ClassicDevice')
      expect(value.series[0]?.data.at(-1)).toBe(-66)
    })

    it('covers today on a five-minute grid when no hour is given', async () => {
      const api = createMockHomeApi()
      vi.mocked(api.getSignal).mockResolvedValue(
        ok(
          homeEnergyEnvelope('rssi', [
            { time: '2026-03-01 00:02:00.000000000', value: '-70' },
          ]),
        ),
      )
      const facade = new HomeDeviceAtaFacade(api, createModel())

      const value = okValue(await facade.getSignalStrength())

      // Pinned to 12:00 UTC: the whole day on 5-minute slots, blank
      // after now.
      expect(api.getSignal).toHaveBeenCalledWith('device-1', {
        from: '2026-03-01T00:00:00Z',
        to: '2026-03-02T00:00:00Z',
      })
      expect(value.labels).toHaveLength(289)
      expect(value.series[0]?.data[1]).toBe(-70)
      expect(value.series[0]?.data[144]).toBe(-70)
      expect(value.series[0]?.data[145]).toBeNull()
      expect(value.series[0]?.data.at(-1)).toBeNull()
    })
  })
})
