import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isSessionExpired } from '../../src/resilience/session-expiry.ts'

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

  it('parses ISO timestamps without explicit timezone offset', () => {
    // Regression for the format MELCloud Classic returns in
    // `ClassicLoginData.Expiry` (no `Z`, no offset). Native `Date.parse`
    // would interpret these in the host runtime timezone, shifting
    // comparisons by hours when host TZ ≠ configured TZ. The function
    // now takes an explicit `zone` argument (Classic threads its
    // configured timezone, Home passes `'utc'`).
    expect(isSessionExpired('2030-12-31T00:00:00', 0, 'Europe/Paris')).toBe(
      false,
    )
    expect(isSessionExpired('2020-01-01T00:00:00', 0, 'Europe/Paris')).toBe(
      true,
    )
  })

  it('interprets the same offset-less ISO differently across zones', () => {
    // Multi-instance isolation regression: the same `expiry` must be
    // resolved against the *caller-provided* zone, not a process-global
    // default. At the frozen system time `2026-04-11T12:00:00Z`,
    // `2026-04-11T13:30:00` is:
    //   • UTC+02:00 (Europe/Paris in DST) → 11:30Z → past   → true
    //   • UTC-04:00 (America/New_York DST) → 17:30Z → future → false
    expect(isSessionExpired('2026-04-11T13:30:00', 0, 'Europe/Paris')).toBe(
      true,
    )
    expect(isSessionExpired('2026-04-11T13:30:00', 0, 'America/New_York')).toBe(
      false,
    )
  })

  it('falls back to the host local zone when no zone is supplied', () => {
    // With `zone` undefined the function falls back to `'local'` rather
    // than `Settings.defaultZone`, so the result is independent of any
    // process-global mutation another module might have performed.
    expect(isSessionExpired('2030-12-31T00:00:00')).toBe(false)
    expect(isSessionExpired('2020-01-01T00:00:00')).toBe(true)
  })
})
