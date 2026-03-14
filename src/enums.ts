// eslint-disable-next-line import-x/export
export const DeviceType = {
  Ata: 0,
  Atw: 1,
  Erv: 3,
} as const
export type DeviceType = (typeof DeviceType)[keyof typeof DeviceType]

// eslint-disable-next-line import-x/export
export declare namespace DeviceType {
  type Ata = (typeof DeviceType)['Ata']

  type Atw = (typeof DeviceType)['Atw']

  type Erv = (typeof DeviceType)['Erv']
}

export const FanSpeed = {
  auto: 0,
  fast: 4,
  moderate: 3,
  silent: 255,
  slow: 2,
  very_fast: 5,
  very_slow: 1,
} as const
export type FanSpeed = (typeof FanSpeed)[keyof typeof FanSpeed]

export const Horizontal = {
  auto: 0,
  center: 3,
  center_left: 2,
  center_right: 4,
  leftwards: 1,
  rightwards: 5,
  swing: 12,
  wide: 8,
} as const
export type Horizontal = (typeof Horizontal)[keyof typeof Horizontal]

export const LabelType = {
  day_of_week: 4,
  month: 2,
  month_of_year: 3,
  raw: 1,
  time: 0,
} as const
export type LabelType = (typeof LabelType)[keyof typeof LabelType]

export const Language = {
  bg: 1,
  cs: 2,
  da: 3,
  de: 4,
  el: 22,
  en: 0,
  es: 6,
  et: 5,
  fi: 17,
  fr: 7,
  hr: 23,
  hu: 11,
  hy: 8,
  it: 19,
  lt: 10,
  lv: 9,
  nl: 12,
  no: 13,
  pl: 14,
  pt: 15,
  ro: 24,
  ru: 16,
  sl: 25,
  sq: 26,
  sv: 18,
  tr: 21,
  uk: 20,
} as const
export type Language = (typeof Language)[keyof typeof Language]

export const OperationMode = {
  auto: 8,
  cool: 3,
  dry: 2,
  fan: 7,
  heat: 1,
} as const
export type OperationMode = (typeof OperationMode)[keyof typeof OperationMode]

export const OperationModeState = {
  cooling: 3,
  defrost: 5,
  dhw: 1,
  heating: 2,
  idle: 0,
  legionella: 6,
} as const
export type OperationModeState =
  (typeof OperationModeState)[keyof typeof OperationModeState]

export const OperationModeZone = {
  curve: 2,
  flow: 1,
  flow_cool: 4,
  room: 0,
  room_cool: 3,
} as const
export type OperationModeZone =
  (typeof OperationModeZone)[keyof typeof OperationModeZone]

export const VentilationMode = {
  auto: 2,
  bypass: 1,
  recovery: 0,
} as const
export type VentilationMode =
  (typeof VentilationMode)[keyof typeof VentilationMode]

export const Vertical = {
  auto: 0,
  downwards: 5,
  mid_high: 2,
  mid_low: 4,
  middle: 3,
  swing: 7,
  upwards: 1,
} as const
export type Vertical = (typeof Vertical)[keyof typeof Vertical]
