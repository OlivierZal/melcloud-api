import { describe, expect, it, vi } from 'vitest'

import type { HomeAPI } from '../../src/api/home-types.ts'
import { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import { HomeFacadeManager } from '../../src/facades/home-manager.ts'
import { mock } from '../helpers.ts'
import { homeDevice } from '../home-fixtures.ts'

const createModel = (): ReturnType<typeof homeDevice> =>
  homeDevice({ id: 'device-1', name: 'Test ClassicDevice' })

const createApi = (): HomeAPI =>
  mock<HomeAPI>({
    getEnergy: vi.fn<HomeAPI['getEnergy']>(),
    getErrorLog: vi.fn<HomeAPI['getErrorLog']>(),
    getSignal: vi.fn<HomeAPI['getSignal']>(),
    getTemperatures: vi.fn<HomeAPI['getTemperatures']>(),
    updateValues: vi.fn<HomeAPI['updateValues']>(),
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
    const model2 = homeDevice({
      id: 'device-2',
      name: 'Other ClassicDevice',
      rssi: -60,
    })

    expect(manager.get(model1)).not.toBe(manager.get(model2))
  })
})
