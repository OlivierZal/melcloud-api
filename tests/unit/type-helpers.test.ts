import { describe, expect, expectTypeOf, it } from 'vitest'

import type { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import type { HomeDeviceAtwFacade } from '../../src/facades/home-device-atw.ts'
import type {
  HomeAtwEnergySeries,
  HomeEnergySeries,
} from '../../src/facades/home-energy.ts'
import {
  type HomeAtaValues,
  type HomeAtwValues,
  type Result,
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

// The per-type return of the energy read is what tells a consumer an
// air-to-air unit has no production to offer, and the bivariant
// subclass overrides are what keep the update payloads per-type: a
// silent degradation of either would leave every runtime test green,
// so both contracts are pinned at the type level.
describe('home per-type facade contracts', () => {
  it('answers one energy direction on ATA and both on ATW', () => {
    expectTypeOf<
      Awaited<ReturnType<HomeDeviceAtaFacade['getEnergySeries']>>
    >().toEqualTypeOf<Result<HomeEnergySeries>>()
    expectTypeOf<
      Awaited<ReturnType<HomeDeviceAtwFacade['getEnergySeries']>>
    >().toEqualTypeOf<Result<HomeAtwEnergySeries>>()
  })

  // The raw read is the telemetry endpoint's, which serves air-to-air
  // units alone.
  it('keeps the raw telemetry read off the ATW facade', () => {
    expectTypeOf<HomeDeviceAtaFacade>().toHaveProperty('getEnergy')
    expectTypeOf<HomeDeviceAtwFacade>().not.toHaveProperty('getEnergy')
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
