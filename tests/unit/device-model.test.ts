import { describe, expect, it } from 'vitest'

import type { ListDevice, ListDeviceDataAta } from '../../src/types/index.ts'

import { DeviceType } from '../../src/constants.ts'
import { DeviceModel } from '../../src/models/index.ts'
import { mock } from '../helpers.ts'

const createAtaDevice = (
  overrides: Partial<ListDevice<typeof DeviceType.Ata>> = {},
): ListDevice<typeof DeviceType.Ata> => ({
  AreaID: 100,
  BuildingID: 1,
  Device: mock<ListDeviceDataAta>({
    ActualFanSpeed: 3,
    EffectiveFlags: 0,
    FanSpeed: 3,
    HasAutomaticFanSpeed: true,
    MaxTempAutomatic: 31,
    MaxTempCoolDry: 31,
    MaxTempHeat: 31,
    MinTempAutomatic: 16,
    MinTempCoolDry: 16,
    MinTempHeat: 10,
    Offline: false,
    OperationMode: 1,
    OutdoorTemperature: 20,
    Power: true,
    RoomTemperature: 22,
    SetTemperature: 24,
    VaneHorizontalDirection: 0,
    VaneVerticalDirection: 0,
    WifiSignalStrength: -50,
  }),
  DeviceID: 1000,
  DeviceName: 'Test ATA',
  FloorID: 10,
  Type: DeviceType.Ata,
  ...overrides,
})

describe('deviceModel', () => {
  it('creates a device with correct properties', () => {
    const device = new DeviceModel(createAtaDevice())

    expect(device.id).toBe(1000)
    expect(device.name).toBe('Test ATA')
    expect(device.type).toBe(DeviceType.Ata)
    expect(device.buildingId).toBe(1)
    expect(device.floorId).toBe(10)
    expect(device.areaId).toBe(100)
  })

  it('handles null floor and area ids', () => {
    const device = new DeviceModel(
      createAtaDevice({ AreaID: null, FloorID: null }),
    )

    expect(device.floorId).toBeNull()
    expect(device.areaId).toBeNull()
  })

  it('returns device data', () => {
    const device = new DeviceModel(createAtaDevice())
    const data = device.data as ListDeviceDataAta

    expect(data.Power).toBe(true)
    expect(data.SetTemperature).toBe(24)
  })

  it('updates device data partially', () => {
    const device = new DeviceModel(createAtaDevice())
    device.update({ Power: false })
    const data = device.data as ListDeviceDataAta

    expect(data.Power).toBe(false)
    expect(data.SetTemperature).toBe(24)
  })

  it('updates device data with multiple fields', () => {
    const device = new DeviceModel(createAtaDevice())
    device.update({ Power: false, SetTemperature: 20 })
    const data = device.data as ListDeviceDataAta

    expect(data.Power).toBe(false)
    expect(data.SetTemperature).toBe(20)
  })
})
