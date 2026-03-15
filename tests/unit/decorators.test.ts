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
  const createMockFacade = (
    devices: { type: DeviceType; update: ReturnType<typeof vi.fn> }[] = [],
  ) => ({
    devices,
  })

  it('updates all devices with the arg data', async () => {
    const update = vi.fn()
    const facade = createMockFacade([{ type: DeviceType.Ata, update }])
    const target = vi.fn().mockResolvedValue(true)
    const decorated = updateDevices()(
      target,
      mock<ClassMethodDecoratorContext>({
        name: 'setPower',
      }),
    )
    await decorated.call(facade, { Power: true })

    expect(update).toHaveBeenCalledWith({ Power: true })
  })

  it('throws when arg is empty object', async () => {
    const facade = createMockFacade([])
    const target = vi.fn().mockResolvedValue(true)
    const decorated = updateDevices()(
      target,
      mock<ClassMethodDecoratorContext>({
        name: 'setGroup',
      }),
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
    const target = vi.fn().mockResolvedValue(true)
    const decorated = updateDevices({ type: DeviceType.Ata })(
      target,
      mock<ClassMethodDecoratorContext>({
        name: 'setGroup',
      }),
    )
    await decorated.call(facade, { Power: true })

    expect(updateAta).toHaveBeenCalled()
    expect(updateAtw).not.toHaveBeenCalled()
  })

  it('uses SetPower logic when method name is SetPower', async () => {
    const update = vi.fn()
    const facade = createMockFacade([{ type: DeviceType.Ata, update }])
    const target = vi.fn().mockResolvedValue(true)
    const decorated = updateDevices()(
      target,
      mock<ClassMethodDecoratorContext>({
        name: 'SetPower',
      }),
    )
    await decorated.call(facade, true)

    expect(update).toHaveBeenCalledWith({ Power: true })
  })

  it('filters null/undefined values from data when no SetPower', async () => {
    const update = vi.fn()
    const facade = createMockFacade([{ type: DeviceType.Ata, update }])
    const target = vi.fn().mockResolvedValue({ Alpha: null, Power: true })
    const decorated = updateDevices()(
      target,
      mock<ClassMethodDecoratorContext>({
        name: 'setGroup',
      }),
    )
    await decorated.call(facade, null)

    expect(update).toHaveBeenCalledWith({ Power: true })
  })
})

describe(updateDevice, () => {
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

  const createAtaFacade = (update: ReturnType<typeof vi.fn>) => ({
    devices: [{ type: DeviceType.Ata, update }],
    flags: ataFlags,
    type: DeviceType.Ata,
  })

  const createErvFacade = (update: ReturnType<typeof vi.fn>) => ({
    devices: [{ type: DeviceType.Erv, update }],
    flags: ervFlags,
    type: DeviceType.Erv,
  })

  it('updates the device model with converted data', async () => {
    const update = vi.fn()
    const setData = createAtaSetData()
    const target = vi.fn().mockResolvedValue(setData)
    const decorated = updateDevice(target, mock<ClassMethodDecoratorContext>())
    await decorated.call(createAtaFacade(update))

    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0]![0]).toHaveProperty('Power', true)
  })

  it('converts ATA set keys to list keys', async () => {
    const update = vi.fn()
    const setData = createAtaSetData({ EffectiveFlags: 0x8, SetFanSpeed: 4 })
    const target = vi.fn().mockResolvedValue(setData)
    const decorated = updateDevice(target, mock<ClassMethodDecoratorContext>())
    await decorated.call(createAtaFacade(update))

    expect(update.mock.calls[0]![0]).toHaveProperty('FanSpeed', 4)
  })

  it('passes through non-ATA data without key conversion', async () => {
    const update = vi.fn()
    const setData = {
      DeviceType: DeviceType.Erv,
      EffectiveFlags: 0x1,
      LastCommunication: '',
      NextCommunication: '',
      NumberOfFanSpeeds: 5,
      Offline: false,
      Power: true,
      SetFanSpeed: 3,
      VentilationMode: 0,
    }
    const target = vi.fn().mockResolvedValue(setData)
    const decorated = updateDevice(target, mock<ClassMethodDecoratorContext>())
    await decorated.call(createErvFacade(update))

    expect(update.mock.calls[0]![0]).toHaveProperty('Power', true)
  })

  it('skips update when devices array is empty', async () => {
    const facade = {
      devices: [],
      flags: ataFlags,
      type: DeviceType.Ata,
    }
    const setData = createAtaSetData()
    const target = vi.fn().mockResolvedValue(setData)
    const decorated = updateDevice(target, mock<ClassMethodDecoratorContext>())
    const result = await decorated.call(facade)

    expect(result).toBe(setData)
  })

  it('handles FLAG_UNCHANGED by including all data', async () => {
    const update = vi.fn()
    const setData = {
      DeviceType: DeviceType.Erv,
      EffectiveFlags: FLAG_UNCHANGED,
      LastCommunication: '',
      NextCommunication: '',
      NumberOfFanSpeeds: 5,
      Offline: false,
      Power: false,
      SetFanSpeed: 2,
      VentilationMode: 1,
    }
    const target = vi.fn().mockResolvedValue(setData)
    const decorated = updateDevice(target, mock<ClassMethodDecoratorContext>())
    await decorated.call(createErvFacade(update))

    expect(update).toHaveBeenCalledTimes(1)
  })
})
