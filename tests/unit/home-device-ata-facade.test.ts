import { describe, expect, it, vi } from 'vitest'

import type { HomeAPIAdapter } from '../../src/api/home-types.ts'
import type { HomeAtaDeviceCapabilities } from '../../src/types/index.ts'
import { NoChangesError } from '../../src/errors/index.ts'
import { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import { mock } from '../helpers.ts'
import { homeDevice } from '../home-fixtures.ts'

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
    getEnergy: vi.fn<HomeAPIAdapter['getEnergy']>(),
    getErrorLog: vi.fn<HomeAPIAdapter['getErrorLog']>(),
    getSignal: vi.fn<HomeAPIAdapter['getSignal']>(),
    getTemperatures: vi.fn<HomeAPIAdapter['getTemperatures']>(),
    updateValues: vi
      .fn<HomeAPIAdapter['updateValues']>()
      .mockResolvedValue(true),
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

      expect(api.updateValues).toHaveBeenCalledWith('device-1', {
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

      expect(api.updateValues).toHaveBeenCalledWith('device-1', {
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

      expect(api.updateValues).toHaveBeenCalledWith('device-1', {
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

      expect(api.updateValues).toHaveBeenCalledWith('device-1', {
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

      expect(api.updateValues).toHaveBeenCalledWith('device-1', {
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

      expect(api.updateValues).toHaveBeenCalledWith('device-1', {
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

      expect(api.updateValues).toHaveBeenCalledWith('device-1', {
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

      expect(api.updateValues).toHaveBeenCalledWith('device-1', {
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

      expect(api.getEnergy).toHaveBeenCalledWith('device-1', params)
    })

    it('should delegate getErrorLog with device id', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtaFacade(api, createModel())
      await facade.getErrorLog()

      expect(api.getErrorLog).toHaveBeenCalledWith('device-1')
    })

    it('should delegate getSignal with device id', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtaFacade(api, createModel())
      const params = { from: '2026-03-01', to: '2026-03-02' }
      await facade.getSignal(params)

      expect(api.getSignal).toHaveBeenCalledWith('device-1', params)
    })

    it('should delegate getTemperatures with device id', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtaFacade(api, createModel())
      const params = { from: '2026-03-01', period: 'Hourly', to: '2026-03-02' }
      await facade.getTemperatures(params)

      expect(api.getTemperatures).toHaveBeenCalledWith('device-1', params)
    })
  })
})
