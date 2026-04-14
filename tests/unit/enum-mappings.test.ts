import { describe, expect, it } from 'vitest'

import {
  FanSpeed,
  Horizontal,
  OperationMode,
  Vertical,
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
      [OperationMode.heat, 'Heat'],
      [OperationMode.dry, 'Dry'],
      [OperationMode.cool, 'Cool'],
      [OperationMode.fan, 'Fan'],
      [OperationMode.auto, 'Automatic'],
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
      [FanSpeed.auto, 'Auto'],
      [FanSpeed.very_slow, 'One'],
      [FanSpeed.slow, 'Two'],
      [FanSpeed.moderate, 'Three'],
      [FanSpeed.fast, 'Four'],
      [FanSpeed.very_fast, 'Five'],
    ] as const)('maps Classic %i → Home %s', (classic, home) => {
      expect(fanSpeedFromClassic[classic]).toBe(home)
    })

    it('maps silent to Auto (no home equivalent)', () => {
      expect(fanSpeedFromClassic[FanSpeed.silent]).toBe('Auto')
    })

    it('maps home strings back to classic values', () => {
      for (const [home, classic] of Object.entries(fanSpeedToClassic)) {
        expect(fanSpeedFromClassic[classic]).toBe(home)
      }
    })

    it.each([
      [FanSpeed.auto, true],
      [FanSpeed.very_slow, true],
      [FanSpeed.very_fast, true],
      [999, false],
      [-1, false],
    ] as const)('isClassicFanSpeed(%i) → %s', (value, expected) => {
      expect(isClassicFanSpeed(value)).toBe(expected)
    })

    it.each([
      ['Auto', true],
      ['One', true],
      ['Five', true],
      ['Invalid', false],
      ['', false],
    ] as const)('isHomeFanSpeed(%s) → %s', (value, expected) => {
      expect(isHomeFanSpeed(value)).toBe(expected)
    })
  })

  describe('horizontal vane', () => {
    it.each([
      [Horizontal.auto, 'Auto'],
      [Horizontal.leftwards, 'Left'],
      [Horizontal.center_left, 'LeftCentre'],
      [Horizontal.center, 'Centre'],
      [Horizontal.center_right, 'RightCentre'],
      [Horizontal.rightwards, 'Right'],
      [Horizontal.swing, 'Swing'],
      [Horizontal.wide, 'Wide'],
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
      [Vertical.auto, 'Auto'],
      [Vertical.upwards, 'One'],
      [Vertical.mid_high, 'Two'],
      [Vertical.middle, 'Three'],
      [Vertical.mid_low, 'Four'],
      [Vertical.downwards, 'Five'],
      [Vertical.swing, 'Swing'],
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
