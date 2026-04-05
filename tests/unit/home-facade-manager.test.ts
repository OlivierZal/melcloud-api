import { describe, expect, it, vi } from 'vitest'

import type { HomeAPI } from '../../src/services/interfaces.ts'
import type { HomeDevice } from '../../src/types/index.ts'
import { HomeDeviceType } from '../../src/constants.ts'
import { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import { HomeFacadeManager } from '../../src/facades/home-manager.ts'
import { HomeDeviceModel } from '../../src/services/home-device-model.ts'
import { mock } from '../helpers.ts'

const createModel = (): HomeDeviceModel =>
  new HomeDeviceModel(
    mock<HomeDevice>({
      capabilities: mock<HomeDevice['capabilities']>(),
      givenDisplayName: 'Test Device',
      id: 'device-1',
      rssi: -50,
      settings: [],
    }),
    HomeDeviceType.Ata,
  )

const createApi = (): HomeAPI =>
  mock<HomeAPI>({
    getEnergy: vi.fn(),
    getErrorLog: vi.fn(),
    getSignal: vi.fn(),
    getTemperatures: vi.fn(),
    setValues: vi.fn(),
  })

describe('home facade manager', () => {
  it('returns null when no instance is provided', () => {
    const manager = new HomeFacadeManager(createApi())

    expect(manager.get()).toBeNull()
  })

  it('returns a facade for a device model', () => {
    const manager = new HomeFacadeManager(createApi())
    const facade = manager.get(createModel())

    expect(facade).toBeInstanceOf(HomeDeviceAtaFacade)
  })

  it('caches facades for the same instance', () => {
    const manager = new HomeFacadeManager(createApi())
    const model = createModel()

    expect(manager.get(model)).toBe(manager.get(model))
  })

  it('returns different facades for different instances', () => {
    const manager = new HomeFacadeManager(createApi())
    const model1 = createModel()
    const model2 = new HomeDeviceModel(
      mock<HomeDevice>({
        capabilities: mock<HomeDevice['capabilities']>(),
        givenDisplayName: 'Other Device',
        id: 'device-2',
        rssi: -60,
        settings: [],
      }),
      HomeDeviceType.Ata,
    )

    expect(manager.get(model1)).not.toBe(manager.get(model2))
  })
})
