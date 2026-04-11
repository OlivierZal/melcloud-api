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
  operationModeFromClassic,
  operationModeToClassic,
  verticalFromClassic,
  verticalToClassic,
} from '../../src/enum-mappings.ts'

describe('enum mappings between Classic and Home APIs', () => {
  describe('operation mode', () => {
    it('should map all classic values to home strings', () => {
      expect(operationModeFromClassic[OperationMode.heat]).toBe('Heat')
      expect(operationModeFromClassic[OperationMode.dry]).toBe('Dry')
      expect(operationModeFromClassic[OperationMode.cool]).toBe('Cool')
      expect(operationModeFromClassic[OperationMode.fan]).toBe('Fan')
      expect(operationModeFromClassic[OperationMode.auto]).toBe('Automatic')
    })

    it('should map all home strings back to classic values', () => {
      expect(operationModeToClassic.Heat).toBe(OperationMode.heat)
      expect(operationModeToClassic.Dry).toBe(OperationMode.dry)
      expect(operationModeToClassic.Cool).toBe(OperationMode.cool)
      expect(operationModeToClassic.Fan).toBe(OperationMode.fan)
      expect(operationModeToClassic.Automatic).toBe(OperationMode.auto)
    })

    it('should be bidirectional for all values', () => {
      for (const [home, classic] of Object.entries(operationModeToClassic)) {
        expect(operationModeFromClassic[classic]).toBe(home)
      }
    })
  })

  describe('fan speed', () => {
    it('should map classic values to home strings', () => {
      expect(fanSpeedFromClassic[FanSpeed.auto]).toBe('Auto')
      expect(fanSpeedFromClassic[FanSpeed.very_slow]).toBe('One')
      expect(fanSpeedFromClassic[FanSpeed.slow]).toBe('Two')
      expect(fanSpeedFromClassic[FanSpeed.moderate]).toBe('Three')
      expect(fanSpeedFromClassic[FanSpeed.fast]).toBe('Four')
      expect(fanSpeedFromClassic[FanSpeed.very_fast]).toBe('Five')
    })

    it('should map silent to Auto (no home equivalent)', () => {
      expect(fanSpeedFromClassic[FanSpeed.silent]).toBe('Auto')
    })

    it('should map home strings back to classic values', () => {
      for (const [home, classic] of Object.entries(fanSpeedToClassic)) {
        expect(fanSpeedFromClassic[classic]).toBe(home)
      }
    })
  })

  describe('horizontal vane', () => {
    it('should map all classic values to home strings', () => {
      expect(horizontalFromClassic[Horizontal.auto]).toBe('Auto')
      expect(horizontalFromClassic[Horizontal.leftwards]).toBe('Left')
      expect(horizontalFromClassic[Horizontal.center_left]).toBe('LeftCentre')
      expect(horizontalFromClassic[Horizontal.center]).toBe('Centre')
      expect(horizontalFromClassic[Horizontal.center_right]).toBe('RightCentre')
      expect(horizontalFromClassic[Horizontal.rightwards]).toBe('Right')
      expect(horizontalFromClassic[Horizontal.swing]).toBe('Swing')
      expect(horizontalFromClassic[Horizontal.wide]).toBe('Wide')
    })

    it('should be bidirectional for all mappable values', () => {
      for (const [home, classic] of Object.entries(horizontalToClassic)) {
        expect(horizontalFromClassic[classic]).toBe(home)
      }
    })
  })

  describe('vertical vane', () => {
    it('should map all classic values to home strings', () => {
      expect(verticalFromClassic[Vertical.auto]).toBe('Auto')
      expect(verticalFromClassic[Vertical.upwards]).toBe('One')
      expect(verticalFromClassic[Vertical.mid_high]).toBe('Two')
      expect(verticalFromClassic[Vertical.middle]).toBe('Three')
      expect(verticalFromClassic[Vertical.mid_low]).toBe('Four')
      expect(verticalFromClassic[Vertical.downwards]).toBe('Five')
      expect(verticalFromClassic[Vertical.swing]).toBe('Swing')
    })

    it('should be bidirectional for all values', () => {
      for (const [home, classic] of Object.entries(verticalToClassic)) {
        expect(verticalFromClassic[classic]).toBe(home)
      }
    })
  })
})
