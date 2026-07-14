import { describe, expect, it, vi } from 'vitest'

import type { HomeAPIAdapter } from '../../src/api/home-types.ts'
import type { HomeDevice } from '../../src/entities/home-device.ts'
import type { HomeBuildingAtaFacade } from '../../src/facades/home-building-ata.ts'
import type { HomeAtaDeviceData } from '../../src/types/index.ts'
import {
  ClassicFanSpeed,
  ClassicHorizontal,
  ClassicOperationMode,
  ClassicVertical,
  HomeDeviceType,
} from '../../src/constants.ts'
import { HomeRegistry } from '../../src/entities/home-registry.ts'
import { NoChangesError } from '../../src/errors/index.ts'
import {
  aggregateClassicAtaGroupStates,
  toClassicAtaGroupState,
  toGroupFanSpeed,
  toHomeAtaValues,
} from '../../src/facades/home-ata-group.ts'
import { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import { HomeFacadeManager } from '../../src/facades/home-manager.ts'
import { mock, okValue } from '../helpers.ts'
import {
  homeBuildingRef,
  typedHomeAtwDeviceData,
  typedHomeDeviceData,
} from '../home-fixtures.ts'

const heatState = {
  OperationMode: 'Heat',
  Power: 'True',
  SetFanSpeed: 'Two',
  SetTemperature: '21',
  VaneHorizontalDirection: 'Auto',
  VaneVerticalDirection: 'Auto',
}

const createApi = (): HomeAPIAdapter => {
  const registry = new HomeRegistry()
  return mock<HomeAPIAdapter>({
    registry,
    updateAtaValues: vi
      .fn<HomeAPIAdapter['updateAtaValues']>()
      .mockResolvedValue(),
  })
}

const syncBuilding = (
  api: HomeAPIAdapter,
  entries: {
    id: string
    building?: { id: string; name: string }
    settings?: Record<string, string>
  }[],
): void => {
  api.registry.sync(
    entries.map(({ building = homeBuildingRef(), id, settings = {} }) =>
      typedHomeDeviceData(
        { id, settings: { ...heatState, ...settings } },
        { building },
      ),
    ),
  )
}

const ataModels = (api: HomeAPIAdapter): HomeDevice<HomeAtaDeviceData>[] =>
  api.registry
    .getByType(HomeDeviceType.Ata)
    .filter((device): device is HomeDevice<HomeAtaDeviceData> => device.isAta())

describe('home ata group translation', () => {
  it('maps the silent fan speed to null (a group cannot hold silent)', () => {
    expect(toGroupFanSpeed(ClassicFanSpeed.silent)).toBeNull()
    expect(toGroupFanSpeed(ClassicFanSpeed.moderate)).toBe(
      ClassicFanSpeed.moderate,
    )
  })

  it('projects a Home source onto the Classic group state', () => {
    expect(
      toClassicAtaGroupState({
        operationMode: 'Cool',
        power: true,
        setFanSpeed: 'Two',
        setTemperature: 21,
        vaneHorizontalDirection: 'Swing',
        vaneVerticalDirection: 'Swing',
      }),
    ).toStrictEqual({
      FanSpeed: ClassicFanSpeed.slow,
      OperationMode: ClassicOperationMode.cool,
      Power: true,
      SetTemperature: 21,
      VaneHorizontalDirection: ClassicHorizontal.swing,
      VaneVerticalDirection: ClassicVertical.swing,
    })
  })

  it('translates a Classic delta to Home values, dropping null fields', () => {
    expect(
      toHomeAtaValues({
        FanSpeed: null,
        OperationMode: ClassicOperationMode.heat,
        Power: true,
        SetTemperature: 22,
        VaneHorizontalDirection: ClassicHorizontal.auto,
        VaneVerticalDirection: null,
      }),
    ).toStrictEqual({
      operationMode: 'Heat',
      power: true,
      setTemperature: 22,
      vaneHorizontalDirection: 'Auto',
    })
  })

  it('translates an all-null delta to an empty payload', () => {
    expect(toHomeAtaValues({})).toStrictEqual({})
  })

  it('translates a full delta, fan and vertical vane included', () => {
    expect(
      toHomeAtaValues({
        FanSpeed: ClassicFanSpeed.fast,
        OperationMode: ClassicOperationMode.auto,
        Power: false,
        SetTemperature: 19,
        VaneHorizontalDirection: ClassicHorizontal.swing,
        VaneVerticalDirection: ClassicVertical.swing,
      }),
    ).toStrictEqual({
      operationMode: 'Automatic',
      power: false,
      setFanSpeed: 'Four',
      setTemperature: 19,
      vaneHorizontalDirection: 'Swing',
      vaneVerticalDirection: 'Swing',
    })
  })

  it('treats absent member fields as null when aggregating', () => {
    expect(aggregateClassicAtaGroupStates([{}, {}])).toStrictEqual({
      FanSpeed: null,
      OperationMode: null,
      Power: null,
      SetTemperature: null,
      VaneHorizontalDirection: null,
      VaneVerticalDirection: null,
    })
  })

  it('aggregates agreeing states to their shared values', () => {
    const state = {
      FanSpeed: ClassicFanSpeed.slow,
      OperationMode: ClassicOperationMode.cool,
      Power: true,
      SetTemperature: 21,
      VaneHorizontalDirection: ClassicHorizontal.auto,
      VaneVerticalDirection: ClassicVertical.auto,
    }

    expect(aggregateClassicAtaGroupStates([state, { ...state }])).toStrictEqual(
      state,
    )
  })

  it('folds diverging fields to null, the wire mixed marker', () => {
    const aggregated = aggregateClassicAtaGroupStates([
      {
        FanSpeed: ClassicFanSpeed.slow,
        OperationMode: ClassicOperationMode.cool,
        Power: true,
        SetTemperature: 21,
        VaneHorizontalDirection: ClassicHorizontal.auto,
        VaneVerticalDirection: ClassicVertical.auto,
      },
      {
        FanSpeed: ClassicFanSpeed.fast,
        OperationMode: ClassicOperationMode.heat,
        Power: false,
        SetTemperature: 24,
        VaneHorizontalDirection: ClassicHorizontal.swing,
        VaneVerticalDirection: ClassicVertical.swing,
      },
    ])

    expect(aggregated).toStrictEqual({
      FanSpeed: null,
      OperationMode: null,
      Power: null,
      SetTemperature: null,
      VaneHorizontalDirection: null,
      VaneVerticalDirection: null,
    })
  })

  it('aggregates the empty group to the all-null state', () => {
    expect(aggregateClassicAtaGroupStates([])).toStrictEqual({
      FanSpeed: null,
      OperationMode: null,
      Power: null,
      SetTemperature: null,
      VaneHorizontalDirection: null,
      VaneVerticalDirection: null,
    })
  })
})

describe('home device ata facade group', () => {
  it('projects the device state as a group of one', async () => {
    const api = createApi()
    syncBuilding(api, [{ id: 'device-1' }])
    const [model] = ataModels(api)
    const facade = new HomeDeviceAtaFacade(api, mock(model))

    expect(okValue(await facade.getGroup())).toStrictEqual({
      FanSpeed: ClassicFanSpeed.slow,
      OperationMode: ClassicOperationMode.heat,
      Power: true,
      SetTemperature: 21,
      VaneHorizontalDirection: ClassicHorizontal.auto,
      VaneVerticalDirection: ClassicVertical.auto,
    })
  })

  it('pushes a translated group delta through the device update', async () => {
    const api = createApi()
    syncBuilding(api, [{ id: 'device-1' }])
    const [model] = ataModels(api)
    const facade = new HomeDeviceAtaFacade(api, mock(model))

    const result = await facade.updateGroupState({
      OperationMode: ClassicOperationMode.cool,
    })

    expect(result).toStrictEqual({ AttributeErrors: null, Success: true })
    expect(api.updateAtaValues).toHaveBeenCalledWith('device-1', {
      operationMode: 'Cool',
    })
  })

  it('resolves an all-null group delta without a wire call', async () => {
    const api = createApi()
    syncBuilding(api, [{ id: 'device-1' }])
    const [model] = ataModels(api)
    const facade = new HomeDeviceAtaFacade(api, mock(model))

    const result = await facade.updateGroupState({ Power: null })

    expect(result).toStrictEqual({ AttributeErrors: null, Success: true })
    expect(api.updateAtaValues).not.toHaveBeenCalled()
  })

  it('tolerates a device already matching the delta', async () => {
    const api = createApi()
    syncBuilding(api, [{ id: 'device-1' }])
    const [model] = ataModels(api)
    const facade = new HomeDeviceAtaFacade(api, mock(model))
    vi.mocked(api.updateAtaValues).mockRejectedValueOnce(
      new NoChangesError('device-1'),
    )

    await expect(
      facade.updateGroupState({ SetTemperature: 23 }),
    ).resolves.toStrictEqual({ AttributeErrors: null, Success: true })
  })

  it('propagates a real group update failure', async () => {
    const api = createApi()
    syncBuilding(api, [{ id: 'device-1' }])
    const [model] = ataModels(api)
    const facade = new HomeDeviceAtaFacade(api, mock(model))
    vi.mocked(api.updateAtaValues).mockRejectedValue(new Error('BFF failure'))

    await expect(
      facade.updateGroupState({ SetTemperature: 23 }),
    ).rejects.toThrow('BFF failure')
  })
})

const buildingOf = (api: HomeAPIAdapter): HomeBuildingAtaFacade => {
  const manager = new HomeFacadeManager(api)
  const facade = manager.getBuilding('home-building-1')
  if (facade === null) {
    throw new Error('building facade not resolved')
  }
  return facade
}

describe('home building ata facade', () => {
  it('resolves its member devices and display name', () => {
    const api = createApi()
    syncBuilding(api, [{ id: 'device-1' }, { id: 'device-2' }])
    const facade = buildingOf(api)

    expect(facade.id).toBe('home-building-1')
    expect(facade.name).toBe('Home Building')
    expect(facade.devices.map(({ id }) => id)).toStrictEqual([
      'device-1',
      'device-2',
    ])
  })

  it('keeps the last observed name once the building empties', () => {
    const api = createApi()
    syncBuilding(api, [{ id: 'device-1' }])
    const facade = buildingOf(api)
    syncBuilding(api, [
      { building: { id: 'home-building-1', name: 'Renamed' }, id: 'device-1' },
    ])

    expect(facade.name).toBe('Renamed')

    api.registry.sync([])

    expect(facade.devices).toStrictEqual([])
    expect(facade.name).toBe('Renamed')
  })

  it('excludes devices of other buildings and ATW units', () => {
    const api = createApi()
    syncBuilding(api, [
      { id: 'device-1' },
      { building: { id: 'other', name: 'Other' }, id: 'device-2' },
    ])
    api.registry.sync([
      typedHomeDeviceData(
        { id: 'device-1', settings: heatState },
        { building: homeBuildingRef() },
      ),
      typedHomeAtwDeviceData({ id: 'atw-1' }),
    ])
    const facade = buildingOf(api)

    expect(facade.devices.map(({ id }) => id)).toStrictEqual(['device-1'])
  })

  it('aggregates agreeing members into their shared state', async () => {
    const api = createApi()
    syncBuilding(api, [{ id: 'device-1' }, { id: 'device-2' }])
    const facade = buildingOf(api)

    expect(okValue(await facade.getGroup())).toStrictEqual({
      FanSpeed: ClassicFanSpeed.slow,
      OperationMode: ClassicOperationMode.heat,
      Power: true,
      SetTemperature: 21,
      VaneHorizontalDirection: ClassicHorizontal.auto,
      VaneVerticalDirection: ClassicVertical.auto,
    })
  })

  it('folds diverging members to null fields', async () => {
    const api = createApi()
    syncBuilding(api, [
      { id: 'device-1' },
      {
        id: 'device-2',
        settings: { OperationMode: 'Cool', SetTemperature: '19' },
      },
    ])
    const facade = buildingOf(api)
    const state = okValue(await facade.getGroup())

    expect(state.OperationMode).toBeNull()
    expect(state.SetTemperature).toBeNull()
    expect(state.Power).toBe(true)
  })

  it('fans a group delta out to every member', async () => {
    const api = createApi()
    syncBuilding(api, [{ id: 'device-1' }, { id: 'device-2' }])
    const facade = buildingOf(api)

    const result = await facade.updateGroupState({ SetTemperature: 23 })

    expect(result).toStrictEqual({ AttributeErrors: null, Success: true })
    expect(api.updateAtaValues).toHaveBeenCalledTimes(2)
    expect(api.updateAtaValues).toHaveBeenCalledWith('device-1', {
      setTemperature: 23,
    })
    expect(api.updateAtaValues).toHaveBeenCalledWith('device-2', {
      setTemperature: 23,
    })
  })

  it('tolerates members already matching the delta', async () => {
    const api = createApi()
    syncBuilding(api, [{ id: 'device-1' }, { id: 'device-2' }])
    vi.mocked(api.updateAtaValues).mockRejectedValueOnce(
      new NoChangesError('device-1'),
    )
    const facade = buildingOf(api)

    await expect(
      facade.updateGroupState({ SetTemperature: 23 }),
    ).resolves.toStrictEqual({ AttributeErrors: null, Success: true })
  })

  it('propagates a member update failure', async () => {
    const api = createApi()
    syncBuilding(api, [{ id: 'device-1' }])
    vi.mocked(api.updateAtaValues).mockRejectedValue(new Error('BFF failure'))
    const facade = buildingOf(api)

    await expect(
      facade.updateGroupState({ SetTemperature: 23 }),
    ).rejects.toThrow('BFF failure')
  })

  it('resolves an all-null delta without touching any member', async () => {
    const api = createApi()
    syncBuilding(api, [{ id: 'device-1' }])
    const facade = buildingOf(api)

    await facade.updateGroupState({})

    expect(api.updateAtaValues).not.toHaveBeenCalled()
  })
})

describe('home facade manager buildings', () => {
  it('returns null for an unknown building id', () => {
    const api = createApi()
    const manager = new HomeFacadeManager(api)

    expect(manager.getBuilding('missing')).toBeNull()
  })

  it('caches the facade per building id', () => {
    const api = createApi()
    syncBuilding(api, [{ id: 'device-1' }])
    const manager = new HomeFacadeManager(api)

    expect(manager.getBuilding('home-building-1')).toBe(
      manager.getBuilding('home-building-1'),
    )
  })

  it('drops the cached facade once the building empties', () => {
    const api = createApi()
    syncBuilding(api, [{ id: 'device-1' }])
    const manager = new HomeFacadeManager(api)
    const facade = manager.getBuilding('home-building-1')
    api.registry.sync([])

    expect(facade).not.toBeNull()
    expect(manager.getBuilding('home-building-1')).toBeNull()
  })
})

describe('home registry buildings', () => {
  it('groups devices of a type by their source building', () => {
    const registry = new HomeRegistry()
    registry.sync([
      typedHomeDeviceData({ id: 'a' }, { building: { id: 'b1', name: 'One' } }),
      typedHomeDeviceData({ id: 'b' }, { building: { id: 'b2', name: 'Two' } }),
      typedHomeDeviceData({ id: 'c' }, { building: { id: 'b1', name: 'One' } }),
    ])

    expect(
      registry
        .getBuildingsByType(HomeDeviceType.Ata)
        .map(({ devices, id, name }) => ({
          id,
          ids: devices.map((device) => device.id),
          name,
        })),
    ).toStrictEqual([
      { id: 'b1', ids: ['a', 'c'], name: 'One' },
      { id: 'b2', ids: ['b'], name: 'Two' },
    ])
  })

  it('restates the building on every sync', () => {
    const registry = new HomeRegistry()
    registry.sync([
      typedHomeDeviceData({ id: 'a' }, { building: { id: 'b1', name: 'One' } }),
    ])

    expect(registry.getById('a')?.building.id).toBe('b1')

    registry.sync([
      typedHomeDeviceData({ id: 'a' }, { building: { id: 'b2', name: 'Two' } }),
    ])

    expect(registry.getById('a')?.building).toStrictEqual({
      id: 'b2',
      name: 'Two',
    })
  })
})
