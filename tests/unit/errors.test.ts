import {
  RegistrySyncError as CoreRegistrySyncError,
  ValidationError as CoreValidationError,
  failureCauseChain as coreFailureCauseChain,
  isKnownFailure as coreIsKnownFailure,
  logFailure as coreLogFailure,
} from '@olivierzal/api-core'
import { describe, expect, it } from 'vitest'

import {
  APIError,
  EntityNotFoundError,
  isAPIError,
  NoChangesError,
  RegistrySyncError,
  UpdateRejectedError,
  ValidationError,
} from '../../src/errors/index.ts'
import {
  failureCauseChain,
  isKnownFailure,
  logFailure,
} from '../../src/index.ts'

// Thin WIRING suite: the error hierarchy's MECHANISM — `APIError`, the
// `isAPIError` guard, the core classes' fields and `cause` chains — is
// pinned in @olivierzal/api-core's own suite, and re-running those
// clauses here against re-exported symbols would let coverage be
// satisfied by the wrong suite. What this file pins is what stays
// OURS: every protocol error this SDK adds extends the core's base, so
// a host catches the whole family through one guard whatever wire it
// talks to; the classes this SDK re-exports from the core ARE the
// core's — a local twin would break `instanceof` across the seam; and
// the failure-log helpers the package root hands a host are the core's
// too, so a host's own line and the SDK's seats judge one failure the
// same way, through the SDK's pin alone.

describe.concurrent('sdk errors over the core hierarchy', () => {
  it.each([
    [
      'EntityNotFoundError',
      new EntityNotFoundError('DeviceLocation', { entityId: 1 }),
    ],
    ['NoChangesError', new NoChangesError(1)],
    ['UpdateRejectedError', new UpdateRejectedError({ Power: ['declined'] })],
  ])('%s extends APIError and passes the family guard', (_name, error) => {
    expect(error).toBeInstanceOf(APIError)
    expect(isAPIError(error)).toBe(true)
  })

  it.each([
    ['RegistrySyncError', RegistrySyncError, CoreRegistrySyncError],
    ['ValidationError', ValidationError, CoreValidationError],
  ])('%s is the core class itself, not a twin', (_name, local, core) => {
    expect(local).toBe(core)
  })

  // Typed `unknown`: the rows are compared by identity, and left to
  // inference the table would narrow every helper to the void shape.
  it.each<[string, unknown, unknown]>([
    ['failureCauseChain', failureCauseChain, coreFailureCauseChain],
    ['isKnownFailure', isKnownFailure, coreIsKnownFailure],
    ['logFailure', logFailure, coreLogFailure],
  ])(
    '%s reaches the package root as the core helper itself',
    (_name, local, core) => {
      expect(local).toBe(core)
    },
  )
})
