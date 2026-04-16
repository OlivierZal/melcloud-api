import { describe, expect, it } from 'vitest'

import {
  ClassicFanSpeed,
  ClassicHorizontal,
  ClassicOperationMode,
  ClassicVertical,
} from '../../src/constants.ts'
import {
  fanSpeedFromClassic,
  fanSpeedToClassic,
  horizontalFromClassic,
  horizontalToClassic,
  isClassicFanSpeed,
  isHomeFanSpeed,
  operationModeFromClassic,
  operationModeToClassic,
  verticalFromClassic,
  verticalToClassic,
} from '../../src/enum-mappings.ts'

describe.concurrent('enum mappings between Classic and Home APIs', () => {
  describe('operation mode', () => {
    it.each([
      [ClassicOperationMode.heat, 'Heat'],
      [ClassicOperationMode.dry, 'Dry'],
      [ClassicOperationMode.cool, 'Cool'],
      [ClassicOperationMode.fan, 'Fan'],
      [ClassicOperationMode.auto, 'Automatic'],
    ] as const)('maps Classic %i → Home %s', (classic, home) => {
      expect(operationModeFromClassic[classic]).toBe(home)
      expect(operationModeToClassic[home]).toBe(classic)
    })

    it('is bidirectional for all home values', () => {
      for (const [home, classic] of Object.entries(operationModeToClassic)) {
        expect(operationModeFromClassic[classic]).toBe(home)
      }
    })
  })

  describe('fan speed', () => {
    it.each([
      [ClassicFanSpeed.auto, 'Auto'],
      [ClassicFanSpeed.very_slow, 'One'],
      [ClassicFanSpeed.slow, 'Two'],
      [ClassicFanSpeed.moderate, 'Three'],
      [ClassicFanSpeed.fast, 'Four'],
      [ClassicFanSpeed.very_fast, 'Five'],
    ] as const)('maps Classic %i → Home %s', (classic, home) => {
      expect(fanSpeedFromClassic[classic]).toBe(home)
    })

    it('maps silent to Auto (no home equivalent)', () => {
      expect(fanSpeedFromClassic[ClassicFanSpeed.silent]).toBe('Auto')
    })

    it('maps home strings back to classic values', () => {
      for (const [home, classic] of Object.entries(fanSpeedToClassic)) {
        expect(fanSpeedFromClassic[classic]).toBe(home)
      }
    })

    it.each([
      [ClassicFanSpeed.auto, true],
      [ClassicFanSpeed.very_slow, true],
      [ClassicFanSpeed.very_fast, true],
      [999, false],
      [-1, false],
    ] as const)('isClassicFanSpeed(%i) → %s', (value, isValid) => {
      expect(isClassicFanSpeed(value)).toBe(isValid)
    })

    it.each([
      ['Auto', true],
      ['One', true],
      ['Five', true],
      ['Invalid', false],
      ['', false],
    ] as const)('isHomeFanSpeed(%s) → %s', (value, isValid) => {
      expect(isHomeFanSpeed(value)).toBe(isValid)
    })
  })

  describe('horizontal vane', () => {
    it.each([
      [ClassicHorizontal.auto, 'Auto'],
      [ClassicHorizontal.leftwards, 'Left'],
      [ClassicHorizontal.center_left, 'LeftCentre'],
      [ClassicHorizontal.center, 'Centre'],
      [ClassicHorizontal.center_right, 'RightCentre'],
      [ClassicHorizontal.rightwards, 'Right'],
      [ClassicHorizontal.swing, 'Swing'],
      [ClassicHorizontal.wide, 'Wide'],
    ] as const)('maps Classic %i → Home %s', (classic, home) => {
      expect(horizontalFromClassic[classic]).toBe(home)
    })

    it('is bidirectional for all mappable values', () => {
      for (const [home, classic] of Object.entries(horizontalToClassic)) {
        expect(horizontalFromClassic[classic]).toBe(home)
      }
    })
  })

  describe('vertical vane', () => {
    it.each([
      [ClassicVertical.auto, 'Auto'],
      [ClassicVertical.upwards, 'One'],
      [ClassicVertical.mid_high, 'Two'],
      [ClassicVertical.middle, 'Three'],
      [ClassicVertical.mid_low, 'Four'],
      [ClassicVertical.downwards, 'Five'],
      [ClassicVertical.swing, 'Swing'],
    ] as const)('maps Classic %i → Home %s', (classic, home) => {
      expect(verticalFromClassic[classic]).toBe(home)
    })

    it('is bidirectional for all values', () => {
      for (const [home, classic] of Object.entries(verticalToClassic)) {
        expect(verticalFromClassic[classic]).toBe(home)
      }
    })
  })
})
