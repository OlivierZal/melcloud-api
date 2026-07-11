import { describe, expect, it } from 'vitest'

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

  it('restates isOwner on every sync', () => {
    const owned = homeAtwDevice({ id: 'atw-1' }, true)

    expect(owned.isOwner).toBe(true)

    owned.sync(homeAtwDeviceData({ id: 'atw-1' }), true)

    expect(owned.isOwner).toBe(true)

    owned.sync(homeAtwDeviceData({ id: 'atw-1' }), false)

    expect(owned.isOwner).toBe(false)
  })
})
