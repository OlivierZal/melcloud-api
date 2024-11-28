export enum DeviceType {
  Ata = 0,
  Atw = 1,
  Erv = 3,
}

export enum FanSpeed {
  auto = 0,
  fast = 4,
  moderate = 3,
  silent = 255,
  slow = 2,
  very_fast = 5,
  very_slow = 1,
}

export enum Horizontal {
  auto = 0,
  center = 3,
  center_left = 2,
  center_right = 4,
  leftwards = 1,
  rightwards = 5,
  swing = 12,
  wide = 8,
}

export enum LabelType {
  day = 1,
  day_of_week = 4,
  hour = 0,
  month = 2,
  month_of_year = 3,
}

export enum Language {
  bg = 1,
  cs = 2,
  da = 3,
  de = 4,
  el = 22,
  en = 0,
  es = 6,
  et = 5,
  fi = 17,
  fr = 7,
  hr = 23,
  hu = 11,
  hy = 8,
  it = 19,
  lt = 10,
  lv = 9,
  nl = 12,
  no = 13,
  pl = 14,
  pt = 15,
  ro = 24,
  ru = 16,
  sl = 25,
  sq = 26,
  sv = 18,
  tr = 21,
  uk = 20,
}

export enum OperationMode {
  auto = 8,
  cool = 3,
  dry = 2,
  fan = 7,
  heat = 1,
}

export enum OperationModeState {
  cooling = 3,
  defrost = 5,
  dhw = 1,
  heating = 2,
  idle = 0,
  legionella = 6,
}

export enum OperationModeZone {
  curve = 2,
  flow = 1,
  flow_cool = 4,
  room = 0,
  room_cool = 3,
}

export enum VentilationMode {
  auto = 2,
  bypass = 1,
  recovery = 0,
}

export enum Vertical {
  auto = 0,
  downwards = 5,
  mid_high = 2,
  mid_low = 4,
  middle = 3,
  swing = 7,
  upwards = 1,
}
