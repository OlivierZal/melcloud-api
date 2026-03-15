import { describe, expect, it, vi } from 'vitest'

import type { APIAdapter } from '../../src/services/index.ts'
import type { SetDeviceDataAta } from '../../src/types/index.ts'

import {
  DeviceType,
  FLAG_UNCHANGED,
  OperationMode,
} from '../../src/constants.ts'
import {
  fetchDevices,
  syncDevices,
  updateDevice,
  updateDevices,
} from '../../src/decorators/index.ts'
import { mock } from '../helpers.ts'

const createMockFacade = (
  devices: { type: DeviceType; update: ReturnType<typeof vi.fn> }[] = [],
): { devices: { type: DeviceType; update: ReturnType<typeof vi.fn> }[] } => ({
  devices,
})

const decorateUpdateDevices = (
  name: string,
  target: ReturnType<typeof vi.fn>,
  options?: { type?: DeviceType },
): ReturnType<ReturnType<typeof updateDevices>> =>
  updateDevices(options)(target, mock<ClassMethodDecoratorContext>({ name }))

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
  overrides: Partial<SetDeviceDataAta> = {},
): SetDeviceDataAta =>
  mock<SetDeviceDataAta>({
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
    ...overrides,
  })

const createErvSetData = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  DeviceType: DeviceType.Erv,
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
  devices: { type: DeviceType; update: ReturnType<typeof vi.fn> }[]
  flags: typeof ataFlags
  type: DeviceType
} => ({
  devices: [{ type: DeviceType.Ata, update }],
  flags: ataFlags,
  type: DeviceType.Ata,
})

const createErvFacade = (
  update: ReturnType<typeof vi.fn>,
): {
  devices: { type: DeviceType; update: ReturnType<typeof vi.fn> }[]
  flags: typeof ervFlags
  type: DeviceType
} => ({
  devices: [{ type: DeviceType.Erv, update }],
  flags: ervFlags,
  type: DeviceType.Erv,
})

const callUpdateDevice = async (
  facade: unknown,
  setData: unknown,
): Promise<unknown> => {
  const target = vi.fn().mockResolvedValue(setData)
  const decorated = updateDevice(target, mock<ClassMethodDecoratorContext>())
  return decorated.call(facade)
}

describe(fetchDevices, () => {
  it('calls api.fetch before the target method', async () => {
    const fetchMock = vi.fn()
    const target = vi.fn().mockResolvedValue('result')
    const decorated = fetchDevices(target, mock<ClassMethodDecoratorContext>())
    const context = { api: mock<APIAdapter>({ fetch: fetchMock }) }
    await decorated.call(context)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(target).toHaveBeenCalledTimes(1)
  })
})

describe(syncDevices, () => {
  it('calls onSync after the target method', async () => {
    const onSyncMock = vi.fn()
    const target = vi.fn().mockResolvedValue('result')
    const decorated = syncDevices()(target, mock<ClassMethodDecoratorContext>())
    const context = { onSync: onSyncMock }
    const result = await decorated.call(context)

    expect(result).toBe('result')
    expect(onSyncMock).toHaveBeenCalledWith({ type: undefined })
  })

  it('passes type to onSync', async () => {
    const onSyncMock = vi.fn()
    const target = vi.fn().mockResolvedValue('result')
    const decorated = syncDevices({ type: DeviceType.Ata })(
      target,
      mock<ClassMethodDecoratorContext>(),
    )
    const context = { onSync: onSyncMock }
    await decorated.call(context)

    expect(onSyncMock).toHaveBeenCalledWith({ type: DeviceType.Ata })
  })

  it('works when onSync is undefined', async () => {
    const target = vi.fn().mockResolvedValue('result')
    const decorated = syncDevices()(target, mock<ClassMethodDecoratorContext>())
    const context = {}
    const result = await decorated.call(context)

    expect(result).toBe('result')
  })
})

describe(updateDevices, () => {
  it('updates all devices with the arg data', async () => {
    const update = vi.fn()
    const facade = createMockFacade([{ type: DeviceType.Ata, update }])
    const decorated = decorateUpdateDevices(
      'setPower',
      vi.fn().mockResolvedValue(true),
    )
    await decorated.call(facade, { Power: true })

    expect(update).toHaveBeenCalledWith({ Power: true })
  })

  it('throws when arg is empty object', async () => {
    const facade = createMockFacade([])
    const decorated = decorateUpdateDevices(
      'setGroup',
      vi.fn().mockResolvedValue(true),
    )

    await expect(decorated.call(facade, {})).rejects.toThrow('No data to set')
  })

  it('filters devices by type when specified', async () => {
    const updateAta = vi.fn()
    const updateAtw = vi.fn()
    const facade = createMockFacade([
      { type: DeviceType.Ata, update: updateAta },
      { type: DeviceType.Atw, update: updateAtw },
    ])
    const decorated = decorateUpdateDevices(
      'setGroup',
      vi.fn().mockResolvedValue(true),
      { type: DeviceType.Ata },
    )
    await decorated.call(facade, { Power: true })

    expect(updateAta).toHaveBeenCalled()
    expect(updateAtw).not.toHaveBeenCalled()
  })

  it('uses SetPower logic when method name is SetPower', async () => {
    const update = vi.fn()
    const facade = createMockFacade([{ type: DeviceType.Ata, update }])
    const decorated = decorateUpdateDevices(
      'SetPower',
      vi.fn().mockResolvedValue(true),
    )
    await decorated.call(facade, true)

    expect(update).toHaveBeenCalledWith({ Power: true })
  })

  it('filters null/undefined values from data when no SetPower', async () => {
    const update = vi.fn()
    const facade = createMockFacade([{ type: DeviceType.Ata, update }])
    const decorated = decorateUpdateDevices(
      'setGroup',
      vi.fn().mockResolvedValue({ Alpha: null, Power: true }),
    )
    await decorated.call(facade, null)

    expect(update).toHaveBeenCalledWith({ Power: true })
  })
})

describe(updateDevice, () => {
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
    const facade = { devices: [], flags: ataFlags, type: DeviceType.Ata }
    const setData = createAtaSetData()
    const result = await callUpdateDevice(facade, setData)

    expect(result).toBe(setData)
  })

  it('handles FLAG_UNCHANGED by including all data', async () => {
    const update = vi.fn()
    await callUpdateDevice(
      createErvFacade(update),
      createErvSetData({
        EffectiveFlags: FLAG_UNCHANGED,
        Power: false,
        SetFanSpeed: 2,
        VentilationMode: 1,
      }),
    )

    expect(update).toHaveBeenCalledTimes(1)
  })
})
