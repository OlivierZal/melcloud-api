import { describe, expect, it, vi } from 'vitest'

import type { ClassicAPIAdapter } from '../../src/api/index.ts'
import {
  DeviceType,
  OperationMode,
  OperationModeZone,
} from '../../src/constants.ts'
import {
  AreaFacade,
  BuildingFacade,
  DeviceAtaFacade,
  DeviceAtwFacade,
  DeviceAtwHasZone2Facade,
  DeviceErvFacade,
  FloorFacade,
  hasZone2,
  isAtaFacade,
  isAtwFacade,
  isErvFacade,
} from '../../src/facades/index.ts'
import { type Device, ClassicRegistry } from '../../src/models/index.ts'
import {
  type SetDeviceDataAta,
  type SetDevicePostData,
  toBuildingId,
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

type DeviceModelAta = Device<typeof DeviceType.Ata>

const createRegistry = (): ClassicRegistry => {
  const registry = new ClassicRegistry()
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
    ...overrides,
  })

const createBuildingFacade = (
  apiOverrides?: Partial<ClassicAPIAdapter>,
): {
  api: ClassicAPIAdapter
  facade: BuildingFacade
  registry: ClassicRegistry
} => {
  const registry = createRegistry()
  const api = createMockApi(apiOverrides)
  const instance = defined(registry.buildings.getById(1))
  return { api, facade: new BuildingFacade(api, registry, instance), registry }
}

const createFloorFacade = (
  apiOverrides?: Partial<ClassicAPIAdapter>,
): {
  api: ClassicAPIAdapter
  facade: FloorFacade
  registry: ClassicRegistry
} => {
  const registry = createRegistry()
  const api = createMockApi(apiOverrides)
  const instance = defined(registry.floors.getById(10))
  return { api, facade: new FloorFacade(api, registry, instance), registry }
}

const createAreaFacade = (
  apiOverrides?: Partial<ClassicAPIAdapter>,
): {
  api: ClassicAPIAdapter
  facade: AreaFacade
  registry: ClassicRegistry
} => {
  const registry = createRegistry()
  const api = createMockApi(apiOverrides)
  const instance = defined(registry.areas.getById(100))
  return { api, facade: new AreaFacade(api, registry, instance), registry }
}

const createAtaFacade = (
  apiOverrides?: Partial<ClassicAPIAdapter>,
): {
  api: ClassicAPIAdapter
  facade: DeviceAtaFacade
  registry: ClassicRegistry
} => {
  const registry = createRegistry()
  const api = createMockApi(apiOverrides)
  const instance = defined(registry.devices.getById(1000))
  assertDeviceType(instance, DeviceType.Ata)
  return { api, facade: new DeviceAtaFacade(api, registry, instance), registry }
}

const createAtwFacade = (
  apiOverrides?: Partial<ClassicAPIAdapter>,
): {
  api: ClassicAPIAdapter
  facade: DeviceAtwFacade
  registry: ClassicRegistry
} => {
  const registry = createRegistry()
  const api = createMockApi(apiOverrides)
  const instance = defined(registry.devices.getById(1001))
  assertDeviceType(instance, DeviceType.Atw)
  return { api, facade: new DeviceAtwFacade(api, registry, instance), registry }
}

const createErvFacade = (
  apiOverrides?: Partial<ClassicAPIAdapter>,
): {
  api: ClassicAPIAdapter
  facade: DeviceErvFacade
  registry: ClassicRegistry
} => {
  const registry = createRegistry()
  const api = createMockApi(apiOverrides)
  const instance = defined(registry.devices.getById(1002))
  assertDeviceType(instance, DeviceType.Erv)
  return { api, facade: new DeviceErvFacade(api, registry, instance), registry }
}

const atwSetValuesResponse = (
  overrides: Record<string, unknown> = {},
): Partial<ClassicAPIAdapter> => ({
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
  facade: DeviceAtwHasZone2Facade
  registry: ClassicRegistry
} => {
  const registry = new ClassicRegistry()
  registry.syncBuildings([buildingData({ HMDefined: true })])
  registry.syncFloors([floorData()])
  registry.syncAreas([areaData()])
  registry.syncDevices([
    atwDevice({
      Device: atwDeviceData({ HasZone2: true, ...deviceOverrides }),
    }),
  ])
  const api = createMockApi(apiOverrides)
  const instance = defined(registry.devices.getById(1001))
  assertDeviceType(instance, DeviceType.Atw)
  return {
    api,
    facade: new DeviceAtwHasZone2Facade(api, registry, instance),
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

  it('calls setPower', async () => {
    const { api, facade } = createBuildingFacade()
    const isPowered = await facade.setPower(true)

    expect(isPowered).toBe(true)
    expect(api.setPower).toHaveBeenCalledWith(expect.any(Object))
  })

  it('calls getErrors', async () => {
    const { facade } = createBuildingFacade()
    const result = await facade.getErrors({})

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
    assertDeviceType(device, DeviceType.Ata)
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
    const result = await facade.setFrostProtection({
      isEnabled: true,
      max: 14,
      min: 6,
    })

    expect(result).toHaveProperty('Success')
    expect(api.setFrostProtection).toHaveBeenCalledWith(expect.any(Object))
  })

  it('clamps frost protection temperatures', async () => {
    const { api, facade } = createBuildingFacade()
    await facade.getFrostProtection()
    await facade.setFrostProtection({
      max: 2,
      min: 1,
    })
    const call = vi.mocked(api.setFrostProtection).mock.lastCall?.[0]

    expect(call).toBeDefined()

    expect(defined(call).postData.MinimumTemperature).toBeGreaterThanOrEqual(4)
    expect(defined(call).postData.MaximumTemperature).toBeGreaterThanOrEqual(
      defined(call).postData.MinimumTemperature + 2,
    )
  })

  it('enforces minimum gap between min and max temperatures', async () => {
    const { api, facade } = createBuildingFacade()
    await facade.getFrostProtection()
    await facade.setFrostProtection({
      max: 15,
      min: 14,
    })
    const call = vi.mocked(api.setFrostProtection).mock.lastCall?.[0]

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
    const result = await facade.setHolidayMode({
      from: '2024-06-01',
      to: '2024-06-15',
    })

    expect(result).toHaveProperty('Success')
  })

  it('disables holiday mode when no to date', async () => {
    const { api, facade } = createBuildingFacade()
    await facade.getHolidayMode()
    await facade.setHolidayMode({})
    const call = vi.mocked(api.setHolidayMode).mock.lastCall?.[0]

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

  it('calls setGroup', async () => {
    const { facade } = createBuildingFacade()
    const result = await facade.setGroup({ Power: true })

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

  it('throws when setGroup API fails', async () => {
    const { facade } = createBuildingFacade({
      setGroup: vi.fn().mockRejectedValue(new Error('fail')),
    })

    await expect(facade.setGroup({ Power: true })).rejects.toThrow(
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
    expect(facade.name).toBe('Floor')
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
    expect(facade.name).toBe('Area')
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
    await facade.setFrostProtection({ max: 14, min: 6 })
    const call = vi.mocked(api.setFrostProtection).mock.lastCall?.[0]

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
    await facade.setHolidayMode({ to: '2024-12-31' })
    const call = vi.mocked(api.setHolidayMode).mock.lastCall?.[0]

    expect(call).toBeDefined()

    expect(defined(call).postData.HMTimeZones[0]).toHaveProperty('Devices')
  })
})

describe('base device facade type mismatch', () => {
  it('throws when device type does not match facade type', () => {
    const registry = createRegistry()
    const api = createMockApi()
    const instance = defined(registry.devices.getById(1001))
    assertDeviceType(instance, DeviceType.Atw)
    const facade = new DeviceAtaFacade(api, registry, cast(instance))

    expect(() => facade.data).toThrow('Device type mismatch')
  })
})

describe('base facade instance error', () => {
  it('throws when instance not found in registry', () => {
    const { facade, registry } = createAreaFacade()
    registry.syncAreas([])

    expect(() => facade.name).toThrow('not found')
  })

  it('throws when no device id for device-level frost protection fallback', async () => {
    const fpMock = vi.fn().mockRejectedValueOnce(new Error('zone not found'))
    const api = createMockApi({ getFrostProtection: fpMock })
    const registry = createRegistry()
    registry.syncAreas([
      {
        BuildingId: toBuildingId(1),
        FloorId: null,
        ID: 200,
        Name: 'Empty Area',
      },
    ])
    const instance = defined(registry.areas.getById(200))
    const facade = new AreaFacade(api, registry, instance)

    await expect(facade.getFrostProtection()).rejects.toThrow(
      'No device found for',
    )
  })
})

describe('ata device facade', () => {
  it('returns device data', () => {
    const { facade } = createAtaFacade()

    expect(facade.data.Power).toBe(true)
    expect(facade.type).toBe(DeviceType.Ata)
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

  it('setValues calls api.setValues', async () => {
    const { api, facade } = createAtaFacade()
    await facade.setValues({ Power: false })

    expect(api.setValues).toHaveBeenCalledWith(expect.any(Object))
  })

  it('setValues throws when no data differs', async () => {
    const { facade } = createAtaFacade()

    await expect(
      facade.setValues({
        OperationMode: OperationMode.heat,
        Power: true,
        SetTemperature: 24,
      }),
    ).rejects.toThrow('No data to set')
  })

  it('clamps target temperature to operation mode range', async () => {
    const { api, facade } = createAtaFacade()
    await facade.setValues({ SetTemperature: 0 })
    const call = vi.mocked(api.setValues).mock.lastCall?.[0]

    expect(call).toBeDefined()

    expect(
      mock<SetDevicePostData<typeof DeviceType.Ata>>(defined(call).postData)
        .SetTemperature,
    ).toBeGreaterThanOrEqual(10)
  })

  it('handles temperature clamping with operation mode change', async () => {
    const { api, facade } = createAtaFacade()
    await facade.setValues({
      OperationMode: OperationMode.cool,
      SetTemperature: 50,
    })
    const call = vi.mocked(api.setValues).mock.lastCall?.[0]

    expect(call).toBeDefined()

    expect(
      mock<SetDevicePostData<typeof DeviceType.Ata>>(defined(call).postData)
        .SetTemperature,
    ).toBeLessThanOrEqual(31)
  })
})

describe('atw device facade', () => {
  it('returns device data', () => {
    const { facade } = createAtwFacade()

    expect(facade.type).toBe(DeviceType.Atw)
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
    await facade.setValues({ SetTemperatureZone1: 0 })
    const call = vi.mocked(api.setValues).mock.lastCall?.[0]

    expect(call).toBeDefined()

    expect(
      mock<SetDevicePostData<typeof DeviceType.Atw>>(defined(call).postData)
        .SetTemperatureZone1,
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
    await facade.setValues({
      SetTemperatureZone1: mock<{ value: number }>().value,
    })
    const call = vi.mocked(api.setValues).mock.lastCall?.[0]

    expect(call).toBeDefined()

    expect(
      mock<SetDevicePostData<typeof DeviceType.Atw>>(defined(call).postData)
        .SetTemperatureZone1,
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
        OperationModeZone1: OperationModeZone.flow,
        OperationModeZone2: OperationModeZone.flow,
      }),
    )
    await facade.setValues({
      OperationModeZone1: OperationModeZone.flow,
    })

    expect(api.setValues).toHaveBeenCalledWith(expect.any(Object))
  })

  it('adjusts secondary zone when primary changes to cool mode', async () => {
    const { api, facade } = createZone2Facade(
      { CanCool: true },
      atwSetValuesResponse({
        EffectiveFlags: 0x8,
        OperationModeZone1: OperationModeZone.room_cool,
        OperationModeZone2: OperationModeZone.room_cool,
      }),
    )
    await facade.setValues({
      OperationModeZone1: OperationModeZone.room_cool,
    })

    expect(api.setValues).toHaveBeenCalledWith(expect.any(Object))
  })

  it('adjusts secondary zone down from cool when primary is not cool', async () => {
    const { api, facade } = createZone2Facade(
      {
        CanCool: true,
        OperationModeZone1: OperationModeZone.room_cool,
        OperationModeZone2: OperationModeZone.room_cool,
      },
      atwSetValuesResponse({
        EffectiveFlags: 0x8,
        OperationModeZone1: OperationModeZone.room,
        OperationModeZone2: OperationModeZone.room,
      }),
    )
    await facade.setValues({
      OperationModeZone1: OperationModeZone.room,
    })

    expect(api.setValues).toHaveBeenCalledWith(expect.any(Object))
  })

  it('adjusts secondary when both zones change', async () => {
    const { api, facade } = createZone2Facade(
      {},
      atwSetValuesResponse({
        EffectiveFlags: 0x18,
        OperationModeZone1: OperationModeZone.flow,
        OperationModeZone2: OperationModeZone.room,
      }),
    )
    await facade.setValues({
      OperationModeZone2: OperationModeZone.flow,
    })

    expect(api.setValues).toHaveBeenCalledWith(expect.any(Object))
  })

  it('throws on invalid secondary operation mode zone value', async () => {
    const { facade } = createZone2Facade({
      CanCool: true,
      OperationModeZone2: OperationModeZone.flow_cool,
    })

    await expect(
      facade.setValues({
        OperationModeZone1: OperationModeZone.room_cool,
      }),
    ).rejects.toThrow('Invalid OperationModeZone')
  })
})

describe('device type guards', () => {
  it.each([
    {
      guard: isAtaFacade,
      match: createAtaFacade,
      name: 'isAtaFacade',
      noMatch: createAtwFacade,
    },
    {
      guard: isAtwFacade,
      match: createAtwFacade,
      name: 'isAtwFacade',
      noMatch: createAtaFacade,
    },
    {
      guard: isErvFacade,
      match: createErvFacade,
      name: 'isErvFacade',
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

describe(hasZone2, () => {
  it('returns true for zone2 facade', () => {
    const { facade } = createZone2Facade()

    expect(hasZone2(facade)).toBe(true)
  })

  it('returns false for non-zone2 facade', () => {
    const { facade } = createAtwFacade()

    expect(hasZone2(facade)).toBe(false)
  })
})

describe('base device facade tiles', () => {
  it('calls super.getTiles when passed a different device instance', async () => {
    const { facade, registry } = createAtaFacade()
    const otherDevice = defined(registry.devices.getById(1001))
    assertDeviceType(otherDevice, DeviceType.Atw)
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
        OperationModeZone1: OperationModeZone.room,
        OperationModeZone2: OperationModeZone.curve,
      },
      atwSetValuesResponse({
        EffectiveFlags: 0x8,
        OperationModeZone1: OperationModeZone.room_cool,
        OperationModeZone2: OperationModeZone.room_cool,
      }),
    )
    await facade.setValues({
      OperationModeZone1: OperationModeZone.room_cool,
    })

    expect(api.setValues).toHaveBeenCalledWith(expect.any(Object))
  })
})

describe('atw zone 2 facade no operation mode change', () => {
  it('returns null when neither zone changes', async () => {
    const { api, facade } = createZone2Facade(
      {},
      atwSetValuesResponse({
        OperationModeZone1: OperationModeZone.room,
        OperationModeZone2: OperationModeZone.room,
        Power: false,
      }),
    )
    await facade.setValues({ Power: false })

    expect(api.setValues).toHaveBeenCalledWith(expect.any(Object))
  })
})

describe('atw zone 2 facade CanCool false', () => {
  it('skips cool adjustment when CanCool is false', async () => {
    const { api, facade } = createZone2Facade(
      {
        CanCool: false,
        OperationModeZone1: OperationModeZone.room,
        OperationModeZone2: OperationModeZone.flow,
      },
      atwSetValuesResponse({
        EffectiveFlags: 0x8,
        OperationModeZone1: OperationModeZone.flow,
        OperationModeZone2: OperationModeZone.flow,
      }),
    )
    await facade.setValues({
      OperationModeZone1: OperationModeZone.flow,
    })

    const call = vi.mocked(api.setValues).mock.lastCall?.[0]

    expect(call).toBeDefined()

    const postData = mock<SetDevicePostData<typeof DeviceType.Atw>>(
      defined(call).postData,
    )

    expect(postData.OperationModeZone2).toBe(OperationModeZone.flow)
  })
})

describe('erv device facade', () => {
  it('returns device data', () => {
    const { facade } = createErvFacade()

    expect(facade.type).toBe(DeviceType.Erv)
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
