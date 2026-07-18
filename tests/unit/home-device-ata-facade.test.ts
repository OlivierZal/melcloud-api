import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { HomeAPIAdapter } from '../../src/api/home-types.ts'
import { NoChangesError } from '../../src/errors/index.ts'
import { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import { Temporal } from '../../src/temporal.ts'
import { type HomeAtaDeviceCapabilities, ok } from '../../src/types/index.ts'
import { cast, mock, mockTemporalNowZoned, okValue } from '../helpers.ts'
import { homeDevice, homeReportPoint } from '../home-fixtures.ts'

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

const createApi = (): HomeAPIAdapter =>
  mock<HomeAPIAdapter>({
    getAtaEnergy: vi.fn<HomeAPIAdapter['getAtaEnergy']>(),
    getAtaErrorLog: vi.fn<HomeAPIAdapter['getAtaErrorLog']>(),
    getAtaTemperatures: vi.fn<HomeAPIAdapter['getAtaTemperatures']>(),
    getSignal: vi.fn<HomeAPIAdapter['getSignal']>(),
    updateAtaValues: vi
      .fn<HomeAPIAdapter['updateAtaValues']>()
      .mockResolvedValue(),
  })

describe('home device ata facade', () => {
  describe('settings accessors', () => {
    it('should read operation mode from settings', () => {
      const facade = new HomeDeviceAtaFacade(
        createApi(),
        createModel({ OperationMode: 'Heat' }),
      )

      expect(facade.operationMode).toBe('Heat')
    })

    it('should read power as boolean', () => {
      const facade = new HomeDeviceAtaFacade(
        createApi(),
        createModel({ Power: 'True' }),
      )

      expect(facade.power).toBe(true)
    })

    it('should read temperatures as numbers', () => {
      const facade = new HomeDeviceAtaFacade(
        createApi(),
        createModel({
          RoomTemperature: '21.5',
          SetTemperature: '20',
        }),
      )

      expect(facade.roomTemperature).toBe(21.5)
      expect(facade.setTemperature).toBe(20)
    })

    it('should read fan speed and vane directions from settings', () => {
      const facade = new HomeDeviceAtaFacade(
        createApi(),
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
        createApi(),
        createModel({ SetFanSpeed: '0' }),
      )

      expect(facade.setFanSpeed).toBe('Auto')
    })

    it('should read rssi from device data', () => {
      const facade = new HomeDeviceAtaFacade(
        createApi(),
        createModel({}, {}, -42),
      )

      expect(facade.rssi).toBe(-42)
    })

    it('should return defaults for missing settings', () => {
      const facade = new HomeDeviceAtaFacade(createApi(), createModel())

      expect(facade.operationMode).toBe('')
      expect(facade.power).toBe(false)
      expect(facade.roomTemperature).toBe(0)
      expect(facade.setFanSpeed).toBe('Auto')
      expect(facade.vaneHorizontalDirection).toBe('')
      expect(facade.vaneVerticalDirection).toBe('')
    })

    it('should read device name', () => {
      const facade = new HomeDeviceAtaFacade(createApi(), createModel())

      expect(facade.name).toBe('Test ClassicDevice')
    })

    it('should expose device capabilities', () => {
      const facade = new HomeDeviceAtaFacade(
        createApi(),
        createModel({}, { minTempHeat: 8 }),
      )

      expect(facade.capabilities.minTempHeat).toBe(8)
    })
  })

  describe('updateValues validation', () => {
    it('should throw on empty values', async () => {
      const facade = new HomeDeviceAtaFacade(createApi(), createModel())

      await expect(facade.updateValues({})).rejects.toThrow(
        new NoChangesError('device-1'),
      )
    })

    it('should treat explicitly-undefined values as absent', async () => {
      const facade = new HomeDeviceAtaFacade(createApi(), createModel())

      await expect(
        facade.updateValues(cast({ setTemperature: undefined })),
      ).rejects.toThrow(new NoChangesError('device-1'))
    })

    it('should drop undefined-valued keys before forwarding', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtaFacade(api, createModel())

      await facade.updateValues(
        cast({ power: true, setTemperature: undefined }),
      )

      expect(vi.mocked(api.updateAtaValues).mock.lastCall?.[1]).toStrictEqual({
        power: true,
      })
    })
  })

  describe('updatePower', () => {
    it('forwards a power-only payload, defaulting to on', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtaFacade(api, createModel())

      await facade.updatePower()

      expect(api.updateAtaValues).toHaveBeenCalledWith('device-1', {
        power: true,
      })
    })

    it('powers off when passed false', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtaFacade(api, createModel())

      await facade.updatePower(false)

      expect(api.updateAtaValues).toHaveBeenCalledWith('device-1', {
        power: false,
      })
    })
  })

  describe('temperature clamping', () => {
    it('should clamp temperature to heat range', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtaFacade(
        api,
        createModel(
          { OperationMode: 'Heat' },
          { maxTempHeat: 31, minTempHeat: 10 },
        ),
      )
      await facade.updateValues({ setTemperature: 5 })

      expect(api.updateAtaValues).toHaveBeenCalledWith('device-1', {
        setTemperature: 10,
      })
    })

    it('should clamp temperature to cool range', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtaFacade(
        api,
        createModel(
          { OperationMode: 'Cool' },
          { maxTempCoolDry: 31, minTempCoolDry: 16 },
        ),
      )
      await facade.updateValues({ setTemperature: 35 })

      expect(api.updateAtaValues).toHaveBeenCalledWith('device-1', {
        setTemperature: 31,
      })
    })

    it('should clamp temperature to automatic range', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtaFacade(
        api,
        createModel(
          { OperationMode: 'Automatic' },
          { maxTempAutomatic: 31, minTempAutomatic: 16 },
        ),
      )
      await facade.updateValues({ setTemperature: 10 })

      expect(api.updateAtaValues).toHaveBeenCalledWith('device-1', {
        setTemperature: 16,
      })
    })

    it('should clamp temperature to dry range', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtaFacade(
        api,
        createModel(
          { OperationMode: 'Dry' },
          { maxTempCoolDry: 31, minTempCoolDry: 16 },
        ),
      )
      await facade.updateValues({ setTemperature: 10 })

      expect(api.updateAtaValues).toHaveBeenCalledWith('device-1', {
        setTemperature: 16,
      })
    })

    it('should use requested operation mode for clamping when changing both', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtaFacade(
        api,
        createModel(
          { OperationMode: 'Heat' },
          { maxTempCoolDry: 31, minTempCoolDry: 16 },
        ),
      )
      await facade.updateValues({ operationMode: 'Cool', setTemperature: 10 })

      expect(api.updateAtaValues).toHaveBeenCalledWith('device-1', {
        operationMode: 'Cool',
        setTemperature: 16,
      })
    })

    it('should pass through temperature when no clamping needed', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtaFacade(
        api,
        createModel({ OperationMode: 'Heat' }),
      )
      await facade.updateValues({ setTemperature: 21 })

      expect(api.updateAtaValues).toHaveBeenCalledWith('device-1', {
        setTemperature: 21,
      })
    })

    it('should not modify values without temperature', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtaFacade(
        api,
        createModel({ OperationMode: 'Heat' }),
      )
      await facade.updateValues({ power: true })

      expect(api.updateAtaValues).toHaveBeenCalledWith('device-1', {
        power: true,
      })
    })

    it('should pass through temperature for unknown operation mode', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtaFacade(
        api,
        createModel({ OperationMode: '' }),
      )
      await facade.updateValues({ setTemperature: 5 })

      expect(api.updateAtaValues).toHaveBeenCalledWith('device-1', {
        setTemperature: 5,
      })
    })
  })

  describe('api delegation', () => {
    it('should delegate getEnergy with device id', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtaFacade(api, createModel())
      const params = { from: '2026-03-01', interval: 'Day', to: '2026-03-02' }
      await facade.getEnergy(params)

      expect(api.getAtaEnergy).toHaveBeenCalledWith('device-1', params)
    })

    it('should delegate getErrorLog with device id', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtaFacade(api, createModel())
      await facade.getErrorLog()

      expect(api.getAtaErrorLog).toHaveBeenCalledWith('device-1')
    })

    it('should delegate getSignal with device id', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtaFacade(api, createModel())
      const params = { from: '2026-03-01', to: '2026-03-02' }
      await facade.getSignal(params)

      expect(api.getSignal).toHaveBeenCalledWith('device-1', params)
    })

    it('builds the temperature chart from the trend-summary report', async () => {
      const api = createApi()
      vi.mocked(api.getAtaTemperatures).mockResolvedValue(
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

      expect(api.getAtaTemperatures).toHaveBeenCalledWith('device-1', {
        from: '2026-03-01T00:00:00Z',
        period: 'Hourly',
        to: '2026-03-02T00:00:00Z',
      })
      expect(value.unit).toBe('°C')
      expect(value.labels).toHaveLength(25)
      expect(value.series[0]?.name).toBe('RoomTemperature')
    })

    it('propagates a trend-summary failure untouched', async () => {
      const api = createApi()
      const failure = { ok: false as const, status: 500 }
      vi.mocked(api.getAtaTemperatures).mockResolvedValue(cast(failure))
      const facade = new HomeDeviceAtaFacade(api, createModel())

      await expect(facade.getTemperatures()).resolves.toBe(failure)
    })

    it('charts the daily energy report in kWh from watt-hour buckets', async () => {
      const api = createApi()
      vi.mocked(api.getAtaEnergy).mockResolvedValue(
        ok({
          measureData: [
            {
              type: 'cumulative_energy_consumed_since_last_upload',
              values: [
                { time: '2026-03-01 00:00:00.000000000', value: '571.0' },
              ],
            },
          ],
        }),
      )
      const facade = new HomeDeviceAtaFacade(api, createModel())

      const value = okValue(
        await facade.getEnergyReport({
          from: '2026-03-01T00:00:00Z',
          to: '2026-03-02T00:00:00Z',
        }),
      )

      expect(api.getAtaEnergy).toHaveBeenCalledWith('device-1', {
        from: '2026-03-01T00:00:00Z',
        interval: 'Day',
        to: '2026-03-02T00:00:00Z',
      })
      expect(value.unit).toBe('kWh')
      expect(value.series[0]?.name).toBe('Consumed')
      expect(value.series[0]?.data[0]).toBeCloseTo(0.571)
    })
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
      const api = createApi()
      vi.mocked(api.getSignal).mockResolvedValue(
        ok({
          measureData: [
            {
              type: 'rssi',
              values: [{ time: '2026-03-01 09:05:00.000000000', value: '-66' }],
            },
          ],
        }),
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
      const api = createApi()
      vi.mocked(api.getSignal).mockResolvedValue(
        ok({
          measureData: [
            {
              type: 'rssi',
              values: [{ time: '2026-03-01 00:02:00.000000000', value: '-70' }],
            },
          ],
        }),
      )
      const facade = new HomeDeviceAtaFacade(api, createModel())

      const value = okValue(await facade.getSignalStrength())

      // Pinned to 12:00 UTC: midnight through now, 5-minute slots.
      expect(api.getSignal).toHaveBeenCalledWith('device-1', {
        from: '2026-03-01T00:00:00Z',
        to: '2026-03-01T12:00:00Z',
      })
      expect(value.labels).toHaveLength(145)
      expect(value.series[0]?.data[1]).toBe(-70)
    })
  })
})
