import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HttpError } from '../../src/http/index.ts'
import {
  isTransientServerError,
  withRetryBackoff,
} from '../../src/resilience/retry-backoff.ts'

const ALWAYS_RETRYABLE = (): boolean => true
const NEVER_RETRYABLE = (): boolean => false

const httpError = (status?: number): unknown =>
  status === undefined ?
    new Error('network failure')
  : new HttpError(`Status ${String(status)}`, {
      data: {},
      headers: {},
      status,
    })

describe(isTransientServerError, () => {
  it.each([502, 503, 504])('returns true for HTTP %i', (status) => {
    expect(isTransientServerError(httpError(status))).toBe(true)
  })

  it.each([400, 401, 404, 429, 500, 505])(
    'returns false for non-transient HTTP %i',
    (status) => {
      expect(isTransientServerError(httpError(status))).toBe(false)
    },
  )

  it('returns false when the error has no HTTP response', () => {
    expect(isTransientServerError(httpError())).toBe(false)
  })

  it('returns false for non-HTTP errors', () => {
    expect(isTransientServerError(new Error('boom'))).toBe(false)
    expect(isTransientServerError('string')).toBe(false)
    expect(isTransientServerError(null)).toBe(false)
  })

  it('walks the cause chain to find a wrapped HTTP error', () => {
    const wrapped = new Error('Request failed', { cause: httpError(503) })

    expect(isTransientServerError(wrapped)).toBe(true)
  })

  it('stops safely on a self-referential cause', () => {
    const cyclic = { cause: null as unknown }
    cyclic.cause = cyclic

    expect(isTransientServerError(cyclic)).toBe(false)
  })
})

describe(withRetryBackoff, () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the first successful result without sleeping', async () => {
    const op = vi.fn<() => Promise<string>>().mockResolvedValue('ok')

    const result = await withRetryBackoff(op, {
      initialDelayMs: 100,
      isRetryable: ALWAYS_RETRYABLE,
      jitterRatio: 0,
      maxDelayMs: 10_000,
      maxRetries: 3,
    })

    expect(result).toBe('ok')
    expect(op).toHaveBeenCalledTimes(1)
  })

  it('retries up to maxRetries on retryable errors and then succeeds', async () => {
    const op = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('boom 1'))
      .mockRejectedValueOnce(new Error('boom 2'))
      .mockResolvedValue('finally')

    const promise = withRetryBackoff(op, {
      initialDelayMs: 100,
      isRetryable: ALWAYS_RETRYABLE,
      jitterRatio: 0,
      maxDelayMs: 10_000,
      maxRetries: 3,
    })

    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toBe('finally')
    expect(op).toHaveBeenCalledTimes(3)
  })

  it('rethrows immediately on a non-retryable error', async () => {
    const op = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValue(new Error('fatal'))

    await expect(
      withRetryBackoff(op, {
        initialDelayMs: 100,
        isRetryable: NEVER_RETRYABLE,
        jitterRatio: 0,
        maxDelayMs: 10_000,
        maxRetries: 3,
      }),
    ).rejects.toThrow('fatal')
    expect(op).toHaveBeenCalledTimes(1)
  })

  it('throws the last error after exhausting maxRetries', async () => {
    const op = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('boom 1'))
      .mockRejectedValueOnce(new Error('boom 2'))
      .mockRejectedValue(new Error('boom final'))

    const promise = withRetryBackoff(op, {
      initialDelayMs: 100,
      isRetryable: ALWAYS_RETRYABLE,
      jitterRatio: 0,
      maxDelayMs: 10_000,
      maxRetries: 2,
    })

    await Promise.all([
      expect(promise).rejects.toThrow('boom final'),
      vi.runAllTimersAsync(),
    ])

    // 1 initial attempt + 2 retries
    expect(op).toHaveBeenCalledTimes(3)
  })

  it('applies exponential backoff without jitter (deterministic)', async () => {
    const delays: number[] = []
    const op = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockRejectedValueOnce(new Error('3'))
      .mockResolvedValue('ok')

    const promise = withRetryBackoff(op, {
      initialDelayMs: 100,
      isRetryable: ALWAYS_RETRYABLE,
      jitterRatio: 0,
      maxDelayMs: 10_000,
      maxRetries: 3,
      onRetry: (_attempt, _error, delayMs) => {
        delays.push(delayMs)
      },
    })

    await vi.runAllTimersAsync()
    await promise

    // 100, 200, 400 (2^0, 2^1, 2^2 * initialDelayMs)
    expect(delays).toStrictEqual([100, 200, 400])
  })

  it('clamps the computed delay to maxDelayMs', async () => {
    const delays: number[] = []
    const op = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockRejectedValueOnce(new Error('3'))
      .mockRejectedValueOnce(new Error('4'))
      .mockResolvedValue('ok')

    const promise = withRetryBackoff(op, {
      initialDelayMs: 1000,
      isRetryable: ALWAYS_RETRYABLE,
      jitterRatio: 0,
      maxDelayMs: 2500,
      maxRetries: 4,
      onRetry: (_attempt, _error, delayMs) => {
        delays.push(delayMs)
      },
    })

    await vi.runAllTimersAsync()
    await promise

    // 1000, 2000, 4000→clamped to 2500, 8000→clamped to 2500
    expect(delays).toStrictEqual([1000, 2000, 2500, 2500])
  })

  it('samples jitter within the configured ratio band', async () => {
    const delays: number[] = []
    // Upper bound of the jitter interval.
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(1)
    try {
      const op = vi
        .fn<() => Promise<string>>()
        .mockRejectedValueOnce(new Error('1'))
        .mockResolvedValue('ok')

      const promise = withRetryBackoff(op, {
        initialDelayMs: 1000,
        isRetryable: ALWAYS_RETRYABLE,
        jitterRatio: 0.25,
        maxDelayMs: 10_000,
        maxRetries: 1,
        onRetry: (_attempt, _error, delayMs) => {
          delays.push(delayMs)
        },
      })

      await vi.runAllTimersAsync()
      await promise

      // Math.random()=1 → jitter multiplier = +0.25 → 1000 + 250 = 1250
      expect(delays).toStrictEqual([1250])
    } finally {
      randomSpy.mockRestore()
    }
  })

  it('aborts the backoff sleep when the signal fires', async () => {
    const controller = new AbortController()
    const op = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue('ok')

    const promise = withRetryBackoff(op, {
      initialDelayMs: 60_000,
      isRetryable: ALWAYS_RETRYABLE,
      jitterRatio: 0,
      maxDelayMs: 60_000,
      maxRetries: 3,
      signal: controller.signal,
    })
    // Let the first attempt reject and the loop reach `await sleep(...)`.
    await Promise.resolve()
    controller.abort(new Error('cancelled'))

    await expect(promise).rejects.toThrow('cancelled')
    // Only the first attempt fired — the second never started.
    expect(op).toHaveBeenCalledTimes(1)
  })

  it('wraps a non-Error abort reason into an Error rejection', async () => {
    const controller = new AbortController()
    const op = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue('ok')

    const promise = withRetryBackoff(op, {
      initialDelayMs: 60_000,
      isRetryable: ALWAYS_RETRYABLE,
      jitterRatio: 0,
      maxDelayMs: 60_000,
      maxRetries: 3,
      signal: controller.signal,
    })
    await Promise.resolve()
    controller.abort('cancelled-as-string')

    await expect(promise).rejects.toThrow('cancelled-as-string')
    expect(op).toHaveBeenCalledTimes(1)
  })

  it('rejects immediately when the signal is already aborted on entry', async () => {
    const controller = new AbortController()
    controller.abort(new Error('pre-cancelled'))
    const op = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue('ok')

    await expect(
      withRetryBackoff(op, {
        initialDelayMs: 60_000,
        isRetryable: ALWAYS_RETRYABLE,
        jitterRatio: 0,
        maxDelayMs: 60_000,
        maxRetries: 3,
        signal: controller.signal,
      }),
    ).rejects.toThrow('pre-cancelled')
    // First attempt ran, sleep refused to start, no second attempt.
    expect(op).toHaveBeenCalledTimes(1)
  })

  it('passes the error and attempt number to onRetry', async () => {
    const onRetry =
      vi.fn<(attempt: number, error: unknown, delayMs: number) => void>()
    const errors = [new Error('1'), new Error('2')]
    const op = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(errors[0])
      .mockRejectedValueOnce(errors[1])
      .mockResolvedValue('ok')

    const promise = withRetryBackoff(op, {
      initialDelayMs: 50,
      isRetryable: ALWAYS_RETRYABLE,
      jitterRatio: 0,
      maxDelayMs: 10_000,
      maxRetries: 2,
      onRetry,
    })

    await vi.runAllTimersAsync()
    await promise

    expect(onRetry).toHaveBeenNthCalledWith(1, 1, errors[0], 50)
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, errors[1], 100)
  })
})
