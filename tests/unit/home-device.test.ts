import { describe, expect, it } from 'vitest'

import { HomeDeviceType } from '../../src/constants.ts'
import { HomeDevice } from '../../src/entities/home-device.ts'
import {
  homeAtwDevice,
  homeAtwDeviceData,
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

  it('defaults an unannotated device to not-owner', () => {
    const device = new HomeDevice(
      homeAtwDeviceData({ id: 'atw-1' }),
      HomeDeviceType.Atw,
    )

    expect(device.isOwner).toBe(false)
  })

  it('keeps isOwner across a payload-only sync and updates it when passed', () => {
    const owned = homeAtwDevice({ id: 'atw-1' }, true)

    expect(owned.isOwner).toBe(true)

    owned.sync(homeAtwDeviceData({ id: 'atw-1' }))

    expect(owned.isOwner).toBe(true)

    owned.sync(homeAtwDeviceData({ id: 'atw-1' }), false)

    expect(owned.isOwner).toBe(false)
  })
})
