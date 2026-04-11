import { beforeEach, describe, expect, vi } from 'vitest'

import { isSessionExpired } from '../../src/resilience/session-expiry.ts'
import { fakeTimersTest } from '../fixtures/fake-timers.ts'

describe(isSessionExpired, () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-04-11T12:00:00Z'))
  })

  fakeTimersTest(
    'returns false for an empty string (no expiry recorded yet)',
    () => {
      expect(isSessionExpired('')).toBe(false)
    },
  )

  fakeTimersTest('returns false for a valid ISO date in the future', () => {
    expect(isSessionExpired('2026-04-11T13:00:00Z')).toBe(false)
  })

  fakeTimersTest('returns true for a valid ISO date in the past', () => {
    expect(isSessionExpired('2026-04-11T11:00:00Z')).toBe(true)
  })

  fakeTimersTest(
    'returns true for an unparseable value (corruption self-heals)',
    () => {
      expect(isSessionExpired('not-a-valid-iso-date')).toBe(true)
    },
  )

  fakeTimersTest('returns true for the literal string "Invalid Date"', () => {
    expect(isSessionExpired('Invalid Date')).toBe(true)
  })

  fakeTimersTest(
    'returns false when exactly equal to now (strict past comparison)',
    () => {
      expect(isSessionExpired('2026-04-11T12:00:00Z')).toBe(false)
    },
  )

  fakeTimersTest(
    'parses ISO timestamps without explicit timezone offset',
    () => {
      /*
       * Regression for the format MELCloud Classic returns in
       * `LoginData.Expiry` (no `Z`, no offset). Native `Date.parse` would
       * interpret these in the host runtime timezone, shifting comparisons
       * by hours when host TZ ≠ configured TZ. Luxon `DateTime.fromISO`
       * uses `LuxonSettings.defaultZone` (set by Classic from ClassicAPIConfig.timezone).
       */
      expect(isSessionExpired('2030-12-31T00:00:00')).toBe(false)
      expect(isSessionExpired('2020-01-01T00:00:00')).toBe(true)
    },
  )
})
