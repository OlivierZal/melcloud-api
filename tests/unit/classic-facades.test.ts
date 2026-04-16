import { describe, expect, it, vi } from 'vitest'

import type { ClassicAPIAdapter } from '../../src/api/index.ts'
import {
  ClassicDeviceType,
  ClassicOperationMode,
  ClassicOperationModeZone,
} from '../../src/constants.ts'
import {
  type ClassicDevice,
  ClassicRegistry,
} from '../../src/entities/index.ts'
import { EntityNotFoundError, NoChangesError } from '../../src/errors/index.ts'
import {
  ClassicAreaFacade,
  ClassicBuildingFacade,
  ClassicDeviceAtaFacade,
  ClassicDeviceAtwFacade,
  ClassicDeviceAtwHasZone2Facade,
  ClassicDeviceErvFacade,
  ClassicFloorFacade,
  hasClassicZone2,
  isClassicAtaFacade,
  isClassicAtwFacade,
  isClassicErvFacade,
} from '../../src/facades/index.ts'
import {
  type ClassicSetDeviceDataAta,
  type ClassicSetDevicePostData,
  toClassicBuildingId,
} from '../../src/types/index.ts'
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
import { assertDeviceType, cast, defined, mock } from '../helpers.ts'

type DeviceModelAta = ClassicDevice<typeof ClassicDeviceType.Ata>

const createRegistry = (): ClassicRegistry => {
  const registry = new ClassicRegistry()
  registry.syncBuildings([buildingData({ HMDefined: true })])
  registry.syncFloors([floorData()])
  registry.syncAreas([areaData()])
  registry.syncDevices([
    ataDevice({
      ClassicDevice: ataDeviceData({
        OperationMode: ClassicOperationMode.heat,
      }),
    }),
    atwDevice({ ClassicDevice: atwDeviceData({ SetTemperatureZone2: 22 }) }),
    ervDevice(),
  ])
  return registry
}

const createMockApi = (
  overrides: Partial<ClassicAPIAdapter> = {},
): ClassicAPIAdapter =>
  mock({
    fetch: vi.fn().mockResolvedValue([]),
    getEnergy: vi.fn().mockResolvedValue({ data: {} }),
    getErrorEntries: vi.fn().mockResolvedValue({ data: [] }),
    getErrorLog: vi.fn().mockResolvedValue({ errors: [] }),
    getFrostProtection: vi.fn().mockResolvedValue({
      data: frostProtectionResponse({ FPDefined: true }),
    }),
    getGroup: vi.fn().mockResolvedValue({
      data: { Data: { Group: { State: { Power: true } } } },
    }),
    getHolidayMode: vi.fn().mockResolvedValue({
      data: holidayModeResponse({ HMDefined: true }),
    }),
    getHourlyTemperatures: vi.fn().mockResolvedValue({
      data: reportData(),
    }),
    getInternalTemperatures: vi.fn().mockResolvedValue({
      data: reportData(),
    }),
    getOperationModes: vi.fn().mockResolvedValue({
      data: [{ Key: 'Heating', Value: 100 }],
    }),
    getSignal: vi.fn().mockResolvedValue({
      data: reportData(),
    }),
    getTemperatures: vi.fn().mockResolvedValue({
      data: reportData(),
    }),
    getTiles: vi.fn().mockResolvedValue({
      data: { SelectedDevice: null, Tiles: [] },
    }),
    getValues: vi.fn().mockResolvedValue({ data: { EffectiveFlags: 0 } }),
    updateFrostProtection: vi.fn().mockResolvedValue({
      data: { AttributeErrors: null, Success: true },
    }),
    updateGroupState: vi.fn().mockResolvedValue({
      data: { AttributeErrors: null, Success: true },
    }),
    updateHolidayMode: vi.fn().mockResolvedValue({
      data: { AttributeErrors: null, Success: true },
    }),
    updatePower: vi.fn().mockResolvedValue({ data: true }),
    updateValues: vi.fn().mockResolvedValue({
      data: mock<ClassicSetDeviceDataAta>({
        DeviceType: ClassicDeviceType.Ata,
        EffectiveFlags: 0x1,
        LastCommunication: '',
        NextCommunication: '',
        NumberOfFanSpeeds: 5,
        Offline: false,
        OperationMode: ClassicOperationMode.heat,
        Power: true,
        RoomTemperature: 22,
        SetFanSpeed: 3,
        SetTemperature: 24,
        VaneHorizontal: 0,
        VaneVertical: 0,
      }),
    }),
    ...overrides,
  })

const createBuildingFacade = (
  apiOverrides?: Partial<ClassicAPIAdapter>,
): {
  api: ClassicAPIAdapter
  facade: ClassicBuildingFacade
  registry: ClassicRegistry
} => {
  const registry = createRegistry()
  const api = createMockApi(apiOverrides)
  const instance = defined(registry.buildings.getById(1))
  return {
    api,
    facade: new ClassicBuildingFacade(api, registry, instance),
    registry,
  }
}

const createFloorFacade = (
  apiOverrides?: Partial<ClassicAPIAdapter>,
): {
  api: ClassicAPIAdapter
  facade: ClassicFloorFacade
  registry: ClassicRegistry
} => {
  const registry = createRegistry()
  const api = createMockApi(apiOverrides)
  const instance = defined(registry.floors.getById(10))
  return {
    api,
    facade: new ClassicFloorFacade(api, registry, instance),
    registry,
  }
}

const createAreaFacade = (
  apiOverrides?: Partial<ClassicAPIAdapter>,
): {
  api: ClassicAPIAdapter
  facade: ClassicAreaFacade
  registry: ClassicRegistry
} => {
  const registry = createRegistry()
  const api = createMockApi(apiOverrides)
  const instance = defined(registry.areas.getById(100))
  return {
    api,
    facade: new ClassicAreaFacade(api, registry, instance),
    registry,
  }
}

const createAtaFacade = (
  apiOverrides?: Partial<ClassicAPIAdapter>,
): {
  api: ClassicAPIAdapter
  facade: ClassicDeviceAtaFacade
  registry: ClassicRegistry
} => {
  const registry = createRegistry()
  const api = createMockApi(apiOverrides)
  const instance = defined(registry.devices.getById(1000))
  assertDeviceType(instance, ClassicDeviceType.Ata)
  return {
    api,
    facade: new ClassicDeviceAtaFacade(api, registry, instance),
    registry,
  }
}

const createAtwFacade = (
  apiOverrides?: Partial<ClassicAPIAdapter>,
): {
  api: ClassicAPIAdapter
  facade: ClassicDeviceAtwFacade
  registry: ClassicRegistry
} => {
  const registry = createRegistry()
  const api = createMockApi(apiOverrides)
  const instance = defined(registry.devices.getById(1001))
  assertDeviceType(instance, ClassicDeviceType.Atw)
  return {
    api,
    facade: new ClassicDeviceAtwFacade(api, registry, instance),
    registry,
  }
}

const createErvFacade = (
  apiOverrides?: Partial<ClassicAPIAdapter>,
): {
  api: ClassicAPIAdapter
  facade: ClassicDeviceErvFacade
  registry: ClassicRegistry
} => {
  const registry = createRegistry()
  const api = createMockApi(apiOverrides)
  const instance = defined(registry.devices.getById(1002))
  assertDeviceType(instance, ClassicDeviceType.Erv)
  return {
    api,
    facade: new ClassicDeviceErvFacade(api, registry, instance),
    registry,
  }
}

const atwSetValuesResponse = (
  overrides: Record<string, unknown> = {},
): Partial<ClassicAPIAdapter> => ({
  updateValues: vi.fn().mockResolvedValue({
    data: {
      DeviceType: ClassicDeviceType.Atw,
      EffectiveFlags: 0x1,
      ForcedHotWaterMode: false,
      LastCommunication: '',
      NextCommunication: '',
      Offline: false,
      OperationModeZone1: 0,
      OperationModeZone2: 0,
      Power: true,
      SetCoolFlowTemperatureZone1: 20,
      SetCoolFlowTemperatureZone2: 20,
      SetHeatFlowTemperatureZone1: 40,
      SetHeatFlowTemperatureZone2: 40,
      SetTankWaterTemperature: 50,
      SetTemperatureZone1: 22,
      SetTemperatureZone2: 22,
      ...overrides,
    },
  }),
})

const createZone2Facade = (
  deviceOverrides: Record<string, unknown> = {},
  apiOverrides?: Partial<ClassicAPIAdapter>,
): {
  api: ClassicAPIAdapter
  facade: ClassicDeviceAtwHasZone2Facade
  registry: ClassicRegistry
} => {
  const registry = new ClassicRegistry()
  registry.syncBuildings([buildingData({ HMDefined: true })])
  registry.syncFloors([floorData()])
  registry.syncAreas([areaData()])
  registry.syncDevices([
    atwDevice({
      ClassicDevice: atwDeviceData({ HasZone2: true, ...deviceOverrides }),
    }),
  ])
  const api = createMockApi(apiOverrides)
  const instance = defined(registry.devices.getById(1001))
  assertDeviceType(instance, ClassicDeviceType.Atw)
  return {
    api,
    facade: new ClassicDeviceAtwHasZone2Facade(api, registry, instance),
    registry,
  }
}

describe('building facade', () => {
  it('returns building data', () => {
    const { facade } = createBuildingFacade()

    expect(facade.data.FPDefined).toBe(true)
  })

  it('returns devices by building', () => {
    const { facade } = createBuildingFacade()

    expect(facade.devices).toHaveLength(3)
  })

  it('fetches building data', async () => {
    const { api, facade } = createBuildingFacade()
    const data = await facade.fetch()

    expect(data.FPDefined).toBe(true)
    expect(api.fetch).toHaveBeenCalledWith()
  })

  it('calls updatePower', async () => {
    const { api, facade } = createBuildingFacade()
    const isPowered = await facade.updatePower(true)

    expect(isPowered).toBe(true)
    expect(api.updatePower).toHaveBeenCalledWith(expect.any(Object))
  })

  it('calls getErrorLog', async () => {
    const { facade } = createBuildingFacade()
    const result = await facade.getErrorLog({})

    expect(result).toStrictEqual({ errors: [] })
  })

  it('calls getSignalStrength', async () => {
    const { api, facade } = createBuildingFacade()
    const result = await facade.getSignalStrength(12)

    expect(result).toHaveProperty('series')
    expect(api.getSignal).toHaveBeenCalledWith(expect.any(Object))
  })

  it('calls getTiles without selection', async () => {
    const { facade } = createBuildingFacade()
    const result = await facade.getTiles()

    expect(result).toHaveProperty('Tiles')
  })

  it('calls getTiles with device selection', async () => {
    const { facade, registry } = createBuildingFacade()
    const device = defined(registry.devices.getById(1000))
    assertDeviceType(device, ClassicDeviceType.Ata)
    const result = await facade.getTiles(device)

    expect(result).toHaveProperty('Tiles')
  })

  it('calls notifySync', async () => {
    const onSync = vi.fn()
    const { facade } = createBuildingFacade({ onSync })
    await facade.notifySync()

    expect(onSync).toHaveBeenCalledWith(expect.any(Object))
  })
})

describe('building facade frost protection', () => {
  it('gets frost protection with defined settings', async () => {
    const { api, facade } = createBuildingFacade()
    const result = await facade.getFrostProtection()

    expect(result).toHaveProperty('FPDefined')
    expect(api.getFrostProtection).toHaveBeenCalledWith(expect.any(Object))
  })

  it('sets frost protection', async () => {
    const { api, facade } = createBuildingFacade()
    await facade.getFrostProtection()
    const result = await facade.updateFrostProtection({
      isEnabled: true,
      max: 14,
      min: 6,
    })

    expect(result).toHaveProperty('Success')
    expect(api.updateFrostProtection).toHaveBeenCalledWith(expect.any(Object))
  })

  it('clamps frost protection temperatures', async () => {
    const { api, facade } = createBuildingFacade()
    await facade.getFrostProtection()
    await facade.updateFrostProtection({
      max: 2,
      min: 1,
    })
    const call = vi.mocked(api.updateFrostProtection).mock.lastCall?.[0]

    expect(call).toBeDefined()

    expect(defined(call).postData.MinimumTemperature).toBeGreaterThanOrEqual(4)
    expect(defined(call).postData.MaximumTemperature).toBeGreaterThanOrEqual(
      defined(call).postData.MinimumTemperature + 2,
    )
  })

  it('enforces minimum gap between min and max temperatures', async () => {
    const { api, facade } = createBuildingFacade()
    await facade.getFrostProtection()
    await facade.updateFrostProtection({
      max: 15,
      min: 14,
    })
    const call = vi.mocked(api.updateFrostProtection).mock.lastCall?.[0]

    expect(call).toBeDefined()

    expect(
      defined(call).postData.MaximumTemperature -
        defined(call).postData.MinimumTemperature,
    ).toBeGreaterThanOrEqual(2)
  })
})

describe('building facade holiday mode', () => {
  it('gets holiday mode', async () => {
    const { facade } = createBuildingFacade()
    const result = await facade.getHolidayMode()

    expect(result).toHaveProperty('HMDefined')
  })

  it('sets holiday mode with dates', async () => {
    const { facade } = createBuildingFacade()
    await facade.getHolidayMode()
    const result = await facade.updateHolidayMode({
      from: '2024-06-01',
      to: '2024-06-15',
    })

    expect(result).toHaveProperty('Success')
  })

  it('disables holiday mode when no to date', async () => {
    const { api, facade } = createBuildingFacade()
    await facade.getHolidayMode()
    await facade.updateHolidayMode({})
    const call = vi.mocked(api.updateHolidayMode).mock.lastCall?.[0]

    expect(call).toBeDefined()

    expect(defined(call).postData.Enabled).toBe(false)
  })
})

describe('building facade group', () => {
  it('calls getGroup', async () => {
    const { facade } = createBuildingFacade()
    const result = await facade.getGroup()

    expect(result).toHaveProperty('Power')
  })

  it('calls updateGroupState', async () => {
    const { facade } = createBuildingFacade()
    const result = await facade.updateGroupState({ Power: true })

    expect(result).toHaveProperty('Success')
  })

  it('throws when group API fails', async () => {
    const { facade } = createBuildingFacade({
      getGroup: vi.fn().mockRejectedValue(new Error('fail')),
    })

    await expect(facade.getGroup()).rejects.toThrow(
      'No air-to-air device found',
    )
  })

  it('throws when updateGroupState API fails', async () => {
    const { facade } = createBuildingFacade({
      updateGroupState: vi.fn().mockRejectedValue(new Error('fail')),
    })

    await expect(facade.updateGroupState({ Power: true })).rejects.toThrow(
      'No air-to-air device found',
    )
  })
})

describe('floor facade', () => {
  it('returns floor devices', () => {
    const { facade } = createFloorFacade()

    expect(facade.devices).toHaveLength(2)
  })

  it('has correct properties', () => {
    const { facade } = createFloorFacade()

    expect(facade.id).toBe(10)
    expect(facade.name).toBe('ClassicFloor')
  })
})

describe('area facade', () => {
  it('returns area devices', () => {
    const { facade } = createAreaFacade()

    expect(facade.devices).toHaveLength(3)
  })

  it('has correct properties', () => {
    const { facade } = createAreaFacade()

    expect(facade.id).toBe(100)
    expect(facade.name).toBe('ClassicArea')
  })
})

describe('base facade frost protection fallback', () => {
  it('falls back to device frost protection when zone fails', async () => {
    const fpMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('zone not found'))
      .mockResolvedValue({
        data: frostProtectionResponse(),
      })
    const { facade } = createAreaFacade({ getFrostProtection: fpMock })
    const result = await facade.getFrostProtection()

    expect(result).toHaveProperty('FPDefined')
    expect(fpMock).toHaveBeenCalledTimes(2)
  })

  it('uses cached frost protection state on subsequent calls', async () => {
    const fpMock = vi.fn().mockResolvedValue({
      data: frostProtectionResponse({ FPDefined: true }),
    })
    const { facade } = createAreaFacade({ getFrostProtection: fpMock })
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
    const { facade } = createAreaFacade({ getFrostProtection: fpMock })
    const result1 = await facade.getFrostProtection()
    const result2 = await facade.getFrostProtection()

    expect(result2).toStrictEqual(result1)
    expect(fpMock).toHaveBeenCalledTimes(3)
  })
})

describe('base facade holiday mode fallback', () => {
  it('falls back to device holiday mode when zone fails', async () => {
    const hmMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('zone not found'))
      .mockResolvedValue({
        data: holidayModeResponse(),
      })
    const { facade } = createAreaFacade({ getHolidayMode: hmMock })
    const result = await facade.getHolidayMode()

    expect(result).toHaveProperty('HMDefined')
    expect(hmMock).toHaveBeenCalledTimes(2)
  })

  it('uses cached zone-level holiday mode on subsequent calls', async () => {
    const hmMock = vi.fn().mockResolvedValue({
      data: holidayModeResponse({ HMDefined: true }),
    })
    const { facade } = createAreaFacade({ getHolidayMode: hmMock })
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
    const { facade } = createAreaFacade({ getHolidayMode: hmMock })
    const result1 = await facade.getHolidayMode()
    const result2 = await facade.getHolidayMode()

    expect(result2).toStrictEqual(result1)
    expect(hmMock).toHaveBeenCalledTimes(3)
  })
})

describe('base facade frost protection with device fallback', () => {
  it('uses DeviceIds location when frost protection is not defined', async () => {
    const fpMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('zone not found'))
      .mockResolvedValue({
        data: frostProtectionResponse(),
      })
    const { api, facade } = createAreaFacade({ getFrostProtection: fpMock })
    await facade.updateFrostProtection({ max: 14, min: 6 })
    const call = vi.mocked(api.updateFrostProtection).mock.lastCall?.[0]

    expect(call).toBeDefined()

    expect(defined(call).postData).toHaveProperty('DeviceIds')
  })
})

describe('base facade holiday mode with device fallback', () => {
  it('uses Devices location when holiday mode is not defined', async () => {
    const hmMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('zone not found'))
      .mockResolvedValue({
        data: holidayModeResponse(),
      })
    const { api, facade } = createAreaFacade({ getHolidayMode: hmMock })
    await facade.updateHolidayMode({ to: '2024-12-31' })
    const call = vi.mocked(api.updateHolidayMode).mock.lastCall?.[0]

    expect(call).toBeDefined()

    expect(defined(call).postData.HMTimeZones[0]).toHaveProperty('Devices')
  })
})

describe('base device facade type mismatch', () => {
  it('throws when device type does not match facade type', () => {
    const registry = createRegistry()
    const api = createMockApi()
    const instance = defined(registry.devices.getById(1001))
    assertDeviceType(instance, ClassicDeviceType.Atw)
    const facade = new ClassicDeviceAtaFacade(api, registry, cast(instance))

    expect(() => facade.data).toThrow('ClassicDevice type mismatch')
  })
})

describe('base facade instance error', () => {
  it('throws when instance not found in registry', () => {
    const { facade, registry } = createAreaFacade()
    registry.syncAreas([])

    expect(() => facade.name).toThrow('not found')
  })

  it('throws EntityNotFoundError after the entity is evicted from the registry', () => {
    const { facade, registry } = createAreaFacade()
    registry.syncAreas([])

    expect(() => facade.name).toThrow(EntityNotFoundError)
    expect(() => facade.name).toThrow('ClassicArea with id 100 not found')
  })

  it('exists returns true before eviction and false afterwards', () => {
    const { facade, registry } = createAreaFacade()

    expect(facade.exists).toBe(true)

    registry.syncAreas([])

    expect(facade.exists).toBe(false)
  })

  it('throws when no device id for device-level frost protection fallback', async () => {
    const fpMock = vi.fn().mockRejectedValueOnce(new Error('zone not found'))
    const api = createMockApi({ getFrostProtection: fpMock })
    const registry = createRegistry()
    registry.syncAreas([
      {
        BuildingId: toClassicBuildingId(1),
        FloorId: null,
        ID: 200,
        Name: 'Empty ClassicArea',
      },
    ])
    const instance = defined(registry.areas.getById(200))
    const facade = new ClassicAreaFacade(api, registry, instance)

    await expect(facade.getFrostProtection()).rejects.toThrow(
      'No device found for',
    )
  })
})

describe('ata device facade', () => {
  it('returns device data', () => {
    const { facade } = createAtaFacade()

    expect(facade.data.Power).toBe(true)
    expect(facade.type).toBe(ClassicDeviceType.Ata)
  })

  it('returns self as devices array', () => {
    const { facade } = createAtaFacade()

    expect(facade.devices).toHaveLength(1)
    expect(defined(facade.devices[0]).id).toBe(1000)
  })

  it('fetches device data', async () => {
    const { api, facade } = createAtaFacade()
    const data = await facade.fetch()

    expect(data.Power).toBe(true)
    expect(api.fetch).toHaveBeenCalledWith()
  })

  it('calls getValues', async () => {
    const { api, facade } = createAtaFacade()
    await facade.getValues()

    expect(api.getValues).toHaveBeenCalledWith(expect.any(Object))
  })

  it('calls energy', async () => {
    const { api, facade } = createAtaFacade()
    await facade.getEnergy()

    expect(api.getEnergy).toHaveBeenCalledWith(expect.any(Object))
  })

  it('calls energy with query', async () => {
    const { api, facade } = createAtaFacade()
    await facade.getEnergy({ from: '2024-01-01', to: '2024-01-31' })

    expect(api.getEnergy).toHaveBeenCalledWith(expect.any(Object))
  })

  it('calls operationModes', async () => {
    const { facade } = createAtaFacade()
    const result = await facade.getOperationModes()

    expect(result).toHaveProperty('labels')
    expect(result).toHaveProperty('series')
  })

  it('calls temperatures', async () => {
    const { api, facade } = createAtaFacade()
    const result = await facade.getTemperatures()

    expect(result).toHaveProperty('series')
    expect(api.getTemperatures).toHaveBeenCalledWith(expect.any(Object))
  })

  it('calls internalTemperatures', async () => {
    const { api, facade } = createAtaFacade()
    const result = await facade.getInternalTemperatures()

    expect(result).toHaveProperty('series')
    expect(api.getInternalTemperatures).toHaveBeenCalledWith(expect.any(Object))
  })

  it('calls hourlyTemperatures', async () => {
    const { api, facade } = createAtaFacade()
    const result = await facade.getHourlyTemperatures(12)

    expect(result).toHaveProperty('series')
    expect(api.getHourlyTemperatures).toHaveBeenCalledWith(expect.any(Object))
  })

  it('calls getTiles without selection', async () => {
    const { facade } = createAtaFacade()
    const result = await facade.getTiles()

    expect(result).toHaveProperty('Tiles')
  })

  it('calls getTiles with true selection', async () => {
    const { facade } = createAtaFacade()
    const result = await facade.getTiles(true)

    expect(result).toHaveProperty('Tiles')
  })

  it('updateValues calls api.updateValues', async () => {
    const { api, facade } = createAtaFacade()
    await facade.updateValues({ Power: false })

    expect(api.updateValues).toHaveBeenCalledWith(expect.any(Object))
  })

  it('updateValues throws when no data differs', async () => {
    const { facade } = createAtaFacade()

    await expect(
      facade.updateValues({
        OperationMode: ClassicOperationMode.heat,
        Power: true,
        SetTemperature: 24,
      }),
    ).rejects.toThrow(new NoChangesError(1000))
  })

  it('clamps target temperature to operation mode range', async () => {
    const { api, facade } = createAtaFacade()
    await facade.updateValues({ SetTemperature: 0 })
    const call = vi.mocked(api.updateValues).mock.lastCall?.[0]

    expect(call).toBeDefined()

    expect(
      mock<ClassicSetDevicePostData<typeof ClassicDeviceType.Ata>>(
        defined(call).postData,
      ).SetTemperature,
    ).toBeGreaterThanOrEqual(10)
  })

  it('handles temperature clamping with operation mode change', async () => {
    const { api, facade } = createAtaFacade()
    await facade.updateValues({
      OperationMode: ClassicOperationMode.cool,
      SetTemperature: 50,
    })
    const call = vi.mocked(api.updateValues).mock.lastCall?.[0]

    expect(call).toBeDefined()

    expect(
      mock<ClassicSetDevicePostData<typeof ClassicDeviceType.Ata>>(
        defined(call).postData,
      ).SetTemperature,
    ).toBeLessThanOrEqual(31)
  })
})

describe('atw device facade', () => {
  it('returns device data', () => {
    const { facade } = createAtwFacade()

    expect(facade.type).toBe(ClassicDeviceType.Atw)
  })

  it('clamps target temperatures', async () => {
    const { api, facade } = createAtwFacade(
      atwSetValuesResponse({
        SetCoolFlowTemperatureZone1: 5,
        SetCoolFlowTemperatureZone2: 5,
        SetHeatFlowTemperatureZone1: 25,
        SetHeatFlowTemperatureZone2: 25,
        SetTankWaterTemperature: 40,
        SetTemperatureZone1: 10,
        SetTemperatureZone2: 10,
      }),
    )
    await facade.updateValues({ SetTemperatureZone1: 0 })
    const call = vi.mocked(api.updateValues).mock.lastCall?.[0]

    expect(call).toBeDefined()

    expect(
      mock<ClassicSetDevicePostData<typeof ClassicDeviceType.Atw>>(
        defined(call).postData,
      ).SetTemperatureZone1,
    ).toBeGreaterThanOrEqual(10)
  })

  it('uses DEFAULT_TEMPERATURE when a temperature key is null', async () => {
    const { api, facade } = createAtwFacade(
      atwSetValuesResponse({
        SetCoolFlowTemperatureZone1: 5,
        SetCoolFlowTemperatureZone2: 5,
        SetHeatFlowTemperatureZone1: 25,
        SetHeatFlowTemperatureZone2: 25,
        SetTankWaterTemperature: 40,
        SetTemperatureZone1: 10,
        SetTemperatureZone2: 10,
      }),
    )
    await facade.updateValues({
      SetTemperatureZone1: mock<{ value: number }>().value,
    })
    const call = vi.mocked(api.updateValues).mock.lastCall?.[0]

    expect(call).toBeDefined()

    expect(
      mock<ClassicSetDevicePostData<typeof ClassicDeviceType.Atw>>(
        defined(call).postData,
      ).SetTemperatureZone1,
    ).toBe(10)
  })

  it('merges internal temperatures into temperatures', async () => {
    const { facade } = createAtwFacade()
    const result = await facade.getTemperatures()

    expect(result).toHaveProperty('series')
  })
})

describe('atw device facade with zone 2', () => {
  it('handles operation mode zone adjustments', async () => {
    const { api, facade } = createZone2Facade(
      {},
      atwSetValuesResponse({
        EffectiveFlags: 0x8,
        OperationModeZone1: ClassicOperationModeZone.flow,
        OperationModeZone2: ClassicOperationModeZone.flow,
      }),
    )
    await facade.updateValues({
      OperationModeZone1: ClassicOperationModeZone.flow,
    })

    expect(api.updateValues).toHaveBeenCalledWith(expect.any(Object))
  })

  it('adjusts secondary zone when primary changes to cool mode', async () => {
    const { api, facade } = createZone2Facade(
      { CanCool: true },
      atwSetValuesResponse({
        EffectiveFlags: 0x8,
        OperationModeZone1: ClassicOperationModeZone.room_cool,
        OperationModeZone2: ClassicOperationModeZone.room_cool,
      }),
    )
    await facade.updateValues({
      OperationModeZone1: ClassicOperationModeZone.room_cool,
    })

    expect(api.updateValues).toHaveBeenCalledWith(expect.any(Object))
  })

  it('adjusts secondary zone down from cool when primary is not cool', async () => {
    const { api, facade } = createZone2Facade(
      {
        CanCool: true,
        OperationModeZone1: ClassicOperationModeZone.room_cool,
        OperationModeZone2: ClassicOperationModeZone.room_cool,
      },
      atwSetValuesResponse({
        EffectiveFlags: 0x8,
        OperationModeZone1: ClassicOperationModeZone.room,
        OperationModeZone2: ClassicOperationModeZone.room,
      }),
    )
    await facade.updateValues({
      OperationModeZone1: ClassicOperationModeZone.room,
    })

    expect(api.updateValues).toHaveBeenCalledWith(expect.any(Object))
  })

  it('adjusts secondary when both zones change', async () => {
    const { api, facade } = createZone2Facade(
      {},
      atwSetValuesResponse({
        EffectiveFlags: 0x18,
        OperationModeZone1: ClassicOperationModeZone.flow,
        OperationModeZone2: ClassicOperationModeZone.room,
      }),
    )
    await facade.updateValues({
      OperationModeZone2: ClassicOperationModeZone.flow,
    })

    expect(api.updateValues).toHaveBeenCalledWith(expect.any(Object))
  })

  it('throws on invalid secondary operation mode zone value', async () => {
    const { facade } = createZone2Facade({
      CanCool: true,
      OperationModeZone2: ClassicOperationModeZone.flow_cool,
    })

    await expect(
      facade.updateValues({
        OperationModeZone1: ClassicOperationModeZone.room_cool,
      }),
    ).rejects.toThrow('Invalid ClassicOperationModeZone')
  })
})

describe('device type guards', () => {
  it.each([
    {
      guard: isClassicAtaFacade,
      match: createAtaFacade,
      name: 'isClassicAtaFacade',
      noMatch: createAtwFacade,
    },
    {
      guard: isClassicAtwFacade,
      match: createAtwFacade,
      name: 'isClassicAtwFacade',
      noMatch: createAtaFacade,
    },
    {
      guard: isClassicErvFacade,
      match: createErvFacade,
      name: 'isClassicErvFacade',
      noMatch: createAtaFacade,
    },
  ])(
    '$name returns true for matching facade and false otherwise',
    ({ guard, match, noMatch }) => {
      expect(guard(match().facade)).toBe(true)
      expect(guard(noMatch().facade)).toBe(false)
    },
  )
})

describe(hasClassicZone2, () => {
  it('returns true for zone2 facade', () => {
    const { facade } = createZone2Facade()

    expect(hasClassicZone2(facade)).toBe(true)
  })

  it('returns false for non-zone2 facade', () => {
    const { facade } = createAtwFacade()

    expect(hasClassicZone2(facade)).toBe(false)
  })
})

describe('base device facade tiles', () => {
  it('calls super.getTiles when passed a different device instance', async () => {
    const { facade, registry } = createAtaFacade()
    const otherDevice = defined(registry.devices.getById(1001))
    assertDeviceType(otherDevice, ClassicDeviceType.Atw)
    const result = await facade.getTiles(
      mock<DeviceModelAta>(cast(otherDevice)),
    )

    expect(result).toHaveProperty('Tiles')
  })
})

describe('atw zone 2 facade secondary curve to cool', () => {
  it('converts curve to room_cool when primary is cool', async () => {
    const { api, facade } = createZone2Facade(
      {
        CanCool: true,
        OperationModeZone1: ClassicOperationModeZone.room,
        OperationModeZone2: ClassicOperationModeZone.curve,
      },
      atwSetValuesResponse({
        EffectiveFlags: 0x8,
        OperationModeZone1: ClassicOperationModeZone.room_cool,
        OperationModeZone2: ClassicOperationModeZone.room_cool,
      }),
    )
    await facade.updateValues({
      OperationModeZone1: ClassicOperationModeZone.room_cool,
    })

    expect(api.updateValues).toHaveBeenCalledWith(expect.any(Object))
  })
})

describe('atw zone 2 facade no operation mode change', () => {
  it('returns null when neither zone changes', async () => {
    const { api, facade } = createZone2Facade(
      {},
      atwSetValuesResponse({
        OperationModeZone1: ClassicOperationModeZone.room,
        OperationModeZone2: ClassicOperationModeZone.room,
        Power: false,
      }),
    )
    await facade.updateValues({ Power: false })

    expect(api.updateValues).toHaveBeenCalledWith(expect.any(Object))
  })
})

describe('atw zone 2 facade CanCool false', () => {
  it('skips cool adjustment when CanCool is false', async () => {
    const { api, facade } = createZone2Facade(
      {
        CanCool: false,
        OperationModeZone1: ClassicOperationModeZone.room,
        OperationModeZone2: ClassicOperationModeZone.flow,
      },
      atwSetValuesResponse({
        EffectiveFlags: 0x8,
        OperationModeZone1: ClassicOperationModeZone.flow,
        OperationModeZone2: ClassicOperationModeZone.flow,
      }),
    )
    await facade.updateValues({
      OperationModeZone1: ClassicOperationModeZone.flow,
    })

    const call = vi.mocked(api.updateValues).mock.lastCall?.[0]

    expect(call).toBeDefined()

    const postData = mock<
      ClassicSetDevicePostData<typeof ClassicDeviceType.Atw>
    >(defined(call).postData)

    expect(postData.OperationModeZone2).toBe(ClassicOperationModeZone.flow)
  })
})

describe('erv device facade', () => {
  it('returns device data', () => {
    const { facade } = createErvFacade()

    expect(facade.type).toBe(ClassicDeviceType.Erv)
  })

  it('filters operation modes for ERV-specific labels', async () => {
    const { facade } = createErvFacade({
      getOperationModes: vi.fn().mockResolvedValue({
        data: [
          { Key: 'Power', Value: 50 },
          { Key: 'ActualRecovery', Value: 30 },
          { Key: 'ActualBypassOperationMode', Value: 10 },
          { Key: 'Heating', Value: 10 },
        ],
      }),
    })
    const result = await facade.getOperationModes()

    expect(result.labels).toContain('Power')
    expect(result.labels).toContain('ActualRecovery')
    expect(result.labels).not.toContain('ActualBypassOperationMode')
    expect(result.labels).not.toContain('Heating')
  })
})
