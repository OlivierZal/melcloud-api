import { describe, expect, it } from 'vitest'

import { typedKeys } from '../../src/utils.ts'

describe.concurrent(typedKeys, () => {
  it('returns keys of a simple object', () => {
    const object = { alpha: 1, beta: 2, gamma: 3 }

    expect(typedKeys(object)).toStrictEqual(['alpha', 'beta', 'gamma'])
  })

  it('returns an empty array for an empty object', () => {
    expect(typedKeys({})).toStrictEqual([])
  })

  it('returns keys preserving their insertion order', () => {
    const object = {
      zulu: 0,
      // Intentionally unsorted
      alpha: 1,
      // To verify insertion order
      mike: 2,
    }

    expect(typedKeys(object)).toStrictEqual(['zulu', 'alpha', 'mike'])
  })
})
