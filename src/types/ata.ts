import type {
  BaseGetDeviceData,
  BaseListDevice,
  BaseListDeviceData,
  BaseSetDeviceData,
  BaseSetKeys,
  BaseUpdateDeviceData,
  DeviceDataNotInList,
  DeviceType,
  FanSpeed,
} from './bases'

export enum OperationMode {
  heat = 1,
  dry = 2,
  cool = 3,
  fan = 7,
  auto = 8,
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

export interface SetKeysAta extends BaseSetKeys {
  readonly fan?: Exclude<FanSpeed, FanSpeed.silent>
  readonly horizontal?: Horizontal
  readonly mode?: OperationMode
  readonly temperature?: number
  readonly vertical?: Vertical
}

export const flagsAta: Record<keyof SetKeysAta, number> = {
  fan: 0x8,
  horizontal: 0x100,
  mode: 0x2,
  power: 0x1,
  temperature: 0x4,
  vertical: 0x10,
} as const

export interface UpdateDeviceDataAta extends BaseUpdateDeviceData {
  readonly OperationMode?: OperationMode
  readonly SetFanSpeed?: Exclude<FanSpeed, FanSpeed.silent>
  readonly SetTemperature?: number
  readonly VaneHorizontal?: Horizontal
  readonly VaneVertical?: Vertical
}

export interface SetDeviceDataAta
  extends BaseSetDeviceData,
    Required<Readonly<UpdateDeviceDataAta>> {
  readonly DeviceType: DeviceType.Ata
  readonly NumberOfFanSpeeds: number
  readonly RoomTemperature: number
}

export type GetDeviceDataAta = BaseGetDeviceData & SetDeviceDataAta

export interface ListDeviceDataAta
  extends BaseListDeviceData,
    Omit<
      GetDeviceDataAta,
      | keyof DeviceDataNotInList
      | 'SetFanSpeed'
      | 'VaneHorizontal'
      | 'VaneVertical'
    > {
  readonly ActualFanSpeed: number
  readonly FanSpeed: FanSpeed
  readonly HasAutomaticFanSpeed: boolean
  readonly MaxTempAutomatic: number
  readonly MaxTempCoolDry: number
  readonly MaxTempHeat: number
  readonly MinTempAutomatic: number
  readonly MinTempCoolDry: number
  readonly MinTempHeat: number
  readonly OutdoorTemperature: number
  readonly VaneHorizontalDirection: Horizontal
  readonly VaneVerticalDirection: Vertical
}
export interface ListDeviceAta extends BaseListDevice {
  readonly Device: ListDeviceDataAta
}

export interface EnergyDataAta {
  readonly Auto: readonly number[]
  readonly Cooling: readonly number[]
  readonly Dry: readonly number[]
  readonly Fan: readonly number[]
  readonly Heating: readonly number[]
  readonly Other: readonly number[]
  readonly TotalAutoConsumed: number
  readonly TotalCoolingConsumed: number
  readonly TotalDryConsumed: number
  readonly TotalFanConsumed: number
  readonly TotalHeatingConsumed: number
  readonly TotalOtherConsumed: number
  readonly UsageDisclaimerPercentages: string
}
