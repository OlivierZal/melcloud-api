import { Duration } from 'luxon'
import { describe, expect, it } from 'vitest'

import {
  APIError,
  AuthenticationError,
  isAPIError,
  NetworkError,
  RateLimitError,
  TransientServerError,
  ValidationError,
} from '../../src/errors/index.ts'

describe.concurrent('apiError hierarchy', () => {
  it('authenticationError is an instance of APIError and Error', () => {
    const error = new AuthenticationError('bad creds')

    expect(error).toBeInstanceOf(AuthenticationError)
    expect(error).toBeInstanceOf(APIError)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('bad creds')
    expect(error.name).toBe('AuthenticationError')
  })

  it('transientServerError inherits the hierarchy', () => {
    const error = new TransientServerError('still unhealthy')

    expect(error).toBeInstanceOf(TransientServerError)
    expect(error).toBeInstanceOf(APIError)
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('TransientServerError')
  })

  it('networkError inherits the hierarchy', () => {
    const error = new NetworkError('connection refused')

    expect(error).toBeInstanceOf(NetworkError)
    expect(error).toBeInstanceOf(APIError)
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
    expect(error).toBeInstanceOf(APIError)
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
    ['RateLimitError', new RateLimitError('x', { retryAfter: null })],
    ['TransientServerError', new TransientServerError('x')],
    ['NetworkError', new NetworkError('x')],
  ])('returns true for %s', (_name, error) => {
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
    const value: unknown = new RateLimitError('x', { retryAfter: null })
    // Compile-time proof: `isAPIError` narrows `unknown` → `APIError`.
    const narrowed = isAPIError(value) ? value : null

    expect(narrowed?.name).toBe('RateLimitError')
  })
})
