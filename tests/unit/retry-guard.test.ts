import { describe, expect, vi } from 'vitest'

import { RetryGuard } from '../../src/resilience/retry-guard.ts'
import { fakeTimersTest } from '../fixtures/fake-timers.ts'

describe('retry guard', () => {
  fakeTimersTest('starts inactive and allows the first consume', () => {
    const guard = new RetryGuard(1000)

    expect(guard.isActive).toBe(false)
    expect(guard.tryConsume()).toBe(true)
    expect(guard.isActive).toBe(true)
  })

  fakeTimersTest('rejects consecutive consumes within the window', () => {
    const guard = new RetryGuard(1000)

    guard.tryConsume()

    expect(guard.tryConsume()).toBe(false)
    expect(guard.tryConsume()).toBe(false)
  })

  fakeTimersTest('refills the budget after the delay elapses', () => {
    const guard = new RetryGuard(1000)

    guard.tryConsume()
    vi.advanceTimersByTime(1000)

    expect(guard.isActive).toBe(false)
    expect(guard.tryConsume()).toBe(true)
  })

  fakeTimersTest('symbol.dispose clears the pending window', () => {
    const guard = new RetryGuard(1000)

    guard.tryConsume()
    guard[Symbol.dispose]()

    expect(guard.isActive).toBe(false)
    expect(guard.tryConsume()).toBe(true)
  })
})
