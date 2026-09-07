import { describe, expect, it } from 'vitest'

import { StateReadError } from '../../src/errors/index.ts'

describe.concurrent('stateReadError', () => {
  it('names the device and the moment in its message', () => {
    const error = new StateReadError(1000, { failure: { kind: 'network' } })

    expect(error.message).toBe(
      'Could not read the live state of device with id 1000 before writing',
    )
    expect(error.name).toBe('StateReadError')
    expect(error.entityId).toBe(1000)
  })

  it('carries the classified read failure for programmatic handling', () => {
    const failure = { kind: 'server', status: 500 } as const
    const error = new StateReadError(1000, { failure })

    expect(error.failure).toBe(failure)
  })

  it('chains the underlying error of the read as its cause', () => {
    const cause = new Error('ECONNRESET')
    const error = new StateReadError(1000, {
      failure: { cause, kind: 'network' },
    })

    expect(error.cause).toBe(cause)
  })

  it('has no cause when the read failure carries none', () => {
    const error = new StateReadError(1000, {
      failure: { kind: 'rate-limited', retryAfterMs: null },
    })

    expect(error.cause).toBeUndefined()
  })
})
