import { describe, expect, it } from 'vitest'

import { err, ok, unwrapOrThrow } from '../../src/types/index.ts'
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
    // Built from an entries tuple so `perfectionist/sort-objects`
    // can't reorder the keys away from the insertion sequence we
    // want to assert on.
    const object = Object.fromEntries([
      ['zulu', 0],
      ['alpha', 1],
      ['mike', 2],
    ])

    expect(typedKeys(object)).toStrictEqual(['zulu', 'alpha', 'mike'])
  })
})

describe.concurrent(unwrapOrThrow, () => {
  it('returns the success value', () => {
    expect(unwrapOrThrow(ok(42))).toBe(42)
  })

  it('rethrows the original cause when present', () => {
    const cause = new Error('boom')

    expect(() => unwrapOrThrow(err({ cause, kind: 'network' }))).toThrow(cause)
  })

  it('throws a synthesised Error for variants without a cause', () => {
    expect(() =>
      unwrapOrThrow(err({ kind: 'rate-limited', retryAfterMs: 60_000 })),
    ).toThrow('API request failed: rate-limited')
  })

  it('synthesises an Error when the cause is not an Error instance', () => {
    expect(() =>
      unwrapOrThrow(err({ cause: 'plain string', kind: 'network' })),
    ).toThrow('API request failed: network')
  })
})
