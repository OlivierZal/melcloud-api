import { FanSpeed, Horizontal, OperationMode, Vertical } from '../constants.ts'

/*
 * Bidirectional mapping tables between classic API numeric enums
 * and Home API string values.
 *
 * Classic → Home: used by ClassicAtaAdapter to normalize output.
 * Home → Classic: used by ClassicAtaAdapter to convert normalized input
 * back to the classic API format.
 */

export const fanSpeedFromClassic: Record<FanSpeed, string> = {
  [FanSpeed.auto]: 'Auto',
  [FanSpeed.fast]: 'Four',
  [FanSpeed.moderate]: 'Three',
  [FanSpeed.silent]: 'Auto',
  [FanSpeed.slow]: 'Two',
  [FanSpeed.very_fast]: 'Five',
  [FanSpeed.very_slow]: 'One',
}

export const fanSpeedToClassic: Record<string, FanSpeed> = {
  Auto: FanSpeed.auto,
  Five: FanSpeed.very_fast,
  Four: FanSpeed.fast,
  One: FanSpeed.very_slow,
  Three: FanSpeed.moderate,
  Two: FanSpeed.slow,
}

export const horizontalFromClassic: Record<Horizontal, string> = {
  [Horizontal.auto]: 'Auto',
  [Horizontal.center]: 'Centre',
  [Horizontal.center_left]: 'LeftCentre',
  [Horizontal.center_right]: 'RightCentre',
  [Horizontal.leftwards]: 'Left',
  [Horizontal.rightwards]: 'Right',
  [Horizontal.swing]: 'Swing',
  [Horizontal.wide]: 'Wide',
}

export const horizontalToClassic: Record<string, Horizontal> = {
  Auto: Horizontal.auto,
  Centre: Horizontal.center,
  Left: Horizontal.leftwards,
  LeftCentre: Horizontal.center_left,
  Right: Horizontal.rightwards,
  RightCentre: Horizontal.center_right,
  Swing: Horizontal.swing,
  Wide: Horizontal.wide,
}

export const operationModeFromClassic: Record<OperationMode, string> = {
  [OperationMode.auto]: 'Automatic',
  [OperationMode.cool]: 'Cool',
  [OperationMode.dry]: 'Dry',
  [OperationMode.fan]: 'Fan',
  [OperationMode.heat]: 'Heat',
}

export const operationModeToClassic: Record<string, OperationMode> = {
  Automatic: OperationMode.auto,
  Cool: OperationMode.cool,
  Dry: OperationMode.dry,
  Fan: OperationMode.fan,
  Heat: OperationMode.heat,
}

export const verticalFromClassic: Record<Vertical, string> = {
  [Vertical.auto]: 'Auto',
  [Vertical.downwards]: 'Five',
  [Vertical.mid_high]: 'Two',
  [Vertical.mid_low]: 'Four',
  [Vertical.middle]: 'Three',
  [Vertical.swing]: 'Swing',
  [Vertical.upwards]: 'One',
}

export const verticalToClassic: Record<string, Vertical> = {
  Auto: Vertical.auto,
  Five: Vertical.downwards,
  Four: Vertical.mid_low,
  One: Vertical.upwards,
  Swing: Vertical.swing,
  Three: Vertical.middle,
  Two: Vertical.mid_high,
}
