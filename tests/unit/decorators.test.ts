import { describe, expect, it, vi } from 'vitest'

import type { ClassicAPIAdapter } from '../../src/api/index.ts'
import type {
  ClassicFailureData,
  ClassicGroupState,
  ClassicSetDeviceDataAta,
  ClassicSuccessData,
} from '../../src/types/index.ts'
import {
  CLASSIC_FLAG_UNCHANGED,
  ClassicDeviceType,
  ClassicOperationMode,
} from '../../src/constants.ts'
import {
  classicFetchDevices,
  classicSyncDevices,
  classicUpdateDevice,
  classicUpdateDevices,
} from '../../src/decorators/index.ts'
import { NoChangesError } from '../../src/errors/index.ts'
import { mock } from '../helpers.ts'

const createMockFacade = (
  devices: { type: ClassicDeviceType; update: ReturnType<typeof vi.fn> }[] = [],
  id = 1,
): {
  devices: { type: ClassicDeviceType; update: ReturnType<typeof vi.fn> }[]
  id: number
} => ({
  devices,
  id,
})

const decorateUpdateDevices = (
  name: string,
  target: (
    ...args: unknown[]
  ) => Promise<
    boolean | ClassicFailureData | ClassicGroupState | ClassicSuccessData
  >,
  options?: { type?: ClassicDeviceType },
): ReturnType<ReturnType<typeof classicUpdateDevices>> =>
  classicUpdateDevices(options)(
    target,
    mock<ClassMethodDecoratorContext>({ name }),
  )

const ataFlags = {
  OperationMode: 0x2,
  Power: 0x1,
  SetFanSpeed: 0x8,
  SetTemperature: 0x4,
  VaneHorizontal: 0x1_00,
  VaneVertical: 0x10,
}

const ervFlags = {
  Power: 0x1,
  SetFanSpeed: 0x8,
  VentilationMode: 0x4,
}

const createAtaSetData = (
  overrides: Partial<ClassicSetDeviceDataAta> = {},
): ClassicSetDeviceDataAta =>
  mock({
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
    ...overrides,
  })

const createErvSetData = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  DeviceType: ClassicDeviceType.Erv,
  EffectiveFlags: 0x1,
  LastCommunication: '',
  NextCommunication: '',
  NumberOfFanSpeeds: 5,
  Offline: false,
  Power: true,
  SetFanSpeed: 3,
  VentilationMode: 0,
  ...overrides,
})

const createAtaFacade = (
  update: ReturnType<typeof vi.fn>,
): {
  devices: { type: ClassicDeviceType; update: ReturnType<typeof vi.fn> }[]
  flags: typeof ataFlags
  type: ClassicDeviceType
} => ({
  devices: [{ type: ClassicDeviceType.Ata, update }],
  flags: ataFlags,
  type: ClassicDeviceType.Ata,
})

const createErvFacade = (
  update: ReturnType<typeof vi.fn>,
): {
  devices: { type: ClassicDeviceType; update: ReturnType<typeof vi.fn> }[]
  flags: typeof ervFlags
  type: ClassicDeviceType
} => ({
  devices: [{ type: ClassicDeviceType.Erv, update }],
  flags: ervFlags,
  type: ClassicDeviceType.Erv,
})

const callUpdateDevice = async (
  facade: unknown,
  setData: unknown,
): Promise<unknown> => {
  const target = vi.fn().mockResolvedValue(setData)
  const decorated = classicUpdateDevice(
    target,
    mock<ClassMethodDecoratorContext>(),
  )
  return decorated.call(facade)
}

const resolveTrue = async (): Promise<true> => {
  await Promise.resolve()
  return true
}

const resolvePowerData = async (): Promise<{ Alpha: null; Power: true }> => {
  const result = await Promise.resolve({ Alpha: null, Power: true } as const)
  return result
}

describe(classicFetchDevices, () => {
  it('calls api.fetch before the target method', async () => {
    const fetchMock = vi.fn()
    const target = vi.fn().mockResolvedValue('result')
    const decorated = classicFetchDevices(
      target,
      mock<ClassMethodDecoratorContext>(),
    )
    const context = { api: mock<ClassicAPIAdapter>({ fetch: fetchMock }) }
    await decorated.call(context)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(target).toHaveBeenCalledTimes(1)
  })
})

describe(classicSyncDevices, () => {
  it('calls onSync after the target method', async () => {
    const onSyncMock = vi.fn()
    const target = vi.fn().mockResolvedValue('result')
    const decorated = classicSyncDevices()(
      target,
      mock<ClassMethodDecoratorContext>(),
    )
    const context = { onSync: onSyncMock }
    const result = await decorated.call(context)

    expect(result).toBe('result')
    expect(onSyncMock).toHaveBeenCalledWith({ type: undefined })
  })

  it('passes type to onSync', async () => {
    const onSyncMock = vi.fn()
    const target = vi.fn().mockResolvedValue('result')
    const decorated = classicSyncDevices({ type: ClassicDeviceType.Ata })(
      target,
      mock<ClassMethodDecoratorContext>(),
    )
    const context = { onSync: onSyncMock }
    await decorated.call(context)

    expect(onSyncMock).toHaveBeenCalledWith({ type: ClassicDeviceType.Ata })
  })

  it('works when onSync is undefined', async () => {
    const target = vi.fn().mockResolvedValue('result')
    const decorated = classicSyncDevices()(
      target,
      mock<ClassMethodDecoratorContext>(),
    )
    const context = {}
    const result = await decorated.call(context)

    expect(result).toBe('result')
  })
})

describe(classicUpdateDevices, () => {
  it('updates all devices with the arg data', async () => {
    const update = vi.fn()
    const facade = createMockFacade([{ type: ClassicDeviceType.Ata, update }])
    const decorated = decorateUpdateDevices('updateGroupState', resolveTrue)
    await decorated.call(facade, { Power: true })

    expect(update).toHaveBeenCalledWith({ Power: true })
  })

  it('throws when arg is empty object', async () => {
    const facade = createMockFacade([], 42)
    const decorated = decorateUpdateDevices('updateGroupState', resolveTrue)

    await expect(decorated.call(facade, {})).rejects.toThrow(
      new NoChangesError(42),
    )
  })

  it('filters devices by type when specified', async () => {
    const updateAta = vi.fn()
    const updateAtw = vi.fn()
    const facade = createMockFacade([
      { type: ClassicDeviceType.Ata, update: updateAta },
      { type: ClassicDeviceType.Atw, update: updateAtw },
    ])
    const decorated = decorateUpdateDevices('updateGroupState', resolveTrue, {
      type: ClassicDeviceType.Ata,
    })
    await decorated.call(facade, { Power: true })

    expect(updateAta).toHaveBeenCalledWith({ Power: true })
    expect(updateAtw).not.toHaveBeenCalled()
  })

  it('uses updatePower logic when method name is updatePower', async () => {
    const update = vi.fn()
    const facade = createMockFacade([{ type: ClassicDeviceType.Ata, update }])
    const decorated = decorateUpdateDevices('updatePower', resolveTrue)
    await decorated.call(facade, true)

    expect(update).toHaveBeenCalledWith({ Power: true })
  })

  it('filters null/undefined values from data when not updatePower', async () => {
    const update = vi.fn()
    const facade = createMockFacade([{ type: ClassicDeviceType.Ata, update }])
    const decorated = decorateUpdateDevices(
      'updateGroupState',
      resolvePowerData,
    )
    await decorated.call(facade, null)

    expect(update).toHaveBeenCalledWith({ Power: true })
  })
})

describe(classicUpdateDevice, () => {
  it('updates the device model with converted data', async () => {
    const update = vi.fn()
    await callUpdateDevice(createAtaFacade(update), createAtaSetData())

    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.lastCall?.[0]).toHaveProperty('Power', true)
  })

  it('converts ATA set keys to list keys', async () => {
    const update = vi.fn()
    await callUpdateDevice(
      createAtaFacade(update),
      createAtaSetData({ EffectiveFlags: 0x8, SetFanSpeed: 4 }),
    )

    expect(update.mock.lastCall?.[0]).toHaveProperty('FanSpeed', 4)
  })

  it('passes through non-ATA data without key conversion', async () => {
    const update = vi.fn()
    await callUpdateDevice(createErvFacade(update), createErvSetData())

    expect(update.mock.lastCall?.[0]).toHaveProperty('Power', true)
  })

  it('skips update when devices array is empty', async () => {
    const facade = { devices: [], flags: ataFlags, type: ClassicDeviceType.Ata }
    const setData = createAtaSetData()
    const result = await callUpdateDevice(facade, setData)

    expect(result).toBe(setData)
  })

  it('handles CLASSIC_FLAG_UNCHANGED by including all data', async () => {
    const update = vi.fn()
    await callUpdateDevice(
      createErvFacade(update),
      createErvSetData({
        EffectiveFlags: CLASSIC_FLAG_UNCHANGED,
        Power: false,
        SetFanSpeed: 2,
        VentilationMode: 1,
      }),
    )

    expect(update).toHaveBeenCalledTimes(1)
  })
})
