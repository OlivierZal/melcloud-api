import { describe, expect, vi } from 'vitest'

import { DisposableTimeout } from '../../src/resilience/disposable-timeout.ts'
import { fakeTimersTest } from '../fixtures/fake-timers.ts'

describe('disposable timeout', () => {
  fakeTimersTest('starts inactive', () => {
    const timeout = new DisposableTimeout()

    expect(timeout.isActive).toBe(false)
  })

  fakeTimersTest('becomes active after schedule', () => {
    const timeout = new DisposableTimeout()
    timeout.schedule(vi.fn<() => void>(), 1000)

    expect(timeout.isActive).toBe(true)
  })

  fakeTimersTest('executes callback after delay', () => {
    const timeout = new DisposableTimeout()
    const callback = vi.fn<() => void>()
    timeout.schedule(callback, 1000)
    vi.advanceTimersByTime(1000)

    expect(callback).toHaveBeenCalledTimes(1)
  })

  fakeTimersTest('becomes inactive after clear', () => {
    const timeout = new DisposableTimeout()
    timeout.schedule(vi.fn<() => void>(), 1000)
    timeout.clear()

    expect(timeout.isActive).toBe(false)
  })

  fakeTimersTest('does not execute callback after clear', () => {
    const timeout = new DisposableTimeout()
    const callback = vi.fn<() => void>()
    timeout.schedule(callback, 1000)
    timeout.clear()
    vi.advanceTimersByTime(1000)

    expect(callback).not.toHaveBeenCalled()
  })

  fakeTimersTest('clears previous timeout on re-schedule', () => {
    const timeout = new DisposableTimeout()
    const callback1 = vi.fn<() => void>()
    const callback2 = vi.fn<() => void>()
    timeout.schedule(callback1, 1000)
    timeout.schedule(callback2, 1000)
    vi.advanceTimersByTime(1000)

    expect(callback1).not.toHaveBeenCalled()
    expect(callback2).toHaveBeenCalledTimes(1)
  })

  fakeTimersTest('clear is idempotent when inactive', () => {
    const timeout = new DisposableTimeout()

    expect(() => {
      timeout.clear()
    }).not.toThrow()
    expect(timeout.isActive).toBe(false)
  })

  fakeTimersTest('symbol.dispose clears the timeout', () => {
    const timeout = new DisposableTimeout()
    const callback = vi.fn<() => void>()
    timeout.schedule(callback, 1000)
    timeout[Symbol.dispose]()

    expect(timeout.isActive).toBe(false)

    vi.advanceTimersByTime(1000)

    expect(callback).not.toHaveBeenCalled()
  })
})
