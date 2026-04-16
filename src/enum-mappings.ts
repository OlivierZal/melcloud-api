import {
  ClassicDeviceType,
  ClassicFanSpeed,
  ClassicHorizontal,
  ClassicOperationMode,
  ClassicVertical,
  HomeDeviceType,
} from './constants.ts'

/*
 * Bidirectional mapping tables between classic API numeric enums
 * and Home API string values.
 *
 * Classic → Home: used by ClassicAtaAdapter to normalize output.
 * Home → Classic: used by ClassicAtaAdapter to convert normalized input
 * back to the classic API format.
 */

export type HomeFanSpeed = 'Auto' | 'Five' | 'Four' | 'One' | 'Three' | 'Two'

export type HomeHorizontal =
  | 'Auto'
  | 'Centre'
  | 'Left'
  | 'LeftCentre'
  | 'Right'
  | 'RightCentre'
  | 'Swing'
  | 'Wide'

export type HomeOperationMode = 'Automatic' | 'Cool' | 'Dry' | 'Fan' | 'Heat'

export type HomeVertical =
  | 'Auto'
  | 'Five'
  | 'Four'
  | 'One'
  | 'Swing'
  | 'Three'
  | 'Two'

export const fanSpeedFromClassic: Record<ClassicFanSpeed, HomeFanSpeed> = {
  [ClassicFanSpeed.auto]: 'Auto',
  [ClassicFanSpeed.fast]: 'Four',
  [ClassicFanSpeed.moderate]: 'Three',
  [ClassicFanSpeed.silent]: 'Auto',
  [ClassicFanSpeed.slow]: 'Two',
  [ClassicFanSpeed.very_fast]: 'Five',
  [ClassicFanSpeed.very_slow]: 'One',
}

export const fanSpeedToClassic: Record<HomeFanSpeed, ClassicFanSpeed> = {
  Auto: ClassicFanSpeed.auto,
  Five: ClassicFanSpeed.very_fast,
  Four: ClassicFanSpeed.fast,
  One: ClassicFanSpeed.very_slow,
  Three: ClassicFanSpeed.moderate,
  Two: ClassicFanSpeed.slow,
}

export const isClassicFanSpeed = (value: number): value is ClassicFanSpeed =>
  value in fanSpeedFromClassic

export const isHomeFanSpeed = (value: string): value is HomeFanSpeed =>
  value in fanSpeedToClassic

export const horizontalFromClassic: Record<ClassicHorizontal, HomeHorizontal> =
  {
    [ClassicHorizontal.auto]: 'Auto',
    [ClassicHorizontal.center]: 'Centre',
    [ClassicHorizontal.center_left]: 'LeftCentre',
    [ClassicHorizontal.center_right]: 'RightCentre',
    [ClassicHorizontal.leftwards]: 'Left',
    [ClassicHorizontal.rightwards]: 'Right',
    [ClassicHorizontal.swing]: 'Swing',
    [ClassicHorizontal.wide]: 'Wide',
  }

export const horizontalToClassic: Record<HomeHorizontal, ClassicHorizontal> = {
  Auto: ClassicHorizontal.auto,
  Centre: ClassicHorizontal.center,
  Left: ClassicHorizontal.leftwards,
  LeftCentre: ClassicHorizontal.center_left,
  Right: ClassicHorizontal.rightwards,
  RightCentre: ClassicHorizontal.center_right,
  Swing: ClassicHorizontal.swing,
  Wide: ClassicHorizontal.wide,
}

export const operationModeFromClassic: Record<
  ClassicOperationMode,
  HomeOperationMode
> = {
  [ClassicOperationMode.auto]: 'Automatic',
  [ClassicOperationMode.cool]: 'Cool',
  [ClassicOperationMode.dry]: 'Dry',
  [ClassicOperationMode.fan]: 'Fan',
  [ClassicOperationMode.heat]: 'Heat',
}

export const operationModeToClassic: Record<
  HomeOperationMode,
  ClassicOperationMode
> = {
  Automatic: ClassicOperationMode.auto,
  Cool: ClassicOperationMode.cool,
  Dry: ClassicOperationMode.dry,
  Fan: ClassicOperationMode.fan,
  Heat: ClassicOperationMode.heat,
}

export const verticalFromClassic: Record<ClassicVertical, HomeVertical> = {
  [ClassicVertical.auto]: 'Auto',
  [ClassicVertical.downwards]: 'Five',
  [ClassicVertical.mid_high]: 'Two',
  [ClassicVertical.mid_low]: 'Four',
  [ClassicVertical.middle]: 'Three',
  [ClassicVertical.swing]: 'Swing',
  [ClassicVertical.upwards]: 'One',
}

export const verticalToClassic: Record<HomeVertical, ClassicVertical> = {
  Auto: ClassicVertical.auto,
  Five: ClassicVertical.downwards,
  Four: ClassicVertical.mid_low,
  One: ClassicVertical.upwards,
  Swing: ClassicVertical.swing,
  Three: ClassicVertical.middle,
  Two: ClassicVertical.mid_high,
}

export const homeDeviceTypeFromClassic: Record<
  typeof ClassicDeviceType.Ata | typeof ClassicDeviceType.Atw,
  HomeDeviceType
> = {
  [ClassicDeviceType.Ata]: HomeDeviceType.Ata,
  [ClassicDeviceType.Atw]: HomeDeviceType.Atw,
}

export const homeDeviceTypeToClassic: Record<
  HomeDeviceType,
  typeof ClassicDeviceType.Ata | typeof ClassicDeviceType.Atw
> = {
  [HomeDeviceType.Ata]: ClassicDeviceType.Ata,
  [HomeDeviceType.Atw]: ClassicDeviceType.Atw,
}
