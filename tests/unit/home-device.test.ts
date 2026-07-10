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

  it('defaults isInvitee to false for owned devices', () => {
    expect(homeDevice({ id: 'ata-1' }).isInvitee).toBe(false)
  })

  it('reports and re-applies isInvitee across syncs', () => {
    const atw = homeAtwDevice({ id: 'atw-1' }, true)

    expect(atw.isInvitee).toBe(true)

    atw.sync(homeAtwDeviceData({ id: 'atw-1' }), false)

    expect(atw.isInvitee).toBe(false)
  })
})
