import { describe, expect, it, vi } from 'vitest'

import type { HomeAPI } from '../../src/api/interfaces.ts'
import type { HomeDevice } from '../../src/types/index.ts'
import { HomeDeviceType } from '../../src/constants.ts'
import { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import { HomeDeviceModel } from '../../src/models/home-device.ts'
import { mock } from '../helpers.ts'

const defaultCapabilities: HomeDevice['capabilities'] = {
  hasAirDirection: true,
  hasAutomaticFanSpeed: true,
  hasAutoOperationMode: true,
  hasCoolOperationMode: true,
  hasDryOperationMode: true,
  hasHalfDegreeIncrements: true,
  hasHeatOperationMode: true,
  hasSwing: true,
  maxTempAutomatic: 31,
  maxTempCoolDry: 31,
  maxTempHeat: 31,
  minTempAutomatic: 16,
  minTempCoolDry: 16,
  minTempHeat: 10,
  numberOfFanSpeeds: 5,
}

const createModel = (
  settings: Record<string, string> = {},
  capabilities: Partial<HomeDevice['capabilities']> = {},
  rssi = -50,
): HomeDeviceModel =>
  new HomeDeviceModel(
    mock({
      capabilities: { ...defaultCapabilities, ...capabilities },
      givenDisplayName: 'Test Device',
      id: 'device-1',
      rssi,
      settings: Object.entries(settings).map(([name, value]) => ({
        name,
        value,
      })),
    }),
    HomeDeviceType.Ata,
  )

const createApi = (): HomeAPI =>
  mock<HomeAPI>({
    getEnergy: vi.fn(),
    getErrorLog: vi.fn(),
    getSignal: vi.fn(),
    getTemperatures: vi.fn(),
    setValues: vi.fn().mockResolvedValue(true),
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
      expect(facade.setFanSpeed).toBe('')
      expect(facade.vaneHorizontalDirection).toBe('')
      expect(facade.vaneVerticalDirection).toBe('')
    })

    it('should read device name', () => {
      const facade = new HomeDeviceAtaFacade(createApi(), createModel())

      expect(facade.name).toBe('Test Device')
    })

    it('should expose device capabilities', () => {
      const facade = new HomeDeviceAtaFacade(
        createApi(),
        createModel({}, { minTempHeat: 8 }),
      )

      expect(facade.capabilities.minTempHeat).toBe(8)
    })
  })

  describe('setValues validation', () => {
    it('should throw on empty values', async () => {
      const facade = new HomeDeviceAtaFacade(createApi(), createModel())

      await expect(facade.setValues({})).rejects.toThrow('No data to set')
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
      await facade.setValues({ setTemperature: 5 })

      expect(api.setValues).toHaveBeenCalledWith('device-1', {
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
      await facade.setValues({ setTemperature: 35 })

      expect(api.setValues).toHaveBeenCalledWith('device-1', {
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
      await facade.setValues({ setTemperature: 10 })

      expect(api.setValues).toHaveBeenCalledWith('device-1', {
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
      await facade.setValues({ setTemperature: 10 })

      expect(api.setValues).toHaveBeenCalledWith('device-1', {
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
      await facade.setValues({ operationMode: 'Cool', setTemperature: 10 })

      expect(api.setValues).toHaveBeenCalledWith('device-1', {
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
      await facade.setValues({ setTemperature: 21 })

      expect(api.setValues).toHaveBeenCalledWith('device-1', {
        setTemperature: 21,
      })
    })

    it('should not modify values without temperature', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtaFacade(
        api,
        createModel({ OperationMode: 'Heat' }),
      )
      await facade.setValues({ power: true })

      expect(api.setValues).toHaveBeenCalledWith('device-1', {
        power: true,
      })
    })

    it('should pass through temperature for unknown operation mode', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtaFacade(
        api,
        createModel({ OperationMode: '' }),
      )
      await facade.setValues({ setTemperature: 5 })

      expect(api.setValues).toHaveBeenCalledWith('device-1', {
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
