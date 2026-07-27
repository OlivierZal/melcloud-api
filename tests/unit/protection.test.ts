import { describe, expect, it } from 'vitest'

import {
  clampFrostProtection,
  clampOverheatProtection,
} from '../../src/protection.ts'

describe('protection clamps', () => {
  describe(clampFrostProtection, () => {
    it.each([
      { expected: { max: 12, min: 6 }, max: 12, min: 6 },
      { expected: { max: 16, min: 4 }, max: 20, min: 2 },
      { expected: { max: 6, min: 4 }, max: 5, min: 4 },
      { expected: { max: 16, min: 14 }, max: 16, min: 15 },
    ])(
      'clamps ($min, $max) into range with the gap',
      ({ expected, max, min }) => {
        expect(clampFrostProtection(min, max)).toStrictEqual(expected)
      },
    )
  })

  describe(clampOverheatProtection, () => {
    it.each([
      { expected: { max: 37, min: 35 }, max: 37, min: 35 },
      { expected: { max: 40, min: 31 }, max: 45, min: 20 },
      { expected: { max: 33, min: 31 }, max: 31, min: 31 },
      { expected: { max: 40, min: 38 }, max: 40, min: 39 },
    ])(
      'clamps ($min, $max) into range with the gap',
      ({ expected, max, min }) => {
        expect(clampOverheatProtection(min, max)).toStrictEqual(expected)
      },
    )
  })
})
