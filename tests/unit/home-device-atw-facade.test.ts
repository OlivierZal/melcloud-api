import { describe, expect, it, vi } from 'vitest'

import type { HomeAPIAdapter } from '../../src/api/home-types.ts'
import type { HomeAtwDeviceCapabilities } from '../../src/types/index.ts'
import { NoChangesError } from '../../src/errors/index.ts'
import { HomeDeviceAtwFacade } from '../../src/facades/home-device-atw.ts'
import { mock } from '../helpers.ts'
import { homeAtwDevice } from '../home-fixtures.ts'

const createModel = (
  settings: Record<string, string> = {},
  capabilities: Partial<HomeAtwDeviceCapabilities> = {},
  rssi = -50,
): ReturnType<typeof homeAtwDevice> =>
  homeAtwDevice({ capabilities, id: 'atw-1', name: 'Test ATW', rssi, settings })

const createApi = (): HomeAPIAdapter =>
  mock<HomeAPIAdapter>({
    getAtwEnergy: vi.fn<HomeAPIAdapter['getAtwEnergy']>(),
    getAtwErrorLog: vi.fn<HomeAPIAdapter['getAtwErrorLog']>(),
    getAtwInternalTemperatures:
      vi.fn<HomeAPIAdapter['getAtwInternalTemperatures']>(),
    getAtwTemperatures: vi.fn<HomeAPIAdapter['getAtwTemperatures']>(),
    getSignal: vi.fn<HomeAPIAdapter['getSignal']>(),
    updateAtwValues: vi
      .fn<HomeAPIAdapter['updateAtwValues']>()
      .mockResolvedValue(true),
  })

describe('home device atw facade', () => {
  describe('settings accessors', () => {
    it('reads power, standby, and operation mode from settings', () => {
      const facade = new HomeDeviceAtwFacade(
        createApi(),
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

    it('reads zone-1 temperatures and setpoint as numbers', () => {
      const facade = new HomeDeviceAtwFacade(
        createApi(),
        createModel({
          OperationModeZone1: 'HeatRoomTemperature',
          RoomTemperatureZone1: '19.5',
          SetTemperatureZone1: '18',
        }),
      )

      expect(facade.operationModeZone1).toBe('HeatRoomTemperature')
      expect(facade.roomTemperatureZone1).toBe(19.5)
      expect(facade.setTemperatureZone1).toBe(18)
    })

    it('returns null for zone-2 accessors when capabilities.hasZone2 is false', () => {
      const facade = new HomeDeviceAtwFacade(
        createApi(),
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
        createApi(),
        createModel(
          {
            OperationModeZone2: 'CoolRoomTemperature',
            RoomTemperatureZone2: '22.5',
            SetTemperatureZone2: '21',
          },
          { hasZone2: true },
        ),
      )

      expect(facade.operationModeZone2).toBe('CoolRoomTemperature')
      expect(facade.roomTemperatureZone2).toBe(22.5)
      expect(facade.setTemperatureZone2).toBe(21)
    })

    it('reads tank, outdoor, and hot-water flags', () => {
      const facade = new HomeDeviceAtwFacade(
        createApi(),
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
  })

  describe('updateValues', () => {
    it('throws NoChangesError when values is empty', async () => {
      const facade = new HomeDeviceAtwFacade(createApi(), createModel())

      await expect(facade.updateValues({})).rejects.toBeInstanceOf(
        NoChangesError,
      )
    })

    it('clamps zone-1 setpoint to capability bounds before forwarding', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtwFacade(
        api,
        createModel({}, { maxSetTemperature: 28, minSetTemperature: 12 }),
      )

      await facade.updateValues({ setTemperatureZone1: 60 })

      expect(api.updateAtwValues).toHaveBeenCalledWith('atw-1', {
        setTemperatureZone1: 28,
      })
    })

    it('clamps zone-2 setpoint to capability bounds before forwarding', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtwFacade(
        api,
        createModel({}, { maxSetTemperature: 28, minSetTemperature: 12 }),
      )

      await facade.updateValues({ setTemperatureZone2: 5 })

      expect(api.updateAtwValues).toHaveBeenCalledWith('atw-1', {
        setTemperatureZone2: 12,
      })
    })

    it('clamps tank setpoint to tank-temperature bounds', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtwFacade(
        api,
        createModel(
          {},
          { maxSetTankTemperature: 55, minSetTankTemperature: 35 },
        ),
      )

      await facade.updateValues({ setTankWaterTemperature: 10 })

      expect(api.updateAtwValues).toHaveBeenCalledWith('atw-1', {
        setTankWaterTemperature: 35,
      })
    })

    it('forwards non-temperature fields unchanged', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtwFacade(api, createModel())

      await facade.updateValues({
        forcedHotWaterMode: true,
        operationModeZone1: 'HeatRoomTemperature',
        power: false,
      })

      expect(api.updateAtwValues).toHaveBeenCalledWith('atw-1', {
        forcedHotWaterMode: true,
        operationModeZone1: 'HeatRoomTemperature',
        power: false,
      })
    })
  })

  describe('telemetry passthroughs', () => {
    it('delegates getEnergy to getAtwEnergy with the chosen measure', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtwFacade(api, createModel())
      const params = {
        from: '2026-05-01T00:00:00Z',
        interval: 'Hour',
        measure: 'consumed' as const,
        to: '2026-05-01T23:59:59Z',
      }

      await facade.getEnergy(params)

      expect(api.getAtwEnergy).toHaveBeenCalledWith('atw-1', params)
    })

    it('delegates getErrorLog to getAtwErrorLog', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtwFacade(api, createModel())

      await facade.getErrorLog()

      expect(api.getAtwErrorLog).toHaveBeenCalledWith('atw-1')
    })

    it('delegates getInternalTemperatures with passthrough params', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtwFacade(api, createModel())
      const params = {
        from: '2026-05-09T00:00:00Z',
        period: 'Hourly',
        to: '2026-05-09T23:59:59Z',
      }

      await facade.getInternalTemperatures(params)

      expect(api.getAtwInternalTemperatures).toHaveBeenCalledWith(
        'atw-1',
        params,
      )
    })

    it('delegates getTemperatures with passthrough params', async () => {
      const api = createApi()
      const facade = new HomeDeviceAtwFacade(api, createModel())
      const params = {
        from: '2026-05-09T00:00:00Z',
        period: 'Daily',
        to: '2026-05-10T00:00:00Z',
      }

      await facade.getTemperatures(params)

      expect(api.getAtwTemperatures).toHaveBeenCalledWith('atw-1', params)
    })
  })
})
