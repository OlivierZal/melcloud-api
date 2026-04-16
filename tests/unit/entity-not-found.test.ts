import { describe, expect, it } from 'vitest'

import {
  APIError,
  EntityNotFoundError,
  isAPIError,
} from '../../src/errors/index.ts'

describe.concurrent('entityNotFoundError', () => {
  it('formats the message identically to the legacy Error', () => {
    const error = new EntityNotFoundError('DeviceLocation', 42)

    expect(error.message).toBe('DeviceLocation with id 42 not found')
  })

  it('exposes tableName and entityId for programmatic handling', () => {
    const error = new EntityNotFoundError('ClassicArea', 7)

    expect(error.tableName).toBe('ClassicArea')
    expect(error.entityId).toBe(7)
  })

  it('is an instance of Error, APIError, and EntityNotFoundError', () => {
    const error = new EntityNotFoundError('ClassicBuilding', 1)

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(APIError)
    expect(error).toBeInstanceOf(EntityNotFoundError)
  })

  it('is detected by the isAPIError type guard', () => {
    const error = new EntityNotFoundError('ClassicFloor', 3)

    expect(isAPIError(error)).toBe(true)
  })

  it('preserves the original rejection as `cause`', () => {
    const cause = new Error('upstream')
    const error = new EntityNotFoundError('ClassicArea', 9, { cause })

    expect(error.cause).toBe(cause)
  })

  it('sets name to "EntityNotFoundError"', () => {
    const error = new EntityNotFoundError('DeviceLocation', 1)

    expect(error.name).toBe('EntityNotFoundError')
  })
})
