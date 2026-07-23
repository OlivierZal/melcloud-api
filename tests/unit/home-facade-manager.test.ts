import { describe, expect, it, vi } from 'vitest'

import type { HomeAPIAdapter } from '../../src/api/home-types.ts'
import type { HomeDevice } from '../../src/entities/home-device.ts'
import type { HomeRegistry } from '../../src/entities/home-registry.ts'
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

  it('batches frost protection by device type, clamped and enabled-mapped', async () => {
    const devicesById = new Map<string, HomeDevice>([
      ['atw-1', homeAtwDevice({ id: 'atw-1' })],
      ['device-1', createModel()],
    ])
    const api = mock<HomeAPIAdapter>({
      registry: mock<HomeRegistry>({
        getById: vi.fn<HomeRegistry['getById']>((id) => devicesById.get(id)),
      }),
      updateFrostProtection: vi.fn<HomeAPIAdapter['updateFrostProtection']>(),
    })
    const manager = new HomeFacadeManager(api)

    await manager.updateFrostProtection(['device-1', 'atw-1', 'unknown'], {
      isEnabled: true,
      max: 20,
      min: 2,
    })

    // Clamped (2 -> 4, 20 -> 16), enabled mapped, ids split by type,
    // unknown id dropped.
    expect(api.updateFrostProtection).toHaveBeenCalledWith({
      enabled: true,
      max: 16,
      min: 4,
      units: { ATA: ['device-1'], ATW: ['atw-1'] },
    })
  })

  it('batches holiday mode by device type', async () => {
    const api = mock<HomeAPIAdapter>({
      registry: mock<HomeRegistry>({
        getById: vi.fn<HomeRegistry['getById']>(() => createModel()),
      }),
      updateHolidayMode: vi.fn<HomeAPIAdapter['updateHolidayMode']>(),
    })
    const manager = new HomeFacadeManager(api)

    await manager.updateHolidayMode(['device-1'], {
      endDate: '2026-08-05T00:00:00',
      isEnabled: false,
      startDate: '2026-08-01T00:00:00',
    })

    expect(api.updateHolidayMode).toHaveBeenCalledWith({
      enabled: false,
      endDate: '2026-08-05T00:00:00',
      startDate: '2026-08-01T00:00:00',
      units: { ATA: ['device-1'] },
    })
  })
})
