import { describe, expect, expectTypeOf, it } from 'vitest'

import type { HomeEnergyQuery } from '../../src/facades/home-base-device.ts'
import type { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import type { HomeDeviceAtwFacade } from '../../src/facades/home-device-atw.ts'
import {
  type HomeAtaDeviceData,
  type HomeAtaValues,
  type HomeAtwDeviceData,
  type HomeAtwValues,
  type Resolved,
  type UndefinedTolerant,
  err,
  mapResult,
  ok,
} from '../../src/types/index.ts'
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

describe.concurrent(mapResult, () => {
  it('transforms the success value via fn', () => {
    expect(mapResult(ok(2), (value) => value * 3)).toStrictEqual({
      ok: true,
      value: 6,
    })
  })

  it('passes the failure branch through unchanged', () => {
    const failure = err({ cause: new Error('boom'), kind: 'network' as const })

    expect(mapResult(failure, (value: number) => value * 3)).toBe(failure)
  })
})

interface Settings {
  interval: number | null
  label: string
}

// Ported from heatzy-api, whose twin of src/types/utility.ts carries the
// same clauses: the two copies are byte-identical and these are the only
// assertions either repo makes about them.
describe('resolved', () => {
  it('makes every property required and strips explicit undefined', () => {
    expectTypeOf<
      Resolved<{ interval?: number | undefined; label?: string | undefined }>
    >().toEqualTypeOf<{ interval: number; label: string }>()
  })

  it('preserves null — a sentinel here, not an absence marker', () => {
    expectTypeOf<
      Resolved<{ interval?: number | null | undefined }>
    >().toEqualTypeOf<{ interval: number | null }>()
  })
})

// The conditional is the SOLE compile-time enforcement of the ATW
// measure requirement (the adapter beneath takes `measure?` and defaults
// it), and the bivariant subclass overrides are what keep the update
// payloads per-type: a silent degradation of either would leave every
// runtime test green, so both contracts are pinned at the type level.
describe('home per-type facade contracts', () => {
  it('requires the energy direction on ATW and refuses it on ATA', () => {
    expectTypeOf<HomeEnergyQuery<HomeAtwDeviceData>>().toEqualTypeOf<{
      from: string
      interval: string
      measure: 'consumed' | 'produced'
      to: string
    }>()
    expectTypeOf<HomeEnergyQuery<HomeAtaDeviceData>>().toEqualTypeOf<{
      from: string
      interval: string
      to: string
    }>()
  })

  it('narrows each facade updateValues to its own payload', () => {
    expectTypeOf<
      Parameters<HomeDeviceAtaFacade['updateValues']>[0]
    >().toEqualTypeOf<HomeAtaValues>()
    expectTypeOf<
      Parameters<HomeDeviceAtwFacade['updateValues']>[0]
    >().toEqualTypeOf<HomeAtwValues>()
  })
})

describe('undefinedTolerant', () => {
  it('widens every property into an optional, undefined-admitting one', () => {
    expectTypeOf<UndefinedTolerant<Settings>>().toEqualTypeOf<{
      interval?: number | null | undefined
      label?: string | undefined
    }>()
  })

  it('round-trips through Resolved back to the source shape', () => {
    expectTypeOf<
      Resolved<UndefinedTolerant<Settings>>
    >().toEqualTypeOf<Settings>()
  })
})
