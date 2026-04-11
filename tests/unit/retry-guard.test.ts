import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RetryGuard } from '../../src/services/retry-guard.ts'

describe('retry guard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts inactive and allows the first consume', () => {
    const guard = new RetryGuard(1000)

    expect(guard.isActive).toBe(false)
    expect(guard.tryConsume()).toBe(true)
    expect(guard.isActive).toBe(true)
  })

  it('rejects consecutive consumes within the window', () => {
    const guard = new RetryGuard(1000)

    guard.tryConsume()

    expect(guard.tryConsume()).toBe(false)
    expect(guard.tryConsume()).toBe(false)
  })

  it('refills the budget after the delay elapses', () => {
    const guard = new RetryGuard(1000)

    guard.tryConsume()
    vi.advanceTimersByTime(1000)

    expect(guard.isActive).toBe(false)
    expect(guard.tryConsume()).toBe(true)
  })

  it('symbol.dispose clears the pending window', () => {
    const guard = new RetryGuard(1000)

    guard.tryConsume()
    guard[Symbol.dispose]()

    expect(guard.isActive).toBe(false)
    expect(guard.tryConsume()).toBe(true)
  })
})
