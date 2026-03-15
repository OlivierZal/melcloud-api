import { describe, expect, it } from 'vitest'

import { DeviceType } from '../../src/constants.ts'
import { DeviceModel } from '../../src/models/index.ts'
import { ataDevice } from '../fixtures.ts'

describe('deviceModel', () => {
  it('creates a device with correct properties', () => {
    const device = new DeviceModel(ataDevice())

    expect(device.id).toBe(1000)
    expect(device.name).toBe('ATA Device')
    expect(device.type).toBe(DeviceType.Ata)
    expect(device.buildingId).toBe(1)
    expect(device.floorId).toBe(10)
    expect(device.areaId).toBe(100)
  })

  it('handles null floor and area ids', () => {
    const device = new DeviceModel(ataDevice({ AreaID: null, FloorID: null }))

    expect(device.floorId).toBeNull()
    expect(device.areaId).toBeNull()
  })

  it('returns device data', () => {
    const device = new DeviceModel(ataDevice())
    const { data } = device

    expect(data.Power).toBe(true)
    expect(data.SetTemperature).toBe(24)
  })

  it('updates device data partially', () => {
    const device = new DeviceModel(ataDevice())
    device.update({ Power: false })
    const { data } = device

    expect(data.Power).toBe(false)
    expect(data.SetTemperature).toBe(24)
  })

  it('updates device data with multiple fields', () => {
    const device = new DeviceModel(ataDevice())
    device.update({ Power: false, SetTemperature: 20 })
    const { data } = device

    expect(data.Power).toBe(false)
    expect(data.SetTemperature).toBe(20)
  })
})
