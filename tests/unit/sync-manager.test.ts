import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SyncManager } from '../../src/api/sync-manager.ts'
import { MS_PER_MINUTE } from '../../src/time-units.ts'
import { createLogger } from '../helpers.ts'

describe(SyncManager, () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not schedule when constructed with interval=0', () => {
    const syncFunction = vi.fn<() => Promise<void>>().mockResolvedValue()
    const logger = createLogger()
    using manager = new SyncManager(syncFunction, logger, 0)

    manager.planNext()
    vi.advanceTimersByTime(10 * MS_PER_MINUTE)

    expect(syncFunction).not.toHaveBeenCalled()
  })

  it('does not schedule when constructed with `false` intervalMinutes', () => {
    const syncFunction = vi.fn<() => Promise<void>>().mockResolvedValue()
    const logger = createLogger()
    using manager = new SyncManager(syncFunction, logger, false)

    manager.planNext()
    vi.advanceTimersByTime(10 * MS_PER_MINUTE)

    expect(syncFunction).not.toHaveBeenCalled()
  })

  it('schedules syncFunction after interval ms and invokes it', async () => {
    const syncFunction = vi.fn<() => Promise<void>>().mockResolvedValue()
    const logger = createLogger()
    using manager = new SyncManager(syncFunction, logger, 5)

    manager.planNext()

    expect(syncFunction).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(5 * MS_PER_MINUTE)

    expect(syncFunction).toHaveBeenCalledTimes(1)
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('catches and logs a rejection from syncFunction', async () => {
    const error = new Error('boom')
    const syncFunction = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(error)
    const logger = createLogger()
    using manager = new SyncManager(syncFunction, logger, 1)

    manager.planNext()
    await vi.advanceTimersByTimeAsync(MS_PER_MINUTE)

    expect(syncFunction).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenCalledWith('Auto-sync failed:', error)
  })

  it('clear() cancels a pending timeout', () => {
    const syncFunction = vi.fn<() => Promise<void>>().mockResolvedValue()
    const logger = createLogger()
    using manager = new SyncManager(syncFunction, logger, 3)

    manager.planNext()
    manager.clear()
    vi.advanceTimersByTime(3 * MS_PER_MINUTE)

    expect(syncFunction).not.toHaveBeenCalled()
  })

  it('setInterval(minutes) updates interval and auto-reschedules', async () => {
    const syncFunction = vi.fn<() => Promise<void>>().mockResolvedValue()
    const logger = createLogger()
    using manager = new SyncManager(syncFunction, logger, 0)

    manager.setInterval(10)
    await vi.advanceTimersByTimeAsync(10 * MS_PER_MINUTE)

    expect(syncFunction).toHaveBeenCalledTimes(1)
  })

  it('setInterval replaces an existing pending timeout with the new interval', async () => {
    const syncFunction = vi.fn<() => Promise<void>>().mockResolvedValue()
    const logger = createLogger()
    using manager = new SyncManager(syncFunction, logger, 5)

    manager.planNext()

    // Replace the 5-minute schedule with a 1-minute schedule.
    manager.setInterval(1)

    await vi.advanceTimersByTimeAsync(MS_PER_MINUTE)

    expect(syncFunction).toHaveBeenCalledTimes(1)

    // Verify the original 5-minute timer was cleared (no extra fire).
    await vi.advanceTimersByTimeAsync(5 * MS_PER_MINUTE)

    expect(syncFunction).toHaveBeenCalledTimes(1)
  })

  it('setInterval(false) clears the timeout and does not reschedule', () => {
    const syncFunction = vi.fn<() => Promise<void>>().mockResolvedValue()
    const logger = createLogger()
    using manager = new SyncManager(syncFunction, logger, 5)

    manager.planNext()
    manager.setInterval(false)
    vi.advanceTimersByTime(10 * MS_PER_MINUTE)

    expect(syncFunction).not.toHaveBeenCalled()
  })

  it('setInterval(0) clears the timeout and does not reschedule', () => {
    const syncFunction = vi.fn<() => Promise<void>>().mockResolvedValue()
    const logger = createLogger()
    using manager = new SyncManager(syncFunction, logger, 5)

    manager.planNext()
    manager.setInterval(0)
    vi.advanceTimersByTime(10 * MS_PER_MINUTE)

    expect(syncFunction).not.toHaveBeenCalled()
  })

  it('symbol.dispose clears a pending timeout', () => {
    const syncFunction = vi.fn<() => Promise<void>>().mockResolvedValue()
    const logger = createLogger()
    const manager = new SyncManager(syncFunction, logger, 5)

    manager.planNext()
    manager[Symbol.dispose]()
    vi.advanceTimersByTime(5 * MS_PER_MINUTE)

    expect(syncFunction).not.toHaveBeenCalled()
  })

  it('planNext() replaces an existing pending timeout (DisposableTimeout semantics)', async () => {
    const syncFunction = vi.fn<() => Promise<void>>().mockResolvedValue()
    const logger = createLogger()
    using manager = new SyncManager(syncFunction, logger, 2)

    manager.planNext()
    // Advance partway through the first schedule, then re-schedule.
    await vi.advanceTimersByTimeAsync(MS_PER_MINUTE)
    manager.planNext()
    // The first timer would have fired at 2 * MS_PER_MINUTE from start; ensure it did not.
    await vi.advanceTimersByTimeAsync(MS_PER_MINUTE)

    expect(syncFunction).not.toHaveBeenCalled()

    // The replacement fires 2 minutes after the second planNext().
    await vi.advanceTimersByTimeAsync(MS_PER_MINUTE)

    expect(syncFunction).toHaveBeenCalledTimes(1)
  })
})
