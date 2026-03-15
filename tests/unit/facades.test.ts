import { describe, expect, it, vi } from 'vitest'

import type { APIAdapter } from '../../src/services/index.ts'
import type {
  SetDeviceDataAta,
  SetDevicePostData,
} from '../../src/types/index.ts'

import {
  DeviceType,
  OperationMode,
  OperationModeZone,
} from '../../src/constants.ts'
import { AreaFacade } from '../../src/facades/area.ts'
import { BuildingFacade } from '../../src/facades/building.ts'
import { DeviceAtaFacade } from '../../src/facades/device-ata.ts'
import { DeviceAtwHasZone2Facade } from '../../src/facades/device-atw-has-zone2.ts'
import { DeviceAtwFacade } from '../../src/facades/device-atw.ts'
import { DeviceErvFacade } from '../../src/facades/device-erv.ts'
import { FloorFacade } from '../../src/facades/floor.ts'
import { type DeviceModel, ModelRegistry } from '../../src/models/index.ts'
import {
  areaData,
  ataDevice,
  ataDeviceData,
  atwDevice,
  atwDeviceData,
  buildingData,
  ervDevice,
  floorData,
  frostProtectionResponse,
  holidayModeResponse,
  reportData,
} from '../fixtures.ts'
import { assertDeviceType, cast, mock } from '../helpers.ts'

type DeviceModelAta = DeviceModel<typeof DeviceType.Ata>

const createRegistry = (): ModelRegistry => {
  const registry = new ModelRegistry()
  registry.syncBuildings([buildingData({ HMDefined: true })])
  registry.syncFloors([floorData()])
  registry.syncAreas([areaData()])
  registry.syncDevices([
    ataDevice({ Device: ataDeviceData({ OperationMode: OperationMode.heat }) }),
    atwDevice({ Device: atwDeviceData({ SetTemperatureZone2: 22 }) }),
    ervDevice(),
  ])
  return registry
}

const createMockApi = (overrides: Partial<APIAdapter> = {}): APIAdapter =>
  mock<APIAdapter>({
    energy: vi.fn().mockResolvedValue({ data: {} }),
    fetch: vi.fn().mockResolvedValue([]),
    frostProtection: vi.fn().mockResolvedValue({
      data: frostProtectionResponse({ FPDefined: true }),
    }),
    getErrorEntries: vi.fn().mockResolvedValue({ data: [] }),
    getErrorLog: vi.fn().mockResolvedValue({ errors: [] }),
    group: vi.fn().mockResolvedValue({
      data: { Data: { Group: { State: { Power: true } } } },
    }),
    holidayMode: vi.fn().mockResolvedValue({
      data: holidayModeResponse({ HMDefined: true }),
    }),
    hourlyTemperatures: vi.fn().mockResolvedValue({
      data: reportData(),
    }),
    internalTemperatures: vi.fn().mockResolvedValue({
      data: reportData(),
    }),
    operationModes: vi.fn().mockResolvedValue({
      data: [{ Key: 'Heating', Value: 100 }],
    }),
    setFrostProtection: vi.fn().mockResolvedValue({
      data: { AttributeErrors: null, Success: true },
    }),
    setGroup: vi.fn().mockResolvedValue({
      data: { AttributeErrors: null, Success: true },
    }),
    setHolidayMode: vi.fn().mockResolvedValue({
      data: { AttributeErrors: null, Success: true },
    }),
    setPower: vi.fn().mockResolvedValue({ data: true }),
    setValues: vi.fn().mockResolvedValue({
      data: mock<SetDeviceDataAta>({
        DeviceType: DeviceType.Ata,
        EffectiveFlags: 0x1,
        LastCommunication: '',
        NextCommunication: '',
        NumberOfFanSpeeds: 5,
        Offline: false,
        OperationMode: OperationMode.heat,
        Power: true,
        RoomTemperature: 22,
        SetFanSpeed: 3,
        SetTemperature: 24,
        VaneHorizontal: 0,
        VaneVertical: 0,
      }),
    }),
    signal: vi.fn().mockResolvedValue({
      data: reportData(),
    }),
    temperatures: vi.fn().mockResolvedValue({
      data: reportData(),
    }),
    tiles: vi.fn().mockResolvedValue({
      data: { SelectedDevice: null, Tiles: [] },
    }),
    values: vi.fn().mockResolvedValue({ data: {} }),
    ...overrides,
  })

describe('buildingFacade', () => {
  it('returns building data', () => {
    const registry = createRegistry()
    const api = createMockApi()
    const instance = registry.buildings.getById(1)!
    const facade = new BuildingFacade(api, registry, instance)

    expect(facade.data.FPDefined).toBe(true)
  })

  it('returns devices by building', () => {
    const registry = createRegistry()
    const api = createMockApi()
    const instance = registry.buildings.getById(1)!
    const facade = new BuildingFacade(api, registry, instance)

    expect(facade.devices).toHaveLength(3)
  })

  it('fetches building data', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.buildings.getById(1)!
    const facade = new BuildingFacade(api, registry, instance)
    const data = await facade.fetch()

    expect(data.FPDefined).toBe(true)
    expect(api.fetch).toHaveBeenCalled()
  })

  it('calls setPower', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.buildings.getById(1)!
    const facade = new BuildingFacade(api, registry, instance)
    const isPowered = await facade.setPower(true)

    expect(isPowered).toBe(true)
    expect(api.setPower).toHaveBeenCalled()
  })

  it('calls getErrors', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.buildings.getById(1)!
    const facade = new BuildingFacade(api, registry, instance)
    const result = await facade.getErrors({})

    expect(result).toStrictEqual({ errors: [] })
  })

  it('calls getSignalStrength', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.buildings.getById(1)!
    const facade = new BuildingFacade(api, registry, instance)
    const result = await facade.getSignalStrength(12)

    expect(result).toHaveProperty('series')
    expect(api.signal).toHaveBeenCalled()
  })

  it('calls getTiles without selection', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.buildings.getById(1)!
    const facade = new BuildingFacade(api, registry, instance)
    const result = await facade.getTiles()

    expect(result).toHaveProperty('Tiles')
  })

  it('calls getTiles with device selection', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.buildings.getById(1)!
    const facade = new BuildingFacade(api, registry, instance)
    const device = registry.devices.getById(1000)!
    assertDeviceType(device, DeviceType.Ata)
    const result = await facade.getTiles(device)

    expect(api.tiles).toHaveBeenCalled()
    expect(result).toHaveProperty('Tiles')
  })

  it('calls notifySync', async () => {
    const onSync = vi.fn()
    const api = createMockApi({ onSync })
    const registry = createRegistry()
    const instance = registry.buildings.getById(1)!
    const facade = new BuildingFacade(api, registry, instance)
    await facade.notifySync()

    expect(onSync).toHaveBeenCalled()
  })
})

describe('buildingFacade frostProtection', () => {
  it('gets frost protection with defined settings', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.buildings.getById(1)!
    const facade = new BuildingFacade(api, registry, instance)
    const result = await facade.getFrostProtection()

    expect(result).toHaveProperty('FPDefined')
    expect(api.frostProtection).toHaveBeenCalled()
  })

  it('sets frost protection', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.buildings.getById(1)!
    const facade = new BuildingFacade(api, registry, instance)
    await facade.getFrostProtection()
    const result = await facade.setFrostProtection({
      enabled: true,
      max: 14,
      min: 6,
    })

    expect(result).toHaveProperty('Success')
    expect(api.setFrostProtection).toHaveBeenCalled()
  })

  it('clamps frost protection temperatures', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.buildings.getById(1)!
    const facade = new BuildingFacade(api, registry, instance)
    await facade.getFrostProtection()
    await facade.setFrostProtection({
      max: 2,
      min: 1,
    })
    const call = vi.mocked(api.setFrostProtection).mock.lastCall?.[0]

    expect(call.postData.MinimumTemperature).toBeGreaterThanOrEqual(4)
    expect(call.postData.MaximumTemperature).toBeGreaterThanOrEqual(
      call.postData.MinimumTemperature + 2,
    )
  })

  it('enforces minimum gap between min and max temperatures', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.buildings.getById(1)!
    const facade = new BuildingFacade(api, registry, instance)
    await facade.getFrostProtection()
    await facade.setFrostProtection({
      max: 15,
      min: 14,
    })
    const call = vi.mocked(api.setFrostProtection).mock.lastCall?.[0]

    expect(
      call.postData.MaximumTemperature - call.postData.MinimumTemperature,
    ).toBeGreaterThanOrEqual(2)
  })
})

describe('buildingFacade holidayMode', () => {
  it('gets holiday mode', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.buildings.getById(1)!
    const facade = new BuildingFacade(api, registry, instance)
    const result = await facade.getHolidayMode()

    expect(result).toHaveProperty('HMDefined')
  })

  it('sets holiday mode with dates', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.buildings.getById(1)!
    const facade = new BuildingFacade(api, registry, instance)
    await facade.getHolidayMode()
    const result = await facade.setHolidayMode({
      from: '2024-06-01',
      to: '2024-06-15',
    })

    expect(result).toHaveProperty('Success')
  })

  it('disables holiday mode when no to date', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.buildings.getById(1)!
    const facade = new BuildingFacade(api, registry, instance)
    await facade.getHolidayMode()
    await facade.setHolidayMode({})
    const call = vi.mocked(api.setHolidayMode).mock.lastCall?.[0]

    expect(call.postData.Enabled).toBe(false)
  })
})

describe('buildingFacade group', () => {
  it('calls getGroup', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.buildings.getById(1)!
    const facade = new BuildingFacade(api, registry, instance)
    const result = await facade.getGroup()

    expect(result).toHaveProperty('Power')
  })

  it('calls setGroup', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.buildings.getById(1)!
    const facade = new BuildingFacade(api, registry, instance)
    const result = await facade.setGroup({ Power: true })

    expect(result).toHaveProperty('Success')
  })

  it('throws when group API fails', async () => {
    const api = createMockApi({
      group: vi.fn().mockRejectedValue(new Error('fail')),
    })
    const registry = createRegistry()
    const instance = registry.buildings.getById(1)!
    const facade = new BuildingFacade(api, registry, instance)

    await expect(facade.getGroup()).rejects.toThrow(
      'No air-to-air device found',
    )
  })

  it('throws when setGroup API fails', async () => {
    const api = createMockApi({
      setGroup: vi.fn().mockRejectedValue(new Error('fail')),
    })
    const registry = createRegistry()
    const instance = registry.buildings.getById(1)!
    const facade = new BuildingFacade(api, registry, instance)

    await expect(facade.setGroup({ Power: true })).rejects.toThrow(
      'No air-to-air device found',
    )
  })
})

describe('floorFacade', () => {
  it('returns floor devices', () => {
    const registry = createRegistry()
    const api = createMockApi()
    const instance = registry.floors.getById(10)!
    const facade = new FloorFacade(api, registry, instance)

    expect(facade.devices).toHaveLength(2)
  })

  it('has correct properties', () => {
    const registry = createRegistry()
    const api = createMockApi()
    const instance = registry.floors.getById(10)!
    const facade = new FloorFacade(api, registry, instance)

    expect(facade.id).toBe(10)
    expect(facade.name).toBe('Floor')
  })
})

describe('areaFacade', () => {
  it('returns area devices', () => {
    const registry = createRegistry()
    const api = createMockApi()
    const instance = registry.areas.getById(100)!
    const facade = new AreaFacade(api, registry, instance)

    expect(facade.devices).toHaveLength(3)
  })

  it('has correct properties', () => {
    const registry = createRegistry()
    const api = createMockApi()
    const instance = registry.areas.getById(100)!
    const facade = new AreaFacade(api, registry, instance)

    expect(facade.id).toBe(100)
    expect(facade.name).toBe('Area')
  })
})

describe('baseFacade frostProtection fallback', () => {
  it('falls back to device frost protection when zone fails', async () => {
    const fpMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('zone not found'))
      .mockResolvedValue({
        data: frostProtectionResponse(),
      })
    const api = createMockApi({ frostProtection: fpMock })
    const registry = createRegistry()
    const instance = registry.areas.getById(100)!
    const facade = new AreaFacade(api, registry, instance)
    const result = await facade.getFrostProtection()

    expect(result).toHaveProperty('FPDefined')
    expect(fpMock).toHaveBeenCalledTimes(2)
  })

  it('uses cached frost protection state on subsequent calls', async () => {
    const fpMock = vi.fn().mockResolvedValue({
      data: frostProtectionResponse({ FPDefined: true }),
    })
    const api = createMockApi({ frostProtection: fpMock })
    const registry = createRegistry()
    const instance = registry.areas.getById(100)!
    const facade = new AreaFacade(api, registry, instance)
    const result1 = await facade.getFrostProtection()
    const result2 = await facade.getFrostProtection()

    expect(result2).toStrictEqual(result1)
    expect(fpMock).toHaveBeenCalledTimes(2)
  })

  it('uses cached device-level frost protection on subsequent calls', async () => {
    const fpMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('zone not found'))
      .mockResolvedValue({
        data: frostProtectionResponse(),
      })
    const api = createMockApi({ frostProtection: fpMock })
    const registry = createRegistry()
    const instance = registry.areas.getById(100)!
    const facade = new AreaFacade(api, registry, instance)
    const result1 = await facade.getFrostProtection()
    const result2 = await facade.getFrostProtection()

    expect(result2).toStrictEqual(result1)
    expect(fpMock).toHaveBeenCalledTimes(3)
  })
})

describe('baseFacade holidayMode fallback', () => {
  it('falls back to device holiday mode when zone fails', async () => {
    const hmMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('zone not found'))
      .mockResolvedValue({
        data: holidayModeResponse(),
      })
    const api = createMockApi({ holidayMode: hmMock })
    const registry = createRegistry()
    const instance = registry.areas.getById(100)!
    const facade = new AreaFacade(api, registry, instance)
    const result = await facade.getHolidayMode()

    expect(result).toHaveProperty('HMDefined')
    expect(hmMock).toHaveBeenCalledTimes(2)
  })

  it('uses cached zone-level holiday mode on subsequent calls', async () => {
    const hmMock = vi.fn().mockResolvedValue({
      data: holidayModeResponse({ HMDefined: true }),
    })
    const api = createMockApi({ holidayMode: hmMock })
    const registry = createRegistry()
    const instance = registry.areas.getById(100)!
    const facade = new AreaFacade(api, registry, instance)
    const result1 = await facade.getHolidayMode()
    const result2 = await facade.getHolidayMode()

    expect(result2).toStrictEqual(result1)
    expect(hmMock).toHaveBeenCalledTimes(2)
  })

  it('uses cached device-level holiday mode on subsequent calls', async () => {
    const hmMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('zone not found'))
      .mockResolvedValue({
        data: holidayModeResponse(),
      })
    const api = createMockApi({ holidayMode: hmMock })
    const registry = createRegistry()
    const instance = registry.areas.getById(100)!
    const facade = new AreaFacade(api, registry, instance)
    const result1 = await facade.getHolidayMode()
    const result2 = await facade.getHolidayMode()

    expect(result2).toStrictEqual(result1)
    expect(hmMock).toHaveBeenCalledTimes(3)
  })
})

describe('baseFacade setFrostProtection with device fallback', () => {
  it('uses DeviceIds location when frost protection is not defined', async () => {
    const fpMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('zone not found'))
      .mockResolvedValue({
        data: frostProtectionResponse(),
      })
    const api = createMockApi({ frostProtection: fpMock })
    const registry = createRegistry()
    const instance = registry.areas.getById(100)!
    const facade = new AreaFacade(api, registry, instance)
    await facade.setFrostProtection({ max: 14, min: 6 })
    const call = vi.mocked(api.setFrostProtection).mock.lastCall?.[0]

    expect(call.postData).toHaveProperty('DeviceIds')
  })
})

describe('baseFacade setHolidayMode with device fallback', () => {
  it('uses Devices location when holiday mode is not defined', async () => {
    const hmMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('zone not found'))
      .mockResolvedValue({
        data: holidayModeResponse(),
      })
    const api = createMockApi({ holidayMode: hmMock })
    const registry = createRegistry()
    const instance = registry.areas.getById(100)!
    const facade = new AreaFacade(api, registry, instance)
    await facade.setHolidayMode({ to: '2024-12-31' })
    const call = vi.mocked(api.setHolidayMode).mock.lastCall?.[0]

    expect(call.postData.HMTimeZones[0]).toHaveProperty('Devices')
  })
})

describe('baseDeviceFacade device type mismatch', () => {
  it('throws when device type does not match facade type', () => {
    const registry = createRegistry()
    const api = createMockApi()
    const instance = registry.devices.getById(1001)!
    assertDeviceType(instance, DeviceType.Atw)
    const facade = new DeviceAtaFacade(api, registry, cast(instance))

    expect(() => facade.data).toThrow('Device type mismatch')
  })
})

describe('baseFacade instance error', () => {
  it('throws when instance not found in registry', () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.areas.getById(100)!
    const facade = new AreaFacade(api, registry, instance)
    registry.syncAreas([])

    expect(() => facade.name).toThrow('Area not found')
  })

  it('throws when no device id for device-level frost protection fallback', async () => {
    const fpMock = vi.fn().mockRejectedValueOnce(new Error('zone not found'))
    const api = createMockApi({ frostProtection: fpMock })
    const registry = createRegistry()
    registry.syncAreas([
      { BuildingId: 1, FloorId: null, ID: 200, Name: 'Empty Area' },
    ])
    const instance = registry.areas.getById(200)!
    const facade = new AreaFacade(api, registry, instance)

    await expect(facade.getFrostProtection()).rejects.toThrow(
      'No device id found',
    )
  })
})

describe('deviceAtaFacade', () => {
  it('returns device data', () => {
    const registry = createRegistry()
    const api = createMockApi()
    const instance = registry.devices.getById(1000)!
    assertDeviceType(instance, DeviceType.Ata)
    const facade = new DeviceAtaFacade(api, registry, instance)

    expect(facade.data.Power).toBe(true)
    expect(facade.type).toBe(DeviceType.Ata)
  })

  it('returns self as devices array', () => {
    const registry = createRegistry()
    const api = createMockApi()
    const instance = registry.devices.getById(1000)!
    assertDeviceType(instance, DeviceType.Ata)
    const facade = new DeviceAtaFacade(api, registry, instance)

    expect(facade.devices).toHaveLength(1)
    expect(facade.devices[0]!.id).toBe(1000)
  })

  it('fetches device data', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.devices.getById(1000)!
    assertDeviceType(instance, DeviceType.Ata)
    const facade = new DeviceAtaFacade(api, registry, instance)
    const data = await facade.fetch()

    expect(data.Power).toBe(true)
    expect(api.fetch).toHaveBeenCalled()
  })

  it('calls getValues', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.devices.getById(1000)!
    assertDeviceType(instance, DeviceType.Ata)
    const facade = new DeviceAtaFacade(api, registry, instance)
    await facade.getValues()

    expect(api.values).toHaveBeenCalled()
  })

  it('calls energy', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.devices.getById(1000)!
    assertDeviceType(instance, DeviceType.Ata)
    const facade = new DeviceAtaFacade(api, registry, instance)
    await facade.energy()

    expect(api.energy).toHaveBeenCalled()
  })

  it('calls energy with query', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.devices.getById(1000)!
    assertDeviceType(instance, DeviceType.Ata)
    const facade = new DeviceAtaFacade(api, registry, instance)
    await facade.energy({ from: '2024-01-01', to: '2024-01-31' })

    expect(api.energy).toHaveBeenCalled()
  })

  it('calls operationModes', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.devices.getById(1000)!
    assertDeviceType(instance, DeviceType.Ata)
    const facade = new DeviceAtaFacade(api, registry, instance)
    const result = await facade.operationModes()

    expect(result).toHaveProperty('labels')
    expect(result).toHaveProperty('series')
  })

  it('calls temperatures', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.devices.getById(1000)!
    assertDeviceType(instance, DeviceType.Ata)
    const facade = new DeviceAtaFacade(api, registry, instance)
    const result = await facade.temperatures()

    expect(result).toHaveProperty('series')
    expect(api.temperatures).toHaveBeenCalled()
  })

  it('calls internalTemperatures', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.devices.getById(1000)!
    assertDeviceType(instance, DeviceType.Ata)
    const facade = new DeviceAtaFacade(api, registry, instance)
    const result = await facade.internalTemperatures()

    expect(result).toHaveProperty('series')
    expect(api.internalTemperatures).toHaveBeenCalled()
  })

  it('calls hourlyTemperatures', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.devices.getById(1000)!
    assertDeviceType(instance, DeviceType.Ata)
    const facade = new DeviceAtaFacade(api, registry, instance)
    const result = await facade.hourlyTemperatures(12)

    expect(result).toHaveProperty('series')
    expect(api.hourlyTemperatures).toHaveBeenCalled()
  })

  it('calls getTiles without selection', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.devices.getById(1000)!
    assertDeviceType(instance, DeviceType.Ata)
    const facade = new DeviceAtaFacade(api, registry, instance)
    const result = await facade.getTiles()

    expect(result).toHaveProperty('Tiles')
  })

  it('calls getTiles with true selection', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.devices.getById(1000)!
    assertDeviceType(instance, DeviceType.Ata)
    const facade = new DeviceAtaFacade(api, registry, instance)
    const result = await facade.getTiles(true)

    expect(result).toHaveProperty('Tiles')
  })

  it('setValues calls api.setValues', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.devices.getById(1000)!
    assertDeviceType(instance, DeviceType.Ata)
    const facade = new DeviceAtaFacade(api, registry, instance)
    await facade.setValues({ Power: false })

    expect(api.setValues).toHaveBeenCalled()
  })

  it('setValues throws when no data differs', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.devices.getById(1000)!
    assertDeviceType(instance, DeviceType.Ata)
    const facade = new DeviceAtaFacade(api, registry, instance)

    await expect(
      facade.setValues({
        OperationMode: OperationMode.heat,
        Power: true,
        SetTemperature: 24,
      }),
    ).rejects.toThrow('No data to set')
  })

  it('clamps target temperature to operation mode range', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.devices.getById(1000)!
    assertDeviceType(instance, DeviceType.Ata)
    const facade = new DeviceAtaFacade(api, registry, instance)
    await facade.setValues({ SetTemperature: 0 })
    const call = vi.mocked(api.setValues).mock.lastCall?.[0]

    expect(
      mock<SetDevicePostData<typeof DeviceType.Ata>>(call.postData)
        .SetTemperature,
    ).toBeGreaterThanOrEqual(10)
  })

  it('handles temperature clamping with operation mode change', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.devices.getById(1000)!
    assertDeviceType(instance, DeviceType.Ata)
    const facade = new DeviceAtaFacade(api, registry, instance)
    await facade.setValues({
      OperationMode: OperationMode.cool,
      SetTemperature: 50,
    })
    const call = vi.mocked(api.setValues).mock.lastCall?.[0]

    expect(
      mock<SetDevicePostData<typeof DeviceType.Ata>>(call.postData)
        .SetTemperature,
    ).toBeLessThanOrEqual(31)
  })
})

describe('deviceAtwFacade', () => {
  it('returns device data', () => {
    const registry = createRegistry()
    const api = createMockApi()
    const instance = registry.devices.getById(1001)!
    assertDeviceType(instance, DeviceType.Atw)
    const facade = new DeviceAtwFacade(api, registry, instance)

    expect(facade.type).toBe(DeviceType.Atw)
  })

  it('clamps target temperatures', async () => {
    const api = createMockApi({
      setValues: vi.fn().mockResolvedValue({
        data: {
          DeviceType: DeviceType.Atw,
          EffectiveFlags: 0x1,
          ForcedHotWaterMode: false,
          LastCommunication: '',
          NextCommunication: '',
          Offline: false,
          OperationModeZone1: 0,
          OperationModeZone2: 0,
          Power: true,
          SetCoolFlowTemperatureZone1: 5,
          SetCoolFlowTemperatureZone2: 5,
          SetHeatFlowTemperatureZone1: 25,
          SetHeatFlowTemperatureZone2: 25,
          SetTankWaterTemperature: 40,
          SetTemperatureZone1: 10,
          SetTemperatureZone2: 10,
        },
      }),
    })
    const registry = createRegistry()
    const instance = registry.devices.getById(1001)!
    assertDeviceType(instance, DeviceType.Atw)
    const facade = new DeviceAtwFacade(api, registry, instance)
    await facade.setValues({ SetTemperatureZone1: 0 })
    const call = vi.mocked(api.setValues).mock.lastCall?.[0]

    expect(
      mock<SetDevicePostData<typeof DeviceType.Atw>>(call.postData)
        .SetTemperatureZone1,
    ).toBeGreaterThanOrEqual(10)
  })

  it('uses DEFAULT_TEMPERATURE when a temperature key is null', async () => {
    const api = createMockApi({
      setValues: vi.fn().mockResolvedValue({
        data: {
          DeviceType: DeviceType.Atw,
          EffectiveFlags: 0x1,
          ForcedHotWaterMode: false,
          LastCommunication: '',
          NextCommunication: '',
          Offline: false,
          OperationModeZone1: 0,
          OperationModeZone2: 0,
          Power: true,
          SetCoolFlowTemperatureZone1: 5,
          SetCoolFlowTemperatureZone2: 5,
          SetHeatFlowTemperatureZone1: 25,
          SetHeatFlowTemperatureZone2: 25,
          SetTankWaterTemperature: 40,
          SetTemperatureZone1: 10,
          SetTemperatureZone2: 10,
        },
      }),
    })
    const registry = createRegistry()
    const instance = registry.devices.getById(1001)!
    assertDeviceType(instance, DeviceType.Atw)
    const facade = new DeviceAtwFacade(api, registry, instance)
    await facade.setValues({
      SetTemperatureZone1: mock<{ value: number }>().value,
    })
    const call = vi.mocked(api.setValues).mock.lastCall?.[0]

    expect(
      mock<SetDevicePostData<typeof DeviceType.Atw>>(call.postData)
        .SetTemperatureZone1,
    ).toBe(10)
  })

  it('merges internal temperatures into temperatures', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.devices.getById(1001)!
    assertDeviceType(instance, DeviceType.Atw)
    const facade = new DeviceAtwFacade(api, registry, instance)
    const result = await facade.temperatures()

    expect(result).toHaveProperty('series')
  })
})

describe('deviceAtwHasZone2Facade', () => {
  it('handles operation mode zone adjustments', async () => {
    const zone2Registry = new ModelRegistry()
    zone2Registry.syncBuildings([buildingData({ HMDefined: true })])
    zone2Registry.syncFloors([floorData()])
    zone2Registry.syncAreas([areaData()])
    zone2Registry.syncDevices([
      atwDevice({ Device: atwDeviceData({ HasZone2: true }) }),
    ])
    const api = createMockApi({
      setValues: vi.fn().mockResolvedValue({
        data: {
          DeviceType: DeviceType.Atw,
          EffectiveFlags: 0x8,
          ForcedHotWaterMode: false,
          LastCommunication: '',
          NextCommunication: '',
          Offline: false,
          OperationModeZone1: OperationModeZone.flow,
          OperationModeZone2: OperationModeZone.flow,
          Power: true,
          SetCoolFlowTemperatureZone1: 20,
          SetCoolFlowTemperatureZone2: 20,
          SetHeatFlowTemperatureZone1: 40,
          SetHeatFlowTemperatureZone2: 40,
          SetTankWaterTemperature: 50,
          SetTemperatureZone1: 22,
          SetTemperatureZone2: 22,
        },
      }),
    })
    const instance = zone2Registry.devices.getById(1001)!
    assertDeviceType(instance, DeviceType.Atw)
    const facade = new DeviceAtwHasZone2Facade(api, zone2Registry, instance)
    await facade.setValues({
      OperationModeZone1: OperationModeZone.flow,
    })

    expect(api.setValues).toHaveBeenCalled()
  })

  it('adjusts secondary zone when primary changes to cool mode', async () => {
    const zone2Registry = new ModelRegistry()
    zone2Registry.syncBuildings([buildingData({ HMDefined: true })])
    zone2Registry.syncFloors([floorData()])
    zone2Registry.syncAreas([areaData()])
    zone2Registry.syncDevices([
      atwDevice({ Device: atwDeviceData({ CanCool: true, HasZone2: true }) }),
    ])
    const api = createMockApi({
      setValues: vi.fn().mockResolvedValue({
        data: {
          DeviceType: DeviceType.Atw,
          EffectiveFlags: 0x8,
          ForcedHotWaterMode: false,
          LastCommunication: '',
          NextCommunication: '',
          Offline: false,
          OperationModeZone1: OperationModeZone.room_cool,
          OperationModeZone2: OperationModeZone.room_cool,
          Power: true,
          SetCoolFlowTemperatureZone1: 20,
          SetCoolFlowTemperatureZone2: 20,
          SetHeatFlowTemperatureZone1: 40,
          SetHeatFlowTemperatureZone2: 40,
          SetTankWaterTemperature: 50,
          SetTemperatureZone1: 22,
          SetTemperatureZone2: 22,
        },
      }),
    })
    const instance = zone2Registry.devices.getById(1001)!
    assertDeviceType(instance, DeviceType.Atw)
    const facade = new DeviceAtwHasZone2Facade(api, zone2Registry, instance)
    await facade.setValues({
      OperationModeZone1: OperationModeZone.room_cool,
    })

    expect(api.setValues).toHaveBeenCalled()
  })

  it('adjusts secondary zone down from cool when primary is not cool', async () => {
    const zone2Registry = new ModelRegistry()
    zone2Registry.syncBuildings([buildingData({ HMDefined: true })])
    zone2Registry.syncFloors([floorData()])
    zone2Registry.syncAreas([areaData()])
    zone2Registry.syncDevices([
      atwDevice({
        Device: atwDeviceData({
          CanCool: true,
          HasZone2: true,
          OperationModeZone1: OperationModeZone.room_cool,
          OperationModeZone2: OperationModeZone.room_cool,
        }),
      }),
    ])
    const api = createMockApi({
      setValues: vi.fn().mockResolvedValue({
        data: {
          DeviceType: DeviceType.Atw,
          EffectiveFlags: 0x8,
          ForcedHotWaterMode: false,
          LastCommunication: '',
          NextCommunication: '',
          Offline: false,
          OperationModeZone1: OperationModeZone.room,
          OperationModeZone2: OperationModeZone.room,
          Power: true,
          SetCoolFlowTemperatureZone1: 20,
          SetCoolFlowTemperatureZone2: 20,
          SetHeatFlowTemperatureZone1: 40,
          SetHeatFlowTemperatureZone2: 40,
          SetTankWaterTemperature: 50,
          SetTemperatureZone1: 22,
          SetTemperatureZone2: 22,
        },
      }),
    })
    const instance = zone2Registry.devices.getById(1001)!
    assertDeviceType(instance, DeviceType.Atw)
    const facade = new DeviceAtwHasZone2Facade(api, zone2Registry, instance)
    await facade.setValues({
      OperationModeZone1: OperationModeZone.room,
    })

    expect(api.setValues).toHaveBeenCalled()
  })

  it('adjusts secondary when both zones change', async () => {
    const zone2Registry = new ModelRegistry()
    zone2Registry.syncBuildings([buildingData({ HMDefined: true })])
    zone2Registry.syncFloors([floorData()])
    zone2Registry.syncAreas([areaData()])
    zone2Registry.syncDevices([
      atwDevice({ Device: atwDeviceData({ HasZone2: true }) }),
    ])
    const api = createMockApi({
      setValues: vi.fn().mockResolvedValue({
        data: {
          DeviceType: DeviceType.Atw,
          EffectiveFlags: 0x18,
          ForcedHotWaterMode: false,
          LastCommunication: '',
          NextCommunication: '',
          Offline: false,
          OperationModeZone1: OperationModeZone.flow,
          OperationModeZone2: OperationModeZone.room,
          Power: true,
          SetCoolFlowTemperatureZone1: 20,
          SetCoolFlowTemperatureZone2: 20,
          SetHeatFlowTemperatureZone1: 40,
          SetHeatFlowTemperatureZone2: 40,
          SetTankWaterTemperature: 50,
          SetTemperatureZone1: 22,
          SetTemperatureZone2: 22,
        },
      }),
    })
    const instance = zone2Registry.devices.getById(1001)!
    assertDeviceType(instance, DeviceType.Atw)
    const facade = new DeviceAtwHasZone2Facade(api, zone2Registry, instance)
    await facade.setValues({
      OperationModeZone2: OperationModeZone.flow,
    })

    expect(api.setValues).toHaveBeenCalled()
  })
})

describe('baseDeviceFacade getTiles', () => {
  it('calls super.getTiles when passed a different device instance', async () => {
    const api = createMockApi()
    const registry = createRegistry()
    const instance = registry.devices.getById(1000)!
    assertDeviceType(instance, DeviceType.Ata)
    const facade = new DeviceAtaFacade(api, registry, instance)
    const otherDevice = registry.devices.getById(1001)!
    assertDeviceType(otherDevice, DeviceType.Atw)
    const result = await facade.getTiles(
      mock<DeviceModelAta>(cast(otherDevice)),
    )

    expect(result).toHaveProperty('Tiles')
  })
})

describe('deviceAtwHasZone2Facade secondary curve to cool', () => {
  it('converts curve to room_cool when primary is cool', async () => {
    const zone2Registry = new ModelRegistry()
    zone2Registry.syncBuildings([buildingData({ HMDefined: true })])
    zone2Registry.syncFloors([floorData()])
    zone2Registry.syncAreas([areaData()])
    zone2Registry.syncDevices([
      atwDevice({
        Device: atwDeviceData({
          CanCool: true,
          HasZone2: true,
          OperationModeZone1: OperationModeZone.room,
          OperationModeZone2: OperationModeZone.curve,
        }),
      }),
    ])
    const api = createMockApi({
      setValues: vi.fn().mockResolvedValue({
        data: {
          DeviceType: DeviceType.Atw,
          EffectiveFlags: 0x8,
          ForcedHotWaterMode: false,
          LastCommunication: '',
          NextCommunication: '',
          Offline: false,
          OperationModeZone1: OperationModeZone.room_cool,
          OperationModeZone2: OperationModeZone.room_cool,
          Power: true,
          SetCoolFlowTemperatureZone1: 20,
          SetCoolFlowTemperatureZone2: 20,
          SetHeatFlowTemperatureZone1: 40,
          SetHeatFlowTemperatureZone2: 40,
          SetTankWaterTemperature: 50,
          SetTemperatureZone1: 22,
          SetTemperatureZone2: 22,
        },
      }),
    })
    const instance = zone2Registry.devices.getById(1001)!
    assertDeviceType(instance, DeviceType.Atw)
    const facade = new DeviceAtwHasZone2Facade(api, zone2Registry, instance)
    await facade.setValues({
      OperationModeZone1: OperationModeZone.room_cool,
    })

    expect(api.setValues).toHaveBeenCalled()
  })
})

describe('deviceAtwHasZone2Facade no operation mode change', () => {
  it('returns null when neither zone changes', async () => {
    const zone2Registry = new ModelRegistry()
    zone2Registry.syncBuildings([buildingData({ HMDefined: true })])
    zone2Registry.syncFloors([floorData()])
    zone2Registry.syncAreas([areaData()])
    zone2Registry.syncDevices([
      atwDevice({ Device: atwDeviceData({ HasZone2: true }) }),
    ])
    const api = createMockApi({
      setValues: vi.fn().mockResolvedValue({
        data: {
          DeviceType: DeviceType.Atw,
          EffectiveFlags: 0x1,
          ForcedHotWaterMode: false,
          LastCommunication: '',
          NextCommunication: '',
          Offline: false,
          OperationModeZone1: OperationModeZone.room,
          OperationModeZone2: OperationModeZone.room,
          Power: false,
          SetCoolFlowTemperatureZone1: 20,
          SetCoolFlowTemperatureZone2: 20,
          SetHeatFlowTemperatureZone1: 40,
          SetHeatFlowTemperatureZone2: 40,
          SetTankWaterTemperature: 50,
          SetTemperatureZone1: 22,
          SetTemperatureZone2: 22,
        },
      }),
    })
    const instance = zone2Registry.devices.getById(1001)!
    assertDeviceType(instance, DeviceType.Atw)
    const facade = new DeviceAtwHasZone2Facade(api, zone2Registry, instance)
    await facade.setValues({ Power: false })

    expect(api.setValues).toHaveBeenCalled()
  })
})

describe('deviceAtwHasZone2Facade CanCool false', () => {
  it('skips cool adjustment when CanCool is false', async () => {
    const zone2Registry = new ModelRegistry()
    zone2Registry.syncBuildings([buildingData({ HMDefined: true })])
    zone2Registry.syncFloors([floorData()])
    zone2Registry.syncAreas([areaData()])
    zone2Registry.syncDevices([
      atwDevice({
        Device: atwDeviceData({
          CanCool: false,
          HasZone2: true,
          OperationModeZone1: OperationModeZone.room,
          OperationModeZone2: OperationModeZone.flow,
        }),
      }),
    ])
    const api = createMockApi({
      setValues: vi.fn().mockResolvedValue({
        data: {
          DeviceType: DeviceType.Atw,
          EffectiveFlags: 0x8,
          ForcedHotWaterMode: false,
          LastCommunication: '',
          NextCommunication: '',
          Offline: false,
          OperationModeZone1: OperationModeZone.flow,
          OperationModeZone2: OperationModeZone.flow,
          Power: true,
          SetCoolFlowTemperatureZone1: 20,
          SetCoolFlowTemperatureZone2: 20,
          SetHeatFlowTemperatureZone1: 40,
          SetHeatFlowTemperatureZone2: 40,
          SetTankWaterTemperature: 50,
          SetTemperatureZone1: 22,
          SetTemperatureZone2: 22,
        },
      }),
    })
    const instance = zone2Registry.devices.getById(1001)!
    assertDeviceType(instance, DeviceType.Atw)
    const facade = new DeviceAtwHasZone2Facade(api, zone2Registry, instance)
    await facade.setValues({
      OperationModeZone1: OperationModeZone.flow,
    })

    const call = vi.mocked(api.setValues).mock.lastCall?.[0]
    const postData = mock<SetDevicePostData<typeof DeviceType.Atw>>(
      call.postData,
    )

    expect(postData.OperationModeZone2).toBe(OperationModeZone.flow)
  })
})

describe('deviceErvFacade', () => {
  it('returns device data', () => {
    const registry = createRegistry()
    const api = createMockApi()
    const instance = registry.devices.getById(1002)!
    assertDeviceType(instance, DeviceType.Erv)
    const facade = new DeviceErvFacade(api, registry, instance)

    expect(facade.type).toBe(DeviceType.Erv)
  })

  it('filters operation modes for ERV-specific labels', async () => {
    const api = createMockApi({
      operationModes: vi.fn().mockResolvedValue({
        data: [
          { Key: 'Power', Value: 50 },
          { Key: 'ActualRecovery', Value: 30 },
          { Key: 'ActualBypassOperationMode', Value: 10 },
          { Key: 'Heating', Value: 10 },
        ],
      }),
    })
    const registry = createRegistry()
    const instance = registry.devices.getById(1002)!
    assertDeviceType(instance, DeviceType.Erv)
    const facade = new DeviceErvFacade(api, registry, instance)
    const result = await facade.operationModes()

    expect(result.labels).toContain('Power')
    expect(result.labels).toContain('ActualRecovery')
    expect(result.labels).not.toContain('ActualBypassOperationMode')
    expect(result.labels).not.toContain('Heating')
  })
})
