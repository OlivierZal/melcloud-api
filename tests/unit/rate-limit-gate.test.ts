import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  formatDurationHuman,
  RateLimitGate,
} from '../../src/resilience/rate-limit-gate.ts'
import { Temporal } from '../../src/temporal.ts'

describe(RateLimitGate, () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-11T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts open with no remaining time and no unblockAt', () => {
    const gate = new RateLimitGate({ hours: 1 })

    expect(gate.isPaused).toBe(false)
    expect(gate.remaining).toBeNull()
    expect(gate.unblockAt).toBeNull()
  })

  it('closes for the full fallback duration when no Retry-After is provided', () => {
    const gate = new RateLimitGate({ hours: 2 })

    gate.recordRateLimit()

    expect(gate.isPaused).toBe(true)
    // Use Luxon's millisecond conversion, accounting for slight drift.
    expect(gate.remaining?.total({ unit: 'hours' })).toBeGreaterThan(1.9)
    expect(gate.remaining?.total({ unit: 'hours' })).toBeLessThanOrEqual(2)
    // Absolute unblock time is 2 hours after the fixed system time.
    expect(gate.unblockAt?.toString({ smallestUnit: 'millisecond' })).toBe(
      '2026-04-11T14:00:00.000Z',
    )
  })

  it('honors a numeric Retry-After header (seconds)', () => {
    const gate = new RateLimitGate({ hours: 2 })

    gate.recordRateLimit(30)

    expect(gate.isPaused).toBe(true)
    expect(gate.remaining?.total({ unit: 'seconds' })).toBeGreaterThan(29)
    expect(gate.remaining?.total({ unit: 'seconds' })).toBeLessThanOrEqual(30)
  })

  it('honors a string Retry-After header (seconds)', () => {
    const gate = new RateLimitGate({ hours: 2 })

    gate.recordRateLimit('45')

    expect(gate.isPaused).toBe(true)
    expect(gate.remaining?.total({ unit: 'seconds' })).toBeGreaterThan(44)
  })

  it('falls back when Retry-After is non-numeric', () => {
    const gate = new RateLimitGate({ hours: 2 })

    gate.recordRateLimit('not-a-number')

    expect(gate.isPaused).toBe(true)
    expect(gate.remaining?.total({ unit: 'hours' })).toBeGreaterThan(1.9)
  })

  it('falls back when Retry-After is zero or negative', () => {
    const gate = new RateLimitGate({ hours: 2 })

    gate.recordRateLimit(0)

    expect(gate.remaining?.total({ unit: 'hours' })).toBeGreaterThan(1.9)

    gate.recordRateLimit(-5)

    expect(gate.remaining?.total({ unit: 'hours' })).toBeGreaterThan(1.9)
  })

  it('re-opens automatically after the window elapses', () => {
    const gate = new RateLimitGate({ seconds: 10 })
    gate.recordRateLimit(10)

    expect(gate.isPaused).toBe(true)

    vi.advanceTimersByTime(11 * 1000)

    expect(gate.isPaused).toBe(false)
    expect(gate.remaining).toBeNull()
  })

  it('reset() immediately re-opens the gate', () => {
    const gate = new RateLimitGate({ hours: 2 })
    gate.recordRateLimit(3600)

    expect(gate.isPaused).toBe(true)

    gate.reset()

    expect(gate.isPaused).toBe(false)
  })

  it('snapshot() returns all fields consistently when paused', () => {
    const gate = new RateLimitGate({ hours: 2 })
    gate.recordRateLimit()

    const snap = gate.snapshot()

    expect(snap.isPaused).toBe(true)
    expect(snap.remaining).not.toBeNull()
    expect(snap.unblockAt).not.toBeNull()
    expect(snap.unblockAt?.toString({ smallestUnit: 'millisecond' })).toBe(
      '2026-04-11T14:00:00.000Z',
    )
  })

  it('snapshot() returns all nulls when open', () => {
    const gate = new RateLimitGate({ hours: 2 })

    const snap = gate.snapshot()

    expect(snap.isPaused).toBe(false)
    expect(snap.remaining).toBeNull()
    expect(snap.unblockAt).toBeNull()
  })

  it('recordAndLog records the rate-limit and emits a formatted error', () => {
    const gate = new RateLimitGate({ hours: 2 })
    const error = vi.fn<(...data: unknown[]) => void>()

    gate.recordAndLog({ error }, 60, 'list operations')

    expect(gate.isPaused).toBe(true)
    expect(error).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('pausing list operations for'),
    )
    expect(error).toHaveBeenCalledWith(expect.stringContaining('429'))
  })

  it('recordAndLog omits the label suffix when none is provided', () => {
    const gate = new RateLimitGate({ hours: 2 })
    const error = vi.fn<(...data: unknown[]) => void>()

    gate.recordAndLog({ error }, 60)

    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(/pausing for \d+/u),
    )
  })
})

describe.concurrent(formatDurationHuman, () => {
  it('renders sub-minute windows as seconds with no minute mention', () => {
    const formatted = formatDurationHuman(
      Temporal.Duration.from({ seconds: 20 }),
    )

    expect(formatted).toBe('20 seconds')
  })

  it('renders exact-minute windows without a seconds component', () => {
    const formatted = formatDurationHuman(
      Temporal.Duration.from({ seconds: 120 }),
    )

    expect(formatted).toBe('2 minutes')
  })

  it('renders multi-minute windows as "M minutes, S seconds"', () => {
    const formatted = formatDurationHuman(
      Temporal.Duration.from({ seconds: 135 }),
    )

    expect(formatted).toBe('2 minutes, 15 seconds')
  })

  it('renders single-unit windows with singular forms', () => {
    expect(formatDurationHuman(Temporal.Duration.from({ seconds: 1 }))).toBe(
      '1 second',
    )
    expect(formatDurationHuman(Temporal.Duration.from({ minutes: 1 }))).toBe(
      '1 minute',
    )
    expect(
      formatDurationHuman(Temporal.Duration.from({ minutes: 1, seconds: 1 })),
    ).toBe('1 minute, 1 second')
  })
})
