import type { BaseDevicePostData, DeviceType, FanSpeed } from './bases'
import {
  type EnergyDataAta,
  type GetDeviceDataAta,
  type Horizontal,
  type ListDeviceAta,
  type ListDeviceDataAta,
  type OperationMode,
  type SetDeviceDataAta,
  type SetKeysAta,
  type UpdateDeviceDataAta,
  type Vertical,
  flagsAta,
} from './ata'
import {
  type EnergyDataAtw,
  type GetDeviceDataAtw,
  type ListDeviceAtw,
  type ListDeviceDataAtw,
  type SetDeviceDataAtw,
  type SetKeysAtw,
  type UpdateDeviceDataAtw,
  flagsAtw,
} from './atw'
import {
  type GetDeviceDataErv,
  type ListDeviceDataErv,
  type ListDeviceErv,
  type SetDeviceDataErv,
  type SetKeysErv,
  type UpdateDeviceDataErv,
  flagsErv,
} from './erv'

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
  el = 22,
  hr = 23,
  ro = 24,
  sl = 25,
  sq = 26,
}

export const flags = {
  Ata: flagsAta,
  Atw: flagsAtw,
  Erv: flagsErv,
} as const

export interface SetKeys {
  Ata: SetKeysAta
  Atw: SetKeysAtw
  Erv: SetKeysErv
}

export interface LoginCredentials {
  readonly password: string
  readonly username: string
}
export interface LoginPostData {
  readonly Language?: number
  readonly Persist?: boolean
  readonly AppVersion: string
  readonly Email: string
  readonly Password: string
}
export interface LoginData {
  readonly LoginData: {
    readonly ContextKey: string
    readonly Expiry: string
  } | null
}

export type UpdatedDeviceData<T extends keyof typeof DeviceType> = Omit<
  UpdateDeviceData[T],
  'EffectiveFlags'
> &
  Partial<
    Pick<
      ListDevice['Ata']['Device'],
      'FanSpeed' | 'VaneHorizontalDirection' | 'VaneVerticalDirection'
    >
  >

export interface UpdateDeviceData {
  readonly Ata: UpdateDeviceDataAta
  readonly Atw: UpdateDeviceDataAtw
  readonly Erv: UpdateDeviceDataErv
}
export type SetDevicePostData<T extends keyof typeof DeviceType> =
  UpdateDeviceData[T] &
    Required<{ EffectiveFlags: number }> &
    BaseDevicePostData
export interface SetDeviceData {
  readonly Ata: SetDeviceDataAta
  readonly Atw: SetDeviceDataAtw
  readonly Erv: SetDeviceDataErv
}

export interface GetDeviceDataParams {
  readonly buildingId: number
  readonly id: number
}
export interface GetDeviceData {
  readonly Ata: GetDeviceDataAta
  readonly Atw: GetDeviceDataAtw
  readonly Erv: GetDeviceDataErv
}

export interface SuccessData {
  readonly AttributeErrors: null
  readonly Success: true
}
export interface FailureData {
  readonly AttributeErrors: Record<string, readonly string[]>
  readonly Success: false
}

export interface SettingsParams {
  readonly id: number
  readonly tableName: 'Area' | 'Building' | 'DeviceLocation' | 'Floor'
}

export interface FrostProtectionLocation {
  readonly AreaIds?: readonly number[]
  readonly BuildingIds?: readonly number[]
  readonly DeviceIds?: readonly number[]
  readonly FloorIds?: readonly number[]
}
export interface FrostProtectionPostData extends FrostProtectionLocation {
  readonly Enabled: boolean
  readonly MaximumTemperature: number
  readonly MinimumTemperature: number
}
export interface FrostProtectionData {
  readonly FPDefined: boolean
  readonly FPEnabled: boolean
  readonly FPMaxTemperature: number
  readonly FPMinTemperature: number
}

export interface DateTimeComponents {
  readonly Day: number
  readonly Hour: number
  readonly Minute: number
  readonly Month: number
  readonly Second: number
  readonly Year: number
}
export interface HolidayModeLocation {
  readonly Areas?: readonly number[]
  readonly Buildings?: readonly number[]
  readonly Devices?: readonly number[]
  readonly Floors?: readonly number[]
}
export interface HMTimeZone extends HolidayModeLocation {
  readonly TimeZone?: number
}
export interface HolidayModePostData {
  readonly Enabled: boolean
  readonly EndDate: DateTimeComponents | null
  readonly HMTimeZones: readonly HMTimeZone[]
  readonly StartDate: DateTimeComponents | null
}
export interface HolidayModeData {
  readonly EndDate: {
    readonly Day: number
    readonly Hour: number
    readonly Minute: number
    readonly Month: number
    readonly Second: number
    readonly Year: number
  }
  readonly HMDefined: boolean
  readonly HMEnabled: boolean
  readonly HMEndDate: string | null
  readonly HMStartDate: string | null
  readonly StartDate: {
    readonly Day: number
    readonly Hour: number
    readonly Minute: number
    readonly Month: number
    readonly Second: number
    readonly Year: number
  }
  readonly TimeZone: number
}

export interface BuildingSettings
  extends FrostProtectionData,
    Omit<HolidayModeData, 'EndDate' | 'StartDate'> {}
export interface BuildingData extends BuildingSettings {
  readonly ID: number
  readonly Name: string
}

export interface AreaData<T extends number | null> extends FloorData {
  readonly FloorId: T
}
export type AreaDataAny = AreaData<number> | AreaData<null>
export interface ListDeviceData {
  readonly Ata: ListDeviceDataAta
  readonly Atw: ListDeviceDataAtw
  readonly Erv: ListDeviceDataErv
}
export type ListDeviceDataAny =
  | ListDeviceDataAta
  | ListDeviceDataAtw
  | ListDeviceDataErv
export interface ListDevice {
  readonly Ata: ListDeviceAta
  readonly Atw: ListDeviceAtw
  readonly Erv: ListDeviceErv
}
export type ListDeviceAny = ListDeviceAta | ListDeviceAtw | ListDeviceErv
export interface FloorData {
  readonly BuildingId: number
  readonly ID: number
  readonly Name: string
}
export interface Building extends BuildingData {
  readonly Structure: {
    readonly Areas: readonly (AreaData<null> & {
      readonly Devices: readonly ListDeviceAny[]
    })[]
    readonly Devices: readonly ListDeviceAny[]
    readonly Floors: readonly (FloorData & {
      readonly Areas: readonly (AreaData<number> & {
        readonly Devices: readonly ListDeviceAny[]
      })[]
      readonly Devices: readonly ListDeviceAny[]
    })[]
  }
}

export interface SetPowerPostData {
  readonly DeviceIds: readonly number[]
  readonly Power: boolean
}

export interface SetAtaGroupPostData {
  readonly Specification: {
    readonly AreaID?: number | null
    readonly BuildingID?: number | null
    readonly FloorID?: number | null
  }
  readonly State: {
    readonly FanSpeed?: Exclude<FanSpeed, FanSpeed.silent> | null
    readonly OperationMode?: OperationMode | null
    readonly Power?: boolean | null
    readonly SetTemperature?: number | null
    readonly VaneHorizontalDirection?: Horizontal | null
    readonly VaneHorizontalSwing?: boolean | null
    readonly VaneVerticalDirection?: Vertical | null
    readonly VaneVerticalSwing?: boolean | null
  }
}

export type TilesPostData<T extends keyof typeof DeviceType | null> =
  (T extends keyof typeof DeviceType ?
    {
      readonly SelectedBuilding: number
      readonly SelectedDevice: number
    }
  : {
      readonly SelectedBuilding?: null
      readonly SelectedDevice?: null
    }) & {
    readonly DeviceIDs: readonly number[]
  }
export interface TilesData<T extends keyof typeof DeviceType | null> {
  readonly SelectedDevice: T extends keyof typeof DeviceType ? GetDeviceData[T]
  : null
  readonly Tiles: readonly {
    Device: number
    Offline: boolean
    Power: boolean
    RoomTemperature: number
    RoomTemperature2: number
    TankWaterTemperature: number
  }[]
}

export interface EnergyPostData extends BaseDevicePostData {
  readonly FromDate: string
  readonly ToDate: string
}
export interface EnergyData {
  readonly Ata: EnergyDataAta
  readonly Atw: EnergyDataAtw
  readonly Erv: never
}

export interface ErrorPostData {
  readonly DeviceIDs: readonly number[]
  readonly FromDate: string
  readonly ToDate: string
}
export interface ErrorData {
  readonly DeviceId: number
  readonly EndDate: string
  readonly ErrorMessage: string | null
  readonly StartDate: string
}

export interface WifiPostData {
  readonly devices: readonly number[]
  readonly hour: number
}
export interface WifiData {
  readonly Data: readonly (readonly (number | null)[])[]
  readonly FromDate: string
  readonly Labels: readonly string[]
  readonly ToDate: string
}
