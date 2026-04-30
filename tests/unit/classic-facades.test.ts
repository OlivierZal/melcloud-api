import { describe, expect, it, vi } from 'vitest'

import type { ClassicAPIAdapter, SyncCallback } from '../../src/api/index.ts'
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
  type ClassicDeviceFacade,
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
  type ClassicSetDevicePostData,
  err,
  ok,
  toClassicBuildingId,
} from '../../src/types/index.ts'
import {
  assertClassicDeviceType,
  classicAreaData,
  classicAtaDevice,
  classicAtaDeviceData,
  classicAtwDevice,
  classicAtwDeviceData,
  classicBuildingData,
  classicErvDevice,
  classicFloorData,
  classicFrostProtectionResponse,
  classicHolidayModeResponse,
  classicReportData,
  createMockClassicApi,
} from '../classic-fixtures.ts'
import { cast, defined, mock, okValue } from '../helpers.ts'

type DeviceModelAta = ClassicDevice<typeof ClassicDeviceType.Ata>

const createRegistry = (): ClassicRegistry => {
  const registry = new ClassicRegistry()
  registry.syncBuildings([classicBuildingData({ HMDefined: true })])
  registry.syncFloors([classicFloorData()])
  registry.syncAreas([classicAreaData()])
  registry.syncDevices([
    classicAtaDevice({
      Device: classicAtaDeviceData({
        OperationMode: ClassicOperationMode.heat,
      }),
    }),
    classicAtwDevice({
      Device: classicAtwDeviceData({ SetTemperatureZone2: 22 }),
    }),
    classicErvDevice(),
  ])
  return registry
}

interface FacadeContext<T> {
  api: ClassicAPIAdapter
  facade: T
  registry: ClassicRegistry
}

const buildFacade = <TFacade, TInstance>(
  // eslint-disable-next-line @typescript-eslint/naming-convention -- PascalCase is the conventional shape for constructor references; the conflicting `new-cap` rule fires otherwise
  Ctor: new (
    api: ClassicAPIAdapter,
    registry: ClassicRegistry,
    instance: TInstance,
  ) => TFacade,
  resolveInstance: (registry: ClassicRegistry) => TInstance,
  apiOverrides?: Partial<ClassicAPIAdapter>,
): FacadeContext<TFacade> => {
  const registry = createRegistry()
  const api = createMockClassicApi(apiOverrides)
  return {
    api,
    facade: new Ctor(api, registry, resolveInstance(registry)),
    registry,
  }
}

const createBuildingFacade = (
  apiOverrides?: Partial<ClassicAPIAdapter>,
): FacadeContext<ClassicBuildingFacade> =>
  buildFacade(
    ClassicBuildingFacade,
    (registry) => defined(registry.buildings.getById(1)),
    apiOverrides,
  )

const createFloorFacade = (
  apiOverrides?: Partial<ClassicAPIAdapter>,
): FacadeContext<ClassicFloorFacade> =>
  buildFacade(
    ClassicFloorFacade,
    (registry) => defined(registry.floors.getById(10)),
    apiOverrides,
  )

const createAreaFacade = (
  apiOverrides?: Partial<ClassicAPIAdapter>,
): FacadeContext<ClassicAreaFacade> =>
  buildFacade(
    ClassicAreaFacade,
    (registry) => defined(registry.areas.getById(100)),
    apiOverrides,
  )

const createAtaFacade = (
  apiOverrides?: Partial<ClassicAPIAdapter>,
): FacadeContext<ClassicDeviceAtaFacade> =>
  buildFacade(
    ClassicDeviceAtaFacade,
    (registry) => {
      const instance = defined(registry.devices.getById(1000))
      assertClassicDeviceType(instance, ClassicDeviceType.Ata)
      return instance
    },
    apiOverrides,
  )

const createAtwFacade = (
  apiOverrides?: Partial<ClassicAPIAdapter>,
): FacadeContext<ClassicDeviceAtwFacade> =>
  buildFacade(
    ClassicDeviceAtwFacade,
    (registry) => {
      const instance = defined(registry.devices.getById(1001))
      assertClassicDeviceType(instance, ClassicDeviceType.Atw)
      return instance
    },
    apiOverrides,
  )

const createErvFacade = (
  apiOverrides?: Partial<ClassicAPIAdapter>,
): FacadeContext<ClassicDeviceErvFacade> =>
  buildFacade(
    ClassicDeviceErvFacade,
    (registry) => {
      const instance = defined(registry.devices.getById(1002))
      assertClassicDeviceType(instance, ClassicDeviceType.Erv)
      return instance
    },
    apiOverrides,
  )

const atwSetValuesResponse = (
  overrides: Record<string, unknown> = {},
): Partial<ClassicAPIAdapter> => ({
  updateValues: cast(
    vi.fn<ClassicAPIAdapter['updateValues']>().mockResolvedValue(
      cast({
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
      }),
    ),
  ),
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
  registry.syncBuildings([classicBuildingData({ HMDefined: true })])
  registry.syncFloors([classicFloorData()])
  registry.syncAreas([classicAreaData()])
  registry.syncDevices([
    classicAtwDevice({
      Device: classicAtwDeviceData({ HasZone2: true, ...deviceOverrides }),
    }),
  ])
  const api = createMockClassicApi(apiOverrides)
  const instance = defined(registry.devices.getById(1001))
  assertClassicDeviceType(instance, ClassicDeviceType.Atw)
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

    expect(okValue(await facade.getErrorLog({}))).toStrictEqual({ errors: [] })
  })

  it('calls getSignalStrength', async () => {
    const { api, facade } = createBuildingFacade()
    const value = okValue(await facade.getSignalStrength(12))

    expect(value).toHaveProperty('series')
    expect(api.getSignal).toHaveBeenCalledWith(expect.any(Object))
  })

  it('calls getTiles without selection', async () => {
    const { facade } = createBuildingFacade()
    const value = okValue(await facade.getTiles())

    expect(value).toHaveProperty('Tiles')
  })

  it('calls getTiles with device selection', async () => {
    const { facade, registry } = createBuildingFacade()
    const device = defined(registry.devices.getById(1000))
    assertClassicDeviceType(device, ClassicDeviceType.Ata)
    const value = okValue(await facade.getTiles(device))

    expect(value).toHaveProperty('Tiles')
  })

  it('calls notifySync', async () => {
    const onSync = vi.fn<SyncCallback>().mockResolvedValue()
    const { facade } = createBuildingFacade({ notifySync: onSync })
    await facade.notifySync()

    expect(onSync).toHaveBeenCalledWith(expect.any(Object))
  })
})

describe('building facade frost protection', () => {
  it('gets frost protection with defined settings', async () => {
    const { api, facade } = createBuildingFacade()
    const value = okValue(await facade.getFrostProtection())

    expect(value).toHaveProperty('FPDefined')
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
    const value = okValue(await facade.getHolidayMode())

    expect(value).toHaveProperty('HMDefined')
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

// Post-condition contract: facade write methods that mutate server
// state must refresh the registry (`updatePower` does so via
// @classicUpdateDevices + @syncDevices; `updateFrostProtection` /
// `updateHolidayMode` do so via @classicFetchDevices({when:'after'})
// because the response carries no device value to apply locally).
// Regression guard for the bug class fixed after
// OlivierZal/com.melcloud#1281 (silent local-state drift). The
// downstream onSync notification from api.fetch() is covered by the
// ClassicAPI contract tests.
describe('facade write methods refresh registry', () => {
  it('updatePower fires onSync directly', async () => {
    const onSync = vi.fn<SyncCallback>().mockResolvedValue()
    const { facade } = createBuildingFacade({ notifySync: onSync })
    await facade.updatePower(true)

    expect(onSync).toHaveBeenCalledWith(expect.objectContaining({}))
  })

  it('updateFrostProtection refreshes via api.fetch()', async () => {
    const { api, facade } = createBuildingFacade()
    await facade.getFrostProtection()
    vi.mocked(api.fetch).mockClear()
    await facade.updateFrostProtection({ isEnabled: true, max: 14, min: 6 })

    expect(api.fetch).toHaveBeenCalledTimes(1)
  })

  it('updateHolidayMode refreshes via api.fetch()', async () => {
    const { api, facade } = createBuildingFacade()
    await facade.getHolidayMode()
    vi.mocked(api.fetch).mockClear()
    await facade.updateHolidayMode({ from: '2024-06-01', to: '2024-06-15' })

    expect(api.fetch).toHaveBeenCalledTimes(1)
  })
})

describe('building facade group', () => {
  it('calls getGroup', async () => {
    const { facade } = createBuildingFacade()
    const value = okValue(await facade.getGroup())

    expect(value).toHaveProperty('Power')
  })

  it('calls updateGroupState', async () => {
    const { facade } = createBuildingFacade()
    const result = await facade.updateGroupState({ Power: true })

    expect(result).toHaveProperty('Success')
  })

  it('propagates network failure when group API fails', async () => {
    const { facade } = createBuildingFacade({
      getGroup: vi
        .fn<ClassicAPIAdapter['getGroup']>()
        .mockResolvedValue(
          err({ cause: new Error('fail'), kind: 'network' as const }),
        ),
    })
    const result = await facade.getGroup()

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.kind).toBe('network')
  })

  it('throws when updateGroupState API fails', async () => {
    const { facade } = createBuildingFacade({
      updateGroupState: vi
        .fn<ClassicAPIAdapter['updateGroupState']>()
        .mockRejectedValue(new Error('fail')),
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
      .fn<ClassicAPIAdapter['getFrostProtection']>()
      .mockResolvedValueOnce(
        err({ cause: new Error('zone not found'), kind: 'network' as const }),
      )
      .mockResolvedValue(ok(classicFrostProtectionResponse()))
    const { facade } = createAreaFacade({ getFrostProtection: fpMock })
    const value = okValue(await facade.getFrostProtection())

    expect(value).toHaveProperty('FPDefined')
    expect(fpMock).toHaveBeenCalledTimes(2)
  })

  it('uses cached frost protection state on subsequent calls', async () => {
    const fpMock = vi
      .fn<ClassicAPIAdapter['getFrostProtection']>()
      .mockResolvedValue(
        ok(classicFrostProtectionResponse({ FPDefined: true })),
      )
    const { facade } = createAreaFacade({ getFrostProtection: fpMock })
    const result1 = await facade.getFrostProtection()
    const result2 = await facade.getFrostProtection()

    expect(result2).toStrictEqual(result1)
    expect(fpMock).toHaveBeenCalledTimes(2)
  })

  it('uses cached device-level frost protection on subsequent calls', async () => {
    const fpMock = vi
      .fn<ClassicAPIAdapter['getFrostProtection']>()
      .mockResolvedValueOnce(
        err({ cause: new Error('zone not found'), kind: 'network' as const }),
      )
      .mockResolvedValue(ok(classicFrostProtectionResponse()))
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
      .fn<ClassicAPIAdapter['getHolidayMode']>()
      .mockResolvedValueOnce(
        err({ cause: new Error('zone not found'), kind: 'network' as const }),
      )
      .mockResolvedValue(ok(classicHolidayModeResponse()))
    const { facade } = createAreaFacade({ getHolidayMode: hmMock })
    const value = okValue(await facade.getHolidayMode())

    expect(value).toHaveProperty('HMDefined')
    expect(hmMock).toHaveBeenCalledTimes(2)
  })

  it('uses cached zone-level holiday mode on subsequent calls', async () => {
    const hmMock = vi
      .fn<ClassicAPIAdapter['getHolidayMode']>()
      .mockResolvedValue(ok(classicHolidayModeResponse({ HMDefined: true })))
    const { facade } = createAreaFacade({ getHolidayMode: hmMock })
    const result1 = await facade.getHolidayMode()
    const result2 = await facade.getHolidayMode()

    expect(result2).toStrictEqual(result1)
    expect(hmMock).toHaveBeenCalledTimes(2)
  })

  it('uses cached device-level holiday mode on subsequent calls', async () => {
    const hmMock = vi
      .fn<ClassicAPIAdapter['getHolidayMode']>()
      .mockResolvedValueOnce(
        err({ cause: new Error('zone not found'), kind: 'network' as const }),
      )
      .mockResolvedValue(ok(classicHolidayModeResponse()))
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
      .fn<ClassicAPIAdapter['getFrostProtection']>()
      .mockResolvedValueOnce(
        err({ cause: new Error('zone not found'), kind: 'network' as const }),
      )
      .mockResolvedValue(ok(classicFrostProtectionResponse()))
    const { api, facade } = createAreaFacade({ getFrostProtection: fpMock })
    await facade.updateFrostProtection({ max: 14, min: 6 })
    const call = vi.mocked(api.updateFrostProtection).mock.lastCall?.[0]

    expect(call).toBeDefined()

    expect(defined(call).postData).toHaveProperty('DeviceIds')
  })

  it('rethrows the original cause when location fetch fails', async () => {
    const cause = new Error('upstream-fail')
    const fpMock = vi
      .fn<ClassicAPIAdapter['getFrostProtection']>()
      .mockResolvedValue(err({ cause, kind: 'network' as const }))
    const { facade } = createAreaFacade({ getFrostProtection: fpMock })

    await expect(
      facade.updateFrostProtection({ max: 14, min: 6 }),
    ).rejects.toBe(cause)
  })

  it('throws a synthesised Error when location failure has no Error cause', async () => {
    const fpMock = vi
      .fn<ClassicAPIAdapter['getFrostProtection']>()
      .mockResolvedValue(err({ kind: 'rate-limited', retryAfterMs: 60_000 }))
    const { facade } = createAreaFacade({ getFrostProtection: fpMock })

    await expect(
      facade.updateFrostProtection({ max: 14, min: 6 }),
    ).rejects.toThrow('Could not resolve location: rate-limited')
  })
})

describe('base facade holiday mode with device fallback', () => {
  it('uses Devices location when holiday mode is not defined', async () => {
    const hmMock = vi
      .fn<ClassicAPIAdapter['getHolidayMode']>()
      .mockResolvedValueOnce(
        err({ cause: new Error('zone not found'), kind: 'network' as const }),
      )
      .mockResolvedValue(ok(classicHolidayModeResponse()))
    const { api, facade } = createAreaFacade({ getHolidayMode: hmMock })
    await facade.updateHolidayMode({ to: '2024-12-31' })
    const call = vi.mocked(api.updateHolidayMode).mock.lastCall?.[0]

    expect(call).toBeDefined()

    expect(defined(call).postData.HMTimeZones[0]).toHaveProperty('Devices')
  })

  it('rethrows the original cause when holiday mode location fetch fails', async () => {
    const cause = new Error('upstream-fail')
    const hmMock = vi
      .fn<ClassicAPIAdapter['getHolidayMode']>()
      .mockResolvedValue(err({ cause, kind: 'network' as const }))
    const { facade } = createAreaFacade({ getHolidayMode: hmMock })

    await expect(facade.updateHolidayMode({ to: '2024-12-31' })).rejects.toBe(
      cause,
    )
  })
})

describe('base device facade type mismatch', () => {
  it('throws when device type does not match facade type', () => {
    const registry = createRegistry()
    const api = createMockClassicApi()
    const instance = defined(registry.devices.getById(1001))
    assertClassicDeviceType(instance, ClassicDeviceType.Atw)
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
    const fpMock = vi
      .fn<ClassicAPIAdapter['getFrostProtection']>()
      .mockResolvedValueOnce(
        err({ cause: new Error('zone not found'), kind: 'network' as const }),
      )
    const api = createMockClassicApi({ getFrostProtection: fpMock })
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
    const value = okValue(await facade.getOperationModes())

    expect(value).toHaveProperty('labels')
    expect(value).toHaveProperty('series')
  })

  it('calls temperatures', async () => {
    const { api, facade } = createAtaFacade()
    const value = okValue(await facade.getTemperatures())

    expect(value).toHaveProperty('series')
    expect(api.getTemperatures).toHaveBeenCalledWith(expect.any(Object))
  })

  it('calls internalTemperatures', async () => {
    const { api, facade } = createAtaFacade()
    const value = okValue(await facade.getInternalTemperatures())

    expect(value).toHaveProperty('series')
    expect(api.getInternalTemperatures).toHaveBeenCalledWith(expect.any(Object))
  })

  it('calls hourlyTemperatures', async () => {
    const { api, facade } = createAtaFacade()
    const value = okValue(await facade.getHourlyTemperatures(12))

    expect(value).toHaveProperty('series')
    expect(api.getHourlyTemperatures).toHaveBeenCalledWith(expect.any(Object))
  })

  it('calls getTiles without selection', async () => {
    const { facade } = createAtaFacade()
    const value = okValue(await facade.getTiles())

    expect(value).toHaveProperty('Tiles')
  })

  it('calls getTiles with true selection', async () => {
    const { facade } = createAtaFacade()
    const value = okValue(await facade.getTiles(true))

    expect(value).toHaveProperty('Tiles')
  })

  it('updateValues calls api.updateValues', async () => {
    const { api, facade } = createAtaFacade()
    await facade.updateValues({ Power: false })

    expect(api.updateValues).toHaveBeenCalledWith(expect.any(Object))
  })

  it('getValues propagates failure without touching the device model', async () => {
    const { facade } = createAtaFacade({
      getValues: vi
        .fn<ClassicAPIAdapter['getValues']>()
        .mockResolvedValue(
          err({ cause: new Error('boom'), kind: 'network' as const }),
        ),
    })
    const result = await facade.getValues()

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.kind).toBe('network')
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
    const value = okValue(await facade.getTemperatures())

    expect(value).toHaveProperty('series')
  })

  it('propagates outer-temperatures failure without calling internal-temperatures', async () => {
    const failingTemperatures = vi
      .fn<ClassicAPIAdapter['getTemperatures']>()
      .mockResolvedValue(
        err({ cause: new Error('boom'), kind: 'network' as const }),
      )
    const internalTemperatures = vi
      .fn<ClassicAPIAdapter['getInternalTemperatures']>()
      .mockResolvedValue(ok(classicReportData()))
    const { facade } = createAtwFacade({
      getInternalTemperatures: internalTemperatures,
      getTemperatures: failingTemperatures,
    })
    const result = await facade.getTemperatures()

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.kind).toBe('network')
    expect(internalTemperatures).not.toHaveBeenCalled()
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
      // Widen through destructuring so the guard's predicate is not
      // trivially inferred at the call site (preserves the runtime check).
      const {
        facade: matching,
      }: { facade: ClassicDeviceFacade<ClassicDeviceType> } = match()
      const {
        facade: nonMatching,
      }: { facade: ClassicDeviceFacade<ClassicDeviceType> } = noMatch()

      expect(guard(matching)).toBe(true)
      expect(guard(nonMatching)).toBe(false)
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
    assertClassicDeviceType(otherDevice, ClassicDeviceType.Atw)
    const value = okValue(
      await facade.getTiles(mock<DeviceModelAta>(cast(otherDevice))),
    )

    expect(value).toHaveProperty('Tiles')
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
      getOperationModes: vi
        .fn<ClassicAPIAdapter['getOperationModes']>()
        .mockResolvedValue(
          ok([
            { Key: 'Power', Value: 50 },
            { Key: 'ActualRecovery', Value: 30 },
            { Key: 'ActualBypassOperationMode', Value: 10 },
            { Key: 'Heating', Value: 10 },
          ]),
        ),
    })
    const { labels } = okValue(await facade.getOperationModes())

    expect(labels).toContain('Power')
    expect(labels).toContain('ActualRecovery')
    expect(labels).not.toContain('ActualBypassOperationMode')
    expect(labels).not.toContain('Heating')
  })
})
