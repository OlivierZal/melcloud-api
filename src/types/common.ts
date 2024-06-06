import type {
  BaseDevicePostData,
  DeviceType,
  EnergyDataAta,
  EnergyDataAtw,
  FanSpeed,
  GetDeviceDataAta,
  GetDeviceDataAtw,
  GetDeviceDataErv,
  Horizontal,
  ListDeviceDataAta,
  ListDeviceDataAtw,
  ListDeviceDataErv,
  OperationMode,
  SetDeviceDataAta,
  SetDeviceDataAtw,
  SetDeviceDataErv,
  SetDevicePostDataAta,
  SetDevicePostDataAtw,
  SetDevicePostDataErv,
  UpdateDeviceDataAta,
  UpdateDeviceDataAtw,
  UpdateDeviceDataErv,
  Vertical,
  effectiveFlagsAta,
  effectiveFlagsAtw,
  effectiveFlagsErv,
} from '.'

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

export interface EffectiveFlags {
  readonly Ata: typeof effectiveFlagsAta
  readonly Atw: typeof effectiveFlagsAtw
  readonly Erv: typeof effectiveFlagsErv
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

export interface UpdateDeviceData {
  readonly Ata: UpdateDeviceDataAta
  readonly Atw: UpdateDeviceDataAtw
  readonly Erv: UpdateDeviceDataErv
}
export interface SetDevicePostData {
  readonly Ata: SetDevicePostDataAta
  readonly Atw: SetDevicePostDataAtw
  readonly Erv: SetDevicePostDataErv
}
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

export interface FrostProtectionPostData {
  readonly AreaIds?: readonly number[]
  readonly BuildingIds?: readonly number[]
  readonly DeviceIds?: readonly number[]
  readonly FloorIds?: readonly number[]
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

export interface HolidayModePostData {
  readonly Enabled: boolean
  readonly EndDate: {
    readonly Day: number
    readonly Hour: number
    readonly Minute: number
    readonly Month: number
    readonly Second: number
    readonly Year: number
  } | null
  readonly HMTimeZones: readonly {
    readonly Areas?: readonly number[]
    readonly Buildings?: readonly number[]
    readonly Devices?: readonly number[]
    readonly Floors?: readonly number[]
    readonly TimeZone?: number
  }[]
  readonly StartDate: {
    readonly Day: number
    readonly Hour: number
    readonly Minute: number
    readonly Month: number
    readonly Second: number
    readonly Year: number
  } | null
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
export interface BaseListDevice {
  readonly AreaID: number | null
  readonly BuildingID: number
  readonly DeviceID: number
  readonly DeviceName: string
  readonly FloorID: number | null
  readonly Type: DeviceType
}
export interface ListDeviceAta extends BaseListDevice {
  readonly Device: ListDeviceDataAta
}
export interface ListDeviceAtw extends BaseListDevice {
  readonly Device: ListDeviceDataAtw
}
export interface ListDeviceErv extends BaseListDevice {
  readonly Device: ListDeviceDataErv
}
export interface ListDevice {
  readonly Ata: ListDeviceAta
  readonly Atw: ListDeviceAtw
  readonly Erv: ListDeviceErv
}
export type ListDeviceAny = ListDeviceAta | ListDeviceAtw | ListDeviceErv
export interface LocationData {
  readonly BuildingId: number
  readonly ID: number
  readonly Name: string
}
export interface Building extends BuildingData {
  readonly Structure: {
    readonly Areas: readonly (LocationData & {
      readonly Devices: readonly ListDeviceAny[]
      readonly FloorId: null
    })[]
    readonly Devices: readonly ListDeviceAny[]
    readonly Floors: readonly (LocationData & {
      readonly Areas: readonly (LocationData & {
        readonly Devices: readonly ListDeviceAny[]
        readonly FloorId: number
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
  readonly Specification:
    | {
        readonly AreaID?: null
        readonly BuildingID?: null
        readonly FloorID: number
      }
    | {
        readonly AreaID?: null
        readonly FloorID?: null
        readonly BuildingID: number
      }
    | {
        readonly BuildingID?: null
        readonly FloorID?: null
        readonly AreaID: number
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
  readonly Data: (number | null)[][]
  readonly FromDate: string
  readonly Labels: string[]
  readonly ToDate: string
}
