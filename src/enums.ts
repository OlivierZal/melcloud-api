export enum AtwFlag {
  ForcedHotWaterMode = 0x1_00_00,
  OperationModeZone1 = 0x8,
  OperationModeZone2 = 0x10,
  Power = 0x1,
  SetFlowTemperature = 0x1_00_00_00_00_00_00,
  SetTankWaterTemperature = 0x1_00_00_00_00_00_20,
  SetTemperatureZone1 = 0x2_00_00_00_80,
  SetTemperatureZone2 = 0x8_00_00_02_00,
}

export enum DeviceType {
  Ata = 0,
  Atw = 1,
  Erv = 3,
}

export enum FanSpeed {
  auto = 0,
  very_slow = 1,
  slow = 2,
  moderate = 3,
  fast = 4,
  very_fast = 5,
  silent = 255,
}

export enum Horizontal {
  auto = 0,
  leftwards = 1,
  center_left = 2,
  center = 3,
  center_right = 4,
  rightwards = 5,
  wide = 8,
  swing = 12,
}

export enum LabelType {
  time = 0,
  raw = 1,
  month = 2,
  month_of_year = 3,
  day_of_week = 4,
}

export enum Language {
  en = 0,
  bg = 1,
  cs = 2,
  da = 3,
  de = 4,
  et = 5,
  es = 6,
  fr = 7,
  hy = 8,
  lv = 9,
  lt = 10,
  hu = 11,
  nl = 12,
  no = 13,
  pl = 14,
  pt = 15,
  ru = 16,
  fi = 17,
  sv = 18,
  it = 19,
  uk = 20,
  tr = 21,
  // eslint-disable-next-line unicorn/prevent-abbreviations
  el = 22,
  hr = 23,
  ro = 24,
  sl = 25,
  sq = 26,
}

export enum OperationMode {
  heat = 1,
  dry = 2,
  cool = 3,
  fan = 7,
  auto = 8,
}

export enum OperationModeState {
  idle = 0,
  dhw = 1,
  heating = 2,
  cooling = 3,
  defrost = 5,
  legionella = 6,
}

export enum OperationModeZone {
  room = 0,
  flow = 1,
  curve = 2,
  room_cool = 3,
  flow_cool = 4,
}

export enum VentilationMode {
  recovery = 0,
  bypass = 1,
  auto = 2,
}

export enum Vertical {
  auto = 0,
  upwards = 1,
  mid_high = 2,
  middle = 3,
  mid_low = 4,
  downwards = 5,
  swing = 7,
}
