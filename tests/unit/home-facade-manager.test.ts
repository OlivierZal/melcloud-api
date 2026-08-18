import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { HomeDevice } from '../../src/entities/home-device.ts'
import type { HomeRegistry } from '../../src/entities/home-registry.ts'
import { HomeDeviceType } from '../../src/constants.ts'
import { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import { HomeDeviceAtwFacade } from '../../src/facades/home-device-atw.ts'
import { HomeFacadeManager } from '../../src/facades/home-manager.ts'
import {
  type HomeDeviceFacadeAny,
  isHomeAtaFacade,
  isHomeAtwFacade,
} from '../../src/facades/home-types.ts'
import { cast, defined, mock } from '../helpers.ts'
import {
  createMockHomeApi,
  homeAtwDevice,
  homeDevice,
  resetHomeDevices,
} from '../home-fixtures.ts'

const createModel = (): ReturnType<typeof homeDevice> =>
  homeDevice({ id: 'device-1', name: 'Test ClassicDevice' })

describe('home facade manager', () => {
  beforeEach(resetHomeDevices)

  it('returns null when no instance is provided', () => {
    const manager = new HomeFacadeManager(createMockHomeApi())

    expect(manager.get()).toBeNull()
  })

  it('returns an ATA facade for an ATA device model', () => {
    const manager = new HomeFacadeManager(createMockHomeApi())
    const facade = manager.get(createModel())

    expect(facade).toBeInstanceOf(HomeDeviceAtaFacade)
  })

  it('returns an ATW facade for an ATW device model', () => {
    const manager = new HomeFacadeManager(createMockHomeApi())
    const facade = manager.get(homeAtwDevice({ id: 'atw-1' }))

    expect(facade).toBeInstanceOf(HomeDeviceAtwFacade)
  })

  it('caches facades for the same instance', () => {
    const manager = new HomeFacadeManager(createMockHomeApi())
    const model = createModel()

    expect(manager.get(model)).toBe(manager.get(model))
  })

  it('returns different facades for different instances', () => {
    const manager = new HomeFacadeManager(createMockHomeApi())
    const model1 = createModel()
    const model2 = homeDevice({
      id: 'device-2',
      name: 'Other ClassicDevice',
      rssi: -60,
    })

    expect(manager.get(model1)).not.toBe(manager.get(model2))
  })

  it('resolves a device facade by id and null for an unknown id', () => {
    const manager = new HomeFacadeManager(createMockHomeApi())
    const ata = homeDevice({ id: 'by-id-ata' })
    const atw = homeAtwDevice({ id: 'by-id-atw' })

    expect(manager.getById('by-id-ata')).toBe(manager.get(ata))
    expect(manager.getById('by-id-atw')).toBe(manager.get(atw))
    expect(manager.getById('missing')).toBeNull()
  })

  it('exposes the connection type and narrows via the facade guards', () => {
    const manager = new HomeFacadeManager(createMockHomeApi())
    const facades: HomeDeviceFacadeAny[] = [
      manager.get(homeDevice({ id: 'guard-ata' })),
      manager.get(homeAtwDevice({ id: 'guard-atw' })),
    ]
    const ata = defined(facades[0])
    const atw = defined(facades[1])

    expect(ata.type).toBe(HomeDeviceType.Ata)
    expect(isHomeAtaFacade(ata)).toBe(true)
    expect(isHomeAtwFacade(ata)).toBe(false)
    expect(isHomeAtwFacade(atw)).toBe(true)
  })

  it('returns null for a model of an unknown connection type', () => {
    const manager = new HomeFacadeManager(createMockHomeApi())
    const rogue = homeDevice({ id: 'rogue' })
    Object.defineProperty(rogue, 'type', { value: 'unknown' })

    expect(manager.getById('rogue')).toBeNull()
  })

  it('delegates getBuildings and getZones to the registry', () => {
    const registry = {
      getBuildings: vi.fn<HomeRegistry['getBuildings']>().mockReturnValue([]),
      getZones: vi.fn<HomeRegistry['getZones']>().mockReturnValue([]),
    }
    const manager = new HomeFacadeManager(
      createMockHomeApi({ registry: cast(registry) }),
    )

    expect(manager.getBuildings({ type: HomeDeviceType.Ata })).toStrictEqual([])
    expect(manager.getZones()).toStrictEqual([])
    expect(registry.getBuildings).toHaveBeenCalledWith({
      type: HomeDeviceType.Ata,
    })
    expect(registry.getZones).toHaveBeenCalledWith(undefined)
  })

  it('batches frost protection by device type, clamped and enabled-mapped', async () => {
    const devicesById = new Map<string, HomeDevice>([
      ['atw-1', homeAtwDevice({ id: 'atw-1' })],
      ['device-1', createModel()],
    ])
    const api = createMockHomeApi({
      registry: mock<HomeRegistry>({
        getById: vi.fn<HomeRegistry['getById']>((id) => devicesById.get(id)),
      }),
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

  it('batches overheat protection to the ATA ids only, clamped', async () => {
    const devicesById = new Map<string, HomeDevice>([
      ['atw-1', homeAtwDevice({ id: 'atw-1' })],
      ['device-1', createModel()],
    ])
    const api = createMockHomeApi({
      registry: mock<HomeRegistry>({
        getById: vi.fn<HomeRegistry['getById']>((id) => devicesById.get(id)),
      }),
    })
    const manager = new HomeFacadeManager(api)

    await manager.updateOverheatProtection(['device-1', 'atw-1', 'unknown'], {
      isEnabled: true,
      max: 45,
      min: 20,
    })

    // Clamped (20 -> 31, 45 -> 40); the ATW and unknown ids are dropped —
    // the feature is ATA-only.
    expect(api.updateOverheatProtection).toHaveBeenCalledWith({
      enabled: true,
      max: 40,
      min: 31,
      units: { ATA: ['device-1'] },
    })
  })

  it('skips the overheat write when no ATA id remains', async () => {
    const api = createMockHomeApi({
      registry: mock<HomeRegistry>({
        getById: vi.fn<HomeRegistry['getById']>(() =>
          homeAtwDevice({ id: 'atw-1' }),
        ),
      }),
    })
    const manager = new HomeFacadeManager(api)

    await manager.updateOverheatProtection(['atw-1'], {
      isEnabled: true,
      max: 37,
      min: 35,
    })

    expect(api.updateOverheatProtection).not.toHaveBeenCalled()
  })

  it('batches holiday mode by device type', async () => {
    const api = createMockHomeApi({
      registry: mock<HomeRegistry>({
        getById: vi.fn<HomeRegistry['getById']>(() => createModel()),
      }),
    })
    const manager = new HomeFacadeManager(api)

    await manager.updateHolidayMode(['device-1'], {
      endDate: '2026-08-05T00:00:00',
      isEnabled: false,
      startDate: '2026-08-01T00:00:00',
    })

    // A disabled window's dates are ignored by the wire and pass
    // through unprojected — no conversion may fail a disable.
    expect(api.updateHolidayMode).toHaveBeenCalledWith({
      enabled: false,
      endDate: '2026-08-05T00:00:00',
      startDate: '2026-08-01T00:00:00',
      units: { ATA: ['device-1'] },
    })
  })
})

describe('holiday-mode write projection', () => {
  it("projects an enabled window from the caller's clock onto UTC", async () => {
    const api = createMockHomeApi({ timezone: 'Europe/Paris' })
    const manager = new HomeFacadeManager(api)

    // Paris summer wall clock (UTC+2): midnight locally is 22:00 UTC
    // the previous day.
    await manager.updateHolidayMode(['device-1'], {
      endDate: '2026-08-05T00:00',
      isEnabled: true,
      startDate: '2026-08-01T00:00',
    })

    expect(api.updateHolidayMode).toHaveBeenCalledWith({
      enabled: true,
      endDate: '2026-08-04T22:00:00',
      startDate: '2026-07-31T22:00:00',
      units: { ATA: ['device-1'] },
    })
  })
})
