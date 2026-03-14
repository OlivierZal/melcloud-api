import { describe, expect, it } from 'vitest'

import { typedKeys } from '../type-helpers.ts'

describe('typedKeys', () => {
  it('returns keys of a simple object', () => {
    const object = { alpha: 1, beta: 2, gamma: 3 }
    expect(typedKeys(object)).toStrictEqual(['alpha', 'beta', 'gamma'])
  })

  it('returns an empty array for an empty object', () => {
    expect(typedKeys({})).toStrictEqual([])
  })

  it('returns keys preserving their insertion order', () => {
    // Intentionally unsorted to verify insertion order
    const object = { zulu: 0, alpha: 1, mike: 2 } // eslint-disable-line perfectionist/sort-objects -- testing insertion order
    expect(typedKeys(object)).toStrictEqual(['zulu', 'alpha', 'mike'])
  })
})
