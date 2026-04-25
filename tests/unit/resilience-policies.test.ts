import { describe, expect, it, vi } from 'vitest'

import {
  type ResiliencePolicy,
  AuthRetryPolicy,
  CompositePolicy,
  RateLimitError,
  RateLimitGate,
  RateLimitPolicy,
  RetryGuard,
  TransientRetryPolicy,
} from '../../src/resilience/index.ts'
import {
  createLogger,
  createServerError,
  createUnauthorizedError,
} from '../helpers.ts'

describe(CompositePolicy, () => {
  it('empty composite runs the attempt verbatim', async () => {
    const composite = new CompositePolicy([])
    const attempt = vi.fn<() => Promise<string>>().mockResolvedValue('ok')

    await expect(composite.run(attempt)).resolves.toBe('ok')
    expect(attempt).toHaveBeenCalledTimes(1)
  })

  it('wraps outer-to-inner — first array element sees the call first', async () => {
    const callOrder: string[] = []
    const makePolicy = (label: string): ResiliencePolicy => ({
      run: async <T>(inner: () => Promise<T>): Promise<T> => {
        callOrder.push(`${label}:before`)
        const result = await inner()
        callOrder.push(`${label}:after`)
        return result
      },
    })
    const composite = new CompositePolicy([
      makePolicy('outer'),
      makePolicy('mid'),
      makePolicy('inner'),
    ])

    await composite.run(async () => {
      callOrder.push('attempt')
      await Promise.resolve()
    })

    expect(callOrder).toStrictEqual([
      'outer:before',
      'mid:before',
      'inner:before',
      'attempt',
      'inner:after',
      'mid:after',
      'outer:after',
    ])
  })
})

describe(RateLimitPolicy, () => {
  it('short-circuits with RateLimitError when the gate is paused', async () => {
    const gate = new RateLimitGate({ hours: 2 })
    gate.recordAndLog(createLogger(), '120')
    const policy = new RateLimitPolicy(gate, createLogger())
    const attempt = vi.fn<() => Promise<string>>().mockResolvedValue('ok')

    await expect(policy.run(attempt)).rejects.toBeInstanceOf(RateLimitError)
    expect(attempt).not.toHaveBeenCalled()
  })

  it('records the gate on a 429 response and rethrows', async () => {
    const gate = new RateLimitGate({ hours: 2 })
    const policy = new RateLimitPolicy(gate, createLogger())
    const attempt = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(createServerError(429, '/x'))

    await expect(policy.run(attempt)).rejects.toThrow('Status 429')
    expect(gate.isPaused).toBe(true)
  })

  it('passes non-429 errors through without arming the gate', async () => {
    const gate = new RateLimitGate({ hours: 2 })
    const policy = new RateLimitPolicy(gate, createLogger())

    await expect(
      policy.run(async () => {
        await Promise.resolve()
        throw createServerError(500, '/x')
      }),
    ).rejects.toThrow('Status 500')
    expect(gate.isPaused).toBe(false)
  })
})

describe(AuthRetryPolicy, () => {
  it('replays the attempt after a 401 when reauthenticate returns true', async () => {
    using guard = new RetryGuard(1000)
    const reauthenticate = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValue(true)
    const policy = new AuthRetryPolicy(guard, reauthenticate)
    const attempt = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(createUnauthorizedError('/x'))
      .mockResolvedValueOnce('retried')

    await expect(policy.run(attempt)).resolves.toBe('retried')
    expect(attempt).toHaveBeenCalledTimes(2)
    expect(reauthenticate).toHaveBeenCalledTimes(1)
  })

  it('rethrows the 401 when the guard refuses a retry', async () => {
    using guard = new RetryGuard(1000)

    // consume the single token
    guard.tryConsume()
    const reauthenticate = vi.fn<() => Promise<boolean>>()
    const policy = new AuthRetryPolicy(guard, reauthenticate)

    await expect(
      policy.run(async () => {
        await Promise.resolve()
        throw createUnauthorizedError('/x')
      }),
    ).rejects.toThrow('Unauthorized')
    expect(reauthenticate).not.toHaveBeenCalled()
  })

  it('rethrows the 401 when reauthenticate fails', async () => {
    using guard = new RetryGuard(1000)
    const reauthenticate = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValue(false)
    const policy = new AuthRetryPolicy(guard, reauthenticate)

    await expect(
      policy.run(async () => {
        await Promise.resolve()
        throw createUnauthorizedError('/x')
      }),
    ).rejects.toThrow('Unauthorized')
    expect(reauthenticate).toHaveBeenCalledTimes(1)
  })

  it('passes non-401 errors through untouched', async () => {
    using guard = new RetryGuard(1000)
    const reauthenticate = vi.fn<() => Promise<boolean>>()
    const policy = new AuthRetryPolicy(guard, reauthenticate)

    await expect(
      policy.run(async () => {
        await Promise.resolve()
        throw createServerError(500, '/x')
      }),
    ).rejects.toThrow('Status 500')
    expect(reauthenticate).not.toHaveBeenCalled()
  })
})

describe(TransientRetryPolicy, () => {
  it('retries on a transient 503 and succeeds', async () => {
    vi.useFakeTimers()
    const onRetry =
      vi.fn<(retryAttempt: number, error: unknown, delayMs: number) => void>()
    const policy = new TransientRetryPolicy({ onRetry })
    const attempt = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(createServerError(503, '/x'))
      .mockResolvedValueOnce('ok')

    const promise = policy.run(attempt)
    await vi.advanceTimersByTimeAsync(2000)

    await expect(promise).resolves.toBe('ok')
    expect(onRetry).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('does not retry on non-transient 500', async () => {
    const onRetry =
      vi.fn<(retryAttempt: number, error: unknown, delayMs: number) => void>()
    const policy = new TransientRetryPolicy({ onRetry })
    const attempt = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(createServerError(500, '/x'))

    await expect(policy.run(attempt)).rejects.toThrow('Status 500')
    expect(attempt).toHaveBeenCalledTimes(1)
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('forwards an abort signal so a cancel during backoff bails out', async () => {
    const onRetry =
      vi.fn<(retryAttempt: number, error: unknown, delayMs: number) => void>()
    const controller = new AbortController()
    const policy = new TransientRetryPolicy({ onRetry }, controller.signal)
    const attempt = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(createServerError(503, '/x'))

    const promise = policy.run(attempt)
    // Wait for the first failure to land in the backoff sleep.
    await Promise.resolve()
    controller.abort(new Error('cancelled'))

    await expect(promise).rejects.toThrow('cancelled')
    expect(attempt).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
