import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isSessionExpired } from '../../src/services/session-expiry.ts'

describe(isSessionExpired, () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-11T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns false for an empty string (no expiry recorded yet)', () => {
    expect(isSessionExpired('')).toBe(false)
  })

  it('returns false for a valid ISO date in the future', () => {
    expect(isSessionExpired('2026-04-11T13:00:00Z')).toBe(false)
  })

  it('returns true for a valid ISO date in the past', () => {
    expect(isSessionExpired('2026-04-11T11:00:00Z')).toBe(true)
  })

  it('returns true for an unparseable value (corruption self-heals)', () => {
    expect(isSessionExpired('not-a-valid-iso-date')).toBe(true)
  })

  it('returns true for the literal string "Invalid Date"', () => {
    expect(isSessionExpired('Invalid Date')).toBe(true)
  })

  it('returns false when exactly equal to now (strict past comparison)', () => {
    expect(isSessionExpired('2026-04-11T12:00:00Z')).toBe(false)
  })
})
