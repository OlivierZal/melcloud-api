import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DisposableTimeout } from '../../src/services/disposable-timeout.ts'

describe('disposableTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts inactive', () => {
    const timeout = new DisposableTimeout()

    expect(timeout.isActive).toBe(false)
  })

  it('becomes active after schedule', () => {
    const timeout = new DisposableTimeout()
    timeout.schedule(() => {}, 1000)

    expect(timeout.isActive).toBe(true)
  })

  it('executes callback after delay', () => {
    const timeout = new DisposableTimeout()
    const callback = vi.fn()
    timeout.schedule(callback, 1000)
    vi.advanceTimersByTime(1000)

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('becomes inactive after clear', () => {
    const timeout = new DisposableTimeout()
    timeout.schedule(() => {}, 1000)
    timeout.clear()

    expect(timeout.isActive).toBe(false)
  })

  it('does not execute callback after clear', () => {
    const timeout = new DisposableTimeout()
    const callback = vi.fn()
    timeout.schedule(callback, 1000)
    timeout.clear()
    vi.advanceTimersByTime(1000)

    expect(callback).not.toHaveBeenCalled()
  })

  it('clears previous timeout on re-schedule', () => {
    const timeout = new DisposableTimeout()
    const callback1 = vi.fn()
    const callback2 = vi.fn()
    timeout.schedule(callback1, 1000)
    timeout.schedule(callback2, 1000)
    vi.advanceTimersByTime(1000)

    expect(callback1).not.toHaveBeenCalled()
    expect(callback2).toHaveBeenCalledTimes(1)
  })

  it('clear is idempotent when inactive', () => {
    const timeout = new DisposableTimeout()

    expect(() => {
      timeout.clear()
    }).not.toThrow()
    expect(timeout.isActive).toBe(false)
  })

  it('symbol.dispose clears the timeout', () => {
    const timeout = new DisposableTimeout()
    const callback = vi.fn()
    timeout.schedule(callback, 1000)
    timeout[Symbol.dispose]()

    expect(timeout.isActive).toBe(false)

    vi.advanceTimersByTime(1000)

    expect(callback).not.toHaveBeenCalled()
  })
})
