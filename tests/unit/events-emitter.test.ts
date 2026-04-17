import { describe, expect, it, vi } from 'vitest'

import type { Logger, RequestLifecycleEvents } from '../../src/api/index.ts'
import { RequestLifecycleEmitter } from '../../src/observability/events-emitter.ts'

const createLogger = (): Logger => ({
  error: vi.fn<(...data: unknown[]) => void>(),
  log: vi.fn<(...data: unknown[]) => void>(),
})

const context = { correlationId: 'corr-1', method: 'GET', url: '/test' }

describe(RequestLifecycleEmitter, () => {
  it('no-ops when no events bundle is configured', () => {
    const logger = createLogger()
    const emitter = new RequestLifecycleEmitter(undefined, logger)

    expect(() => {
      emitter.emitStart(context)
      emitter.emitComplete({ ...context, durationMs: 10, status: 200 })
      emitter.emitError({
        ...context,
        durationMs: 10,
        error: new Error('boom'),
      })
      emitter.emitRetry({ ...context, attempt: 1, delayMs: 100, error: null })
    }).not.toThrow()
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('forwards each lifecycle event to the matching callback', () => {
    const logger = createLogger()
    const events = {
      onRequestComplete:
        vi.fn<NonNullable<RequestLifecycleEvents['onRequestComplete']>>(),
      onRequestError:
        vi.fn<NonNullable<RequestLifecycleEvents['onRequestError']>>(),
      onRequestRetry:
        vi.fn<NonNullable<RequestLifecycleEvents['onRequestRetry']>>(),
      onRequestStart:
        vi.fn<NonNullable<RequestLifecycleEvents['onRequestStart']>>(),
    }
    const emitter = new RequestLifecycleEmitter(events, logger)
    const cause = new Error('upstream')

    emitter.emitStart(context)
    emitter.emitComplete({ ...context, durationMs: 123, status: 200 })
    emitter.emitError({ ...context, durationMs: 456, error: cause })
    emitter.emitRetry({ ...context, attempt: 2, delayMs: 500, error: cause })

    expect(events.onRequestStart).toHaveBeenCalledWith(context)
    expect(events.onRequestComplete).toHaveBeenCalledWith({
      ...context,
      durationMs: 123,
      status: 200,
    })
    expect(events.onRequestError).toHaveBeenCalledWith({
      ...context,
      durationMs: 456,
      error: cause,
    })
    expect(events.onRequestRetry).toHaveBeenCalledWith({
      ...context,
      attempt: 2,
      delayMs: 500,
      error: cause,
    })
  })

  it('swallows callback exceptions and logs them at error level', () => {
    const logger = createLogger()
    const events = {
      onRequestStart: vi.fn<
        NonNullable<RequestLifecycleEvents['onRequestStart']>
      >(() => {
        throw new Error('observer went rogue')
      }),
    }
    const emitter = new RequestLifecycleEmitter(events, logger)

    expect(() => {
      emitter.emitStart(context)
    }).not.toThrow()
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('onRequestStart'),
      expect.any(Error),
    )
  })
})
