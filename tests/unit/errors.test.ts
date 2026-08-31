import { describe, expect, it } from 'vitest'

import {
  APIError,
  AuthenticationError,
  isAPIError,
  RateLimitError,
  RegistrySyncError,
  ValidationError,
} from '../../src/errors/index.ts'
import { Temporal } from '../../src/temporal.ts'

describe.concurrent('apiError hierarchy', () => {
  it('authenticationError is an instance of APIError and Error', () => {
    const error = new AuthenticationError('bad creds')

    expect(error).toBeInstanceOf(AuthenticationError)
    expect(error).toBeInstanceOf(APIError)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('bad creds')
    expect(error.name).toBe('AuthenticationError')
  })

  it('rateLimitError carries the retryAfter duration and unblockAt time', () => {
    const retryAfter = Temporal.Duration.from({ seconds: 30 })
    const unblockAt = Temporal.Instant.from('2026-01-01T12:30:00Z')
    const error = new RateLimitError('throttled', { retryAfter, unblockAt })

    expect(error).toBeInstanceOf(RateLimitError)
    expect(error).toBeInstanceOf(APIError)
    expect(error.retryAfter?.total({ unit: 'seconds' })).toBe(30)
    expect(error.unblockAt?.equals(unblockAt)).toBe(true)
    expect(error.name).toBe('RateLimitError')
  })

  it('rateLimitError accepts null fields when the window is unknown', () => {
    const error = new RateLimitError('throttled', {
      retryAfter: null,
      unblockAt: null,
    })

    expect(error.retryAfter).toBeNull()
    expect(error.unblockAt).toBeNull()
  })

  it('rateLimitError preserves the cause alongside its structured fields', () => {
    const cause = new Error('429')
    const error = new RateLimitError('throttled', {
      cause,
      retryAfter: null,
      unblockAt: null,
    })

    expect(error.cause).toBe(cause)
  })

  it('registrySyncError preserves the enforced-sync failure as its cause and is no AuthenticationError', () => {
    const cause = new Error('registry down')
    const error = new RegistrySyncError('signed in, registry unverified', {
      cause,
    })

    expect(error).toBeInstanceOf(RegistrySyncError)
    expect(error).toBeInstanceOf(APIError)
    // The whole point of the type: an enforced-sync failure must never
    // classify as a refused credential.
    expect(error).not.toBeInstanceOf(AuthenticationError)
    expect(error.name).toBe('RegistrySyncError')
    expect(error.cause).toBe(cause)
  })

  it('validationError carries context and cause', () => {
    const cause = new Error('zod issue')
    const error = new ValidationError('bad shape', {
      cause,
      context: 'BFF /context',
    })

    expect(error).toBeInstanceOf(ValidationError)
    expect(error).toBeInstanceOf(APIError)
    expect(error.name).toBe('ValidationError')
    expect(error.context).toBe('BFF /context')
    expect(error.cause).toBe(cause)
  })
})

describe.concurrent(isAPIError, () => {
  it.each([
    ['AuthenticationError', new AuthenticationError('x')],
    [
      'RateLimitError',
      new RateLimitError('x', { retryAfter: null, unblockAt: null }),
    ],
  ])('returns true for %s', (_name, error: unknown) => {
    expect(isAPIError(error)).toBe(true)
  })

  it.each([
    ['plain Error', new Error('boom')],
    ['TypeError', new TypeError('bad')],
    ['string', 'boom'],
    ['null', null],
    ['undefined', undefined],
    ['plain object', { message: 'boom' }],
  ])('returns false for %s', (_name, value) => {
    expect(isAPIError(value)).toBe(false)
  })

  it('narrows the type so the subclass surface is accessible', () => {
    const value: unknown = new RateLimitError('x', {
      retryAfter: null,
      unblockAt: null,
    })
    // Compile-time proof: `isAPIError` narrows `unknown` → `APIError`.
    const narrowed = isAPIError(value) ? value : null

    expect(narrowed?.name).toBe('RateLimitError')
  })
})
