import { describe, expect, it, vi } from 'vitest'

import type { IAPIAdapter } from '../services/index.ts'
import type { ListDeviceDataAta, SetDeviceDataAta } from '../types/index.ts'

import { FLAG_UNCHANGED } from '../constants.ts'
import { fetchDevices, syncDevices, updateDevice, updateDevices } from '../decorators/index.ts'
import { DeviceType, OperationMode } from '../enums.ts'

describe('fetchDevices', () => {
  it('calls api.fetch before the target method', async () => {
    const fetchMock = vi.fn()
    const target = vi.fn().mockResolvedValue('result')
    const decorated = fetchDevices(target, {} as ClassMethodDecoratorContext)
    const context = { api: { fetch: fetchMock } as unknown as IAPIAdapter }
    await decorated.call(context)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(target).toHaveBeenCalledTimes(1)
  })
})

describe('syncDevices', () => {
  it('calls onSync after the target method', async () => {
    const onSyncMock = vi.fn()
    const target = vi.fn().mockResolvedValue('result')
    const decorated = syncDevices()(target, {} as ClassMethodDecoratorContext)
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
      {} as ClassMethodDecoratorContext,
    )
    const context = { onSync: onSyncMock }
    await decorated.call(context)

    expect(onSyncMock).toHaveBeenCalledWith({ type: DeviceType.Ata })
  })

  it('works when onSync is undefined', async () => {
    const target = vi.fn().mockResolvedValue('result')
    const decorated = syncDevices()(target, {} as ClassMethodDecoratorContext)
    const context = {}
    const result = await decorated.call(context)

    expect(result).toBe('result')
  })
})

describe('updateDevices', () => {
  const createMockFacade = (
    devices: { type: DeviceType; update: ReturnType<typeof vi.fn> }[] = [],
  ) => ({
    devices,
  })

  it('updates all devices with the arg data', async () => {
    const update = vi.fn()
    const facade = createMockFacade([
      { type: DeviceType.Ata, update },
    ])
    const target = vi.fn().mockResolvedValue(true)
    const decorated = updateDevices()(target, {
      name: 'setPower',
    } as unknown as ClassMethodDecoratorContext)
    await decorated.call(facade, { Power: true })

    expect(update).toHaveBeenCalledWith({ Power: true })
  })

  it('throws when arg is empty object', async () => {
    const facade = createMockFacade([])
    const target = vi.fn().mockResolvedValue(true)
    const decorated = updateDevices()(target, {
      name: 'setGroup',
    } as unknown as ClassMethodDecoratorContext)

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
    const decorated = updateDevices({ type: DeviceType.Ata })(target, {
      name: 'setGroup',
    } as unknown as ClassMethodDecoratorContext)
    await decorated.call(facade, { Power: true })

    expect(updateAta).toHaveBeenCalled()
    expect(updateAtw).not.toHaveBeenCalled()
  })

  it('uses SetPower logic when method name is SetPower', async () => {
    const update = vi.fn()
    const facade = createMockFacade([
      { type: DeviceType.Ata, update },
    ])
    const target = vi.fn().mockResolvedValue(true)
    const decorated = updateDevices()(target, {
      name: 'SetPower',
    } as unknown as ClassMethodDecoratorContext)
    await decorated.call(facade, true)

    expect(update).toHaveBeenCalledWith({ Power: true })
  })

  it('filters null/undefined values from data when no SetPower', async () => {
    const update = vi.fn()
    const facade = createMockFacade([
      { type: DeviceType.Ata, update },
    ])
    const target = vi.fn().mockResolvedValue({ Alpha: null, Power: true })
    const decorated = updateDevices()(target, {
      name: 'setGroup',
    } as unknown as ClassMethodDecoratorContext)
    await decorated.call(facade, null)

    expect(update).toHaveBeenCalledWith({ Power: true })
  })
})

describe('updateDevice', () => {
  it('updates the device model with converted data', async () => {
    const update = vi.fn()
    const device = { update }
    const facade = {
      devices: [device],
      flags: {
        OperationMode: 0x2,
        Power: 0x1,
        SetFanSpeed: 0x8,
        SetTemperature: 0x4,
        VaneHorizontal: 0x1_00,
        VaneVertical: 0x10,
      },
      type: DeviceType.Ata,
    }
    const setData: SetDeviceDataAta = {
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
    } as SetDeviceDataAta
    const target = vi.fn().mockResolvedValue(setData)
    const decorated = updateDevice(target, {} as ClassMethodDecoratorContext)
    await decorated.call(facade)

    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0]![0]).toHaveProperty('Power', true)
  })

  it('converts ATA set keys to list keys', async () => {
    const update = vi.fn()
    const device = { update }
    const facade = {
      devices: [device],
      flags: {
        OperationMode: 0x2,
        Power: 0x1,
        SetFanSpeed: 0x8,
        SetTemperature: 0x4,
        VaneHorizontal: 0x1_00,
        VaneVertical: 0x10,
      },
      type: DeviceType.Ata,
    }
    const setData: SetDeviceDataAta = {
      DeviceType: DeviceType.Ata,
      EffectiveFlags: 0x8,
      LastCommunication: '',
      NextCommunication: '',
      NumberOfFanSpeeds: 5,
      Offline: false,
      OperationMode: OperationMode.heat,
      Power: true,
      RoomTemperature: 22,
      SetFanSpeed: 4,
      SetTemperature: 24,
      VaneHorizontal: 0,
      VaneVertical: 0,
    } as SetDeviceDataAta
    const target = vi.fn().mockResolvedValue(setData)
    const decorated = updateDevice(target, {} as ClassMethodDecoratorContext)
    await decorated.call(facade)

    expect(update.mock.calls[0]![0]).toHaveProperty('FanSpeed', 4)
  })

  it('passes through non-ATA data without key conversion', async () => {
    const update = vi.fn()
    const device = { update }
    const facade = {
      devices: [device],
      flags: {
        Power: 0x1,
        SetFanSpeed: 0x8,
        VentilationMode: 0x4,
      },
      type: DeviceType.Erv,
    }
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
    const decorated = updateDevice(target, {} as ClassMethodDecoratorContext)
    await decorated.call(facade)

    expect(update.mock.calls[0]![0]).toHaveProperty('Power', true)
  })

  it('handles FLAG_UNCHANGED by including all data', async () => {
    const update = vi.fn()
    const device = { update }
    const facade = {
      devices: [device],
      flags: {
        Power: 0x1,
        SetFanSpeed: 0x8,
        VentilationMode: 0x4,
      },
      type: DeviceType.Erv,
    }
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
    const decorated = updateDevice(target, {} as ClassMethodDecoratorContext)
    await decorated.call(facade)

    expect(update).toHaveBeenCalledTimes(1)
  })
})
