import { describe, expect, it } from 'vitest'

import type { ClassicListDeviceDataAta } from '../../src/types/index.ts'
import { ClassicDeviceType } from '../../src/constants.ts'
import { ClassicDevice } from '../../src/entities/index.ts'
import { ataDevice } from '../fixtures.ts'

const isAtaData = (data: unknown): data is ClassicListDeviceDataAta =>
  data !== null && typeof data === 'object' && 'SetTemperature' in data

const expectAtaData = (data: unknown): ClassicListDeviceDataAta => {
  expect(isAtaData(data)).toBe(true)

  if (!isAtaData(data)) {
    throw new Error('Expected ATA device data')
  }
  return data
}

describe('device model', () => {
  it('creates a device with correct properties', () => {
    const device = new ClassicDevice(ataDevice())

    expect(device.id).toBe(1000)
    expect(device.name).toBe('ATA ClassicDevice')
    expect(device.type).toBe(ClassicDeviceType.Ata)
    expect(device.buildingId).toBe(1)
    expect(device.floorId).toBe(10)
    expect(device.areaId).toBe(100)
  })

  it('handles null floor and area ids', () => {
    const device = new ClassicDevice(ataDevice({ AreaID: null, FloorID: null }))

    expect(device.floorId).toBeNull()
    expect(device.areaId).toBeNull()
  })

  it('returns device data', () => {
    const device = new ClassicDevice(ataDevice())
    const data = expectAtaData(device.data)

    expect(data.Power).toBe(true)
    expect(data.SetTemperature).toBe(24)
  })

  it('updates device data partially', () => {
    const device = new ClassicDevice(ataDevice())
    device.update({ Power: false })
    const data = expectAtaData(device.data)

    expect(data.Power).toBe(false)
    expect(data.SetTemperature).toBe(24)
  })

  it('updates device data with multiple fields', () => {
    const device = new ClassicDevice(ataDevice())
    device.update({ Power: false, SetTemperature: 20 })
    const data = expectAtaData(device.data)

    expect(data.Power).toBe(false)
    expect(data.SetTemperature).toBe(20)
  })
})
