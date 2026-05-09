import { describe, expect, it, vi } from 'vitest'

import type { HomeAPIAdapter } from '../../src/api/home-types.ts'
import { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import { HomeDeviceAtwFacade } from '../../src/facades/home-device-atw.ts'
import { HomeFacadeManager } from '../../src/facades/home-manager.ts'
import { mock } from '../helpers.ts'
import { homeAtwDevice, homeDevice } from '../home-fixtures.ts'

const createModel = (): ReturnType<typeof homeDevice> =>
  homeDevice({ id: 'device-1', name: 'Test ClassicDevice' })

const createApi = (): HomeAPIAdapter =>
  mock<HomeAPIAdapter>({
    getAtaEnergy: vi.fn<HomeAPIAdapter['getAtaEnergy']>(),
    getAtaErrorLog: vi.fn<HomeAPIAdapter['getAtaErrorLog']>(),
    getAtaTemperatures: vi.fn<HomeAPIAdapter['getAtaTemperatures']>(),
    getSignal: vi.fn<HomeAPIAdapter['getSignal']>(),
    updateAtaValues: vi.fn<HomeAPIAdapter['updateAtaValues']>(),
  })

describe('home facade manager', () => {
  it('returns null when no instance is provided', () => {
    const manager = new HomeFacadeManager(createApi())

    expect(manager.get()).toBeNull()
  })

  it('returns an ATA facade for an ATA device model', () => {
    const manager = new HomeFacadeManager(createApi())
    const facade = manager.get(createModel())

    expect(facade).toBeInstanceOf(HomeDeviceAtaFacade)
  })

  it('returns an ATW facade for an ATW device model', () => {
    const manager = new HomeFacadeManager(createApi())
    const facade = manager.get(homeAtwDevice({ id: 'atw-1' }))

    expect(facade).toBeInstanceOf(HomeDeviceAtwFacade)
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
