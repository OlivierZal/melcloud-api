import {
  ClassicDeviceType,
  ClassicFanSpeed,
  ClassicHorizontal,
  ClassicOperationMode,
  ClassicVertical,
  HomeDeviceType,
} from './constants.ts'
import { isKeyOf } from './utils.ts'

// Bidirectional mapping tables between classic API numeric enums
// and Home API string values.
//
// Classic → Home: used by ClassicAtaAdapter to normalize output.
// Home → Classic: used by ClassicAtaAdapter to convert normalized input
// back to the classic API format.

/**
 * Home API fan speed string values.
 * @category Mappings
 */
export type HomeFanSpeed = 'Auto' | 'Five' | 'Four' | 'One' | 'Three' | 'Two'

/**
 * Home API horizontal vane position string values.
 * @category Mappings
 */
export type HomeHorizontal =
  | 'Auto'
  | 'Centre'
  | 'Left'
  | 'LeftCentre'
  | 'Right'
  | 'RightCentre'
  | 'Swing'
  | 'Wide'

/**
 * Home API operation mode string values.
 * @category Mappings
 */
export type HomeOperationMode = 'Automatic' | 'Cool' | 'Dry' | 'Fan' | 'Heat'

/**
 * Home API vertical vane position string values.
 * @category Mappings
 */
export type HomeVertical =
  | 'Auto'
  | 'Five'
  | 'Four'
  | 'One'
  | 'Swing'
  | 'Three'
  | 'Two'

/**
 * Mapping from Classic numeric fan speed to Home string value.
 * @category Mappings
 */
export const fanSpeedFromClassic: Record<ClassicFanSpeed, HomeFanSpeed> = {
  [ClassicFanSpeed.auto]: 'Auto',
  [ClassicFanSpeed.fast]: 'Four',
  [ClassicFanSpeed.moderate]: 'Three',
  [ClassicFanSpeed.silent]: 'Auto',
  [ClassicFanSpeed.slow]: 'Two',
  [ClassicFanSpeed.very_fast]: 'Five',
  [ClassicFanSpeed.very_slow]: 'One',
}

/**
 * Mapping from Home string fan speed to Classic numeric value.
 * @category Mappings
 */
export const fanSpeedToClassic: Record<HomeFanSpeed, ClassicFanSpeed> = {
  Auto: ClassicFanSpeed.auto,
  Five: ClassicFanSpeed.very_fast,
  Four: ClassicFanSpeed.fast,
  One: ClassicFanSpeed.very_slow,
  Three: ClassicFanSpeed.moderate,
  Two: ClassicFanSpeed.slow,
}

/** Type guard: `value` is a valid Classic fan speed numeric value. */
export const isClassicFanSpeed: (key: PropertyKey) => key is ClassicFanSpeed =
  isKeyOf(fanSpeedFromClassic)

/** Type guard: `value` is a valid Home fan speed string. */
export const isHomeFanSpeed: (key: PropertyKey) => key is HomeFanSpeed =
  isKeyOf(fanSpeedToClassic)

/**
 * Mapping from Classic numeric horizontal vane position to Home string value.
 * @category Mappings
 */
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

/**
 * Mapping from Home string horizontal vane position to Classic numeric value.
 * @category Mappings
 */
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

/**
 * Mapping from Classic numeric operation mode to Home string value.
 * @category Mappings
 */
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

/**
 * Mapping from Home string operation mode to Classic numeric value.
 * @category Mappings
 */
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

/**
 * Mapping from Classic numeric vertical vane position to Home string value.
 * @category Mappings
 */
export const verticalFromClassic: Record<ClassicVertical, HomeVertical> = {
  [ClassicVertical.auto]: 'Auto',
  [ClassicVertical.downwards]: 'Five',
  [ClassicVertical.mid_high]: 'Two',
  [ClassicVertical.mid_low]: 'Four',
  [ClassicVertical.middle]: 'Three',
  [ClassicVertical.swing]: 'Swing',
  [ClassicVertical.upwards]: 'One',
}

/**
 * Mapping from Home string vertical vane position to Classic numeric value.
 * @category Mappings
 */
export const verticalToClassic: Record<HomeVertical, ClassicVertical> = {
  Auto: ClassicVertical.auto,
  Five: ClassicVertical.downwards,
  Four: ClassicVertical.mid_low,
  One: ClassicVertical.upwards,
  Swing: ClassicVertical.swing,
  Three: ClassicVertical.middle,
  Two: ClassicVertical.mid_high,
}

/**
 * Mapping from Classic numeric device type to Home string value (ATA/ATW only — ERV is Classic-only).
 * @category Mappings
 */
export const homeDeviceTypeFromClassic: Record<
  typeof ClassicDeviceType.Ata | typeof ClassicDeviceType.Atw,
  HomeDeviceType
> = {
  [ClassicDeviceType.Ata]: HomeDeviceType.Ata,
  [ClassicDeviceType.Atw]: HomeDeviceType.Atw,
}

/**
 * Mapping from Home string device type to Classic numeric value.
 * @category Mappings
 */
export const homeDeviceTypeToClassic: Record<
  HomeDeviceType,
  typeof ClassicDeviceType.Ata | typeof ClassicDeviceType.Atw
> = {
  [HomeDeviceType.Ata]: ClassicDeviceType.Ata,
  [HomeDeviceType.Atw]: ClassicDeviceType.Atw,
}
