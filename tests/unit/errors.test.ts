import { Duration } from 'luxon'
import { describe, expect, it } from 'vitest'

import {
  AuthenticationError,
  isMelCloudError,
  MelCloudError,
  NetworkError,
  RateLimitError,
  TransientServerError,
} from '../../src/errors.ts'

describe('melCloudError hierarchy', () => {
  it('authenticationError is an instance of MelCloudError and Error', () => {
    const error = new AuthenticationError('bad creds')

    expect(error).toBeInstanceOf(AuthenticationError)
    expect(error).toBeInstanceOf(MelCloudError)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('bad creds')
    expect(error.name).toBe('AuthenticationError')
  })

  it('transientServerError inherits the hierarchy', () => {
    const error = new TransientServerError('still unhealthy')

    expect(error).toBeInstanceOf(TransientServerError)
    expect(error).toBeInstanceOf(MelCloudError)
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('TransientServerError')
  })

  it('networkError inherits the hierarchy', () => {
    const error = new NetworkError('connection refused')

    expect(error).toBeInstanceOf(NetworkError)
    expect(error).toBeInstanceOf(MelCloudError)
    expect(error.name).toBe('NetworkError')
  })

  it('preserves the original rejection as `cause`', () => {
    const cause = new Error('upstream')
    const error = new TransientServerError('wrapped', { cause })

    expect(error.cause).toBe(cause)
  })

  it('rateLimitError carries the retryAfter duration', () => {
    const retryAfter = Duration.fromObject({ seconds: 30 })
    const error = new RateLimitError('throttled', { retryAfter })

    expect(error).toBeInstanceOf(RateLimitError)
    expect(error).toBeInstanceOf(MelCloudError)
    expect(error.retryAfter?.as('seconds')).toBe(30)
    expect(error.name).toBe('RateLimitError')
  })

  it('rateLimitError accepts null retryAfter when the window is unknown', () => {
    const error = new RateLimitError('throttled', { retryAfter: null })

    expect(error.retryAfter).toBeNull()
  })

  it('rateLimitError preserves the cause alongside retryAfter', () => {
    const cause = new Error('429')
    const error = new RateLimitError('throttled', {
      cause,
      retryAfter: null,
    })

    expect(error.cause).toBe(cause)
  })
})

describe(isMelCloudError, () => {
  it.each([
    ['AuthenticationError', new AuthenticationError('x')],
    ['RateLimitError', new RateLimitError('x', { retryAfter: null })],
    ['TransientServerError', new TransientServerError('x')],
    ['NetworkError', new NetworkError('x')],
  ])('returns true for %s', (_name, error) => {
    expect(isMelCloudError(error)).toBe(true)
  })

  it.each([
    ['plain Error', new Error('boom')],
    ['TypeError', new TypeError('bad')],
    ['string', 'boom'],
    ['null', null],
    ['undefined', undefined],
    ['plain object', { message: 'boom' }],
  ])('returns false for %s', (_name, value) => {
    expect(isMelCloudError(value)).toBe(false)
  })

  it('narrows the type so the subclass surface is accessible', () => {
    const value: unknown = new RateLimitError('x', { retryAfter: null })
    // Compile-time proof: `isMelCloudError` narrows `unknown` → `MelCloudError`.
    const narrowed = isMelCloudError(value) ? value : null

    expect(narrowed?.name).toBe('RateLimitError')
  })
})
