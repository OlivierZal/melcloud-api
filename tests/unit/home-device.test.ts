import { describe, expect, it } from 'vitest'

import {
  homeAtwDevice,
  homeAtwDeviceData,
  homeBuildingRef,
  homeDevice,
} from '../home-fixtures.ts'

describe('home device entity', () => {
  it('discriminates ATA via isAta()/isAtw()', () => {
    const ata = homeDevice({ id: 'ata-1' })

    expect(ata.isAta()).toBe(true)
    expect(ata.isAtw()).toBe(false)
  })

  it('discriminates ATW via isAta()/isAtw()', () => {
    const atw = homeAtwDevice({ id: 'atw-1' })

    expect(atw.isAta()).toBe(false)
    expect(atw.isAtw()).toBe(true)
  })

  it('restates isOwner on every sync', () => {
    const owned = homeAtwDevice({ id: 'atw-1' }, true)

    expect(owned.isOwner).toBe(true)

    owned.sync(homeAtwDeviceData({ id: 'atw-1' }), true, homeBuildingRef())

    expect(owned.isOwner).toBe(true)

    owned.sync(homeAtwDeviceData({ id: 'atw-1' }), false, homeBuildingRef())

    expect(owned.isOwner).toBe(false)
  })

  it('tracks the start of a disconnection streak across syncs', () => {
    const device = homeDevice({ id: 'ata-1', isConnected: false })
    const start = device.disconnectedSince

    expect(start).not.toBeNull()

    device.sync({ ...device.data, isConnected: false }, true, homeBuildingRef())

    expect(device.disconnectedSince).toBe(start)

    device.sync({ ...device.data, isConnected: true }, true, homeBuildingRef())

    expect(device.disconnectedSince).toBeNull()
  })

  it('starts with no disconnection streak while connected', () => {
    const device = homeDevice({ id: 'ata-2' })

    expect(device.disconnectedSince).toBeNull()
  })
})
