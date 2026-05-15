import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DisposableTimeout } from '../../src/resilience/disposable-timeout.ts'

describe('disposable timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts inactive', () => {
    using timeout = new DisposableTimeout()

    expect(timeout.isActive).toBe(false)
  })

  it('becomes active after schedule', () => {
    using timeout = new DisposableTimeout()
    timeout.schedule(vi.fn<() => void>(), 1000)

    expect(timeout.isActive).toBe(true)
  })

  it('executes callback after delay', () => {
    using timeout = new DisposableTimeout()
    const callback = vi.fn<() => void>()
    timeout.schedule(callback, 1000)
    vi.advanceTimersByTime(1000)

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('becomes inactive after clear', () => {
    using timeout = new DisposableTimeout()
    timeout.schedule(vi.fn<() => void>(), 1000)
    timeout.clear()

    expect(timeout.isActive).toBe(false)
  })

  it('does not execute callback after clear', () => {
    using timeout = new DisposableTimeout()
    const callback = vi.fn<() => void>()
    timeout.schedule(callback, 1000)
    timeout.clear()
    vi.advanceTimersByTime(1000)

    expect(callback).not.toHaveBeenCalled()
  })

  it('clears previous timeout on re-schedule', () => {
    using timeout = new DisposableTimeout()
    const callback1 = vi.fn<() => void>()
    const callback2 = vi.fn<() => void>()
    timeout.schedule(callback1, 1000)
    timeout.schedule(callback2, 1000)
    vi.advanceTimersByTime(1000)

    expect(callback1).not.toHaveBeenCalled()
    expect(callback2).toHaveBeenCalledTimes(1)
  })

  it('clear is idempotent when inactive', () => {
    using timeout = new DisposableTimeout()

    expect(() => {
      timeout.clear()
    }).not.toThrow()
    expect(timeout.isActive).toBe(false)
  })

  it('symbol.dispose clears the timeout', () => {
    const timeout = new DisposableTimeout()
    const callback = vi.fn<() => void>()
    timeout.schedule(callback, 1000)
    timeout[Symbol.dispose]()

    expect(timeout.isActive).toBe(false)

    vi.advanceTimersByTime(1000)

    expect(callback).not.toHaveBeenCalled()
  })

  it('unrefs the underlying timer so it does not keep the event loop alive', () => {
    const unrefCalls: number[] = []
    const { setTimeout: realSetTimeout } = globalThis
    vi.stubGlobal(
      'setTimeout',
      (callback: () => void, ms: number): ReturnType<typeof setTimeout> => {
        const handle = realSetTimeout(callback, ms)
        handle.unref = (): ReturnType<typeof setTimeout> => {
          unrefCalls.push(1)
          return handle
        }
        return handle
      },
    )
    using timeout = new DisposableTimeout()
    timeout.schedule(vi.fn<() => void>(), 1000)
    vi.unstubAllGlobals()

    expect(unrefCalls).toHaveLength(1)
  })
})
