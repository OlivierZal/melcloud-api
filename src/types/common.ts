import type { DeviceType, FanSpeed } from './bases'

import {
  type EnergyDataAta,
  type GetDeviceDataAta,
  type Horizontal,
  type ListDeviceAta,
  type ListDeviceDataAta,
  type OperationMode,
  type SetDeviceDataAta,
  type SetDevicePostDataAta,
  type UpdateDeviceDataAta,
  type ValuesAta,
  type Vertical,
  FLAGS_ATA,
} from './ata'
import {
  type EnergyDataAtw,
  type GetDeviceDataAtw,
  type ListDeviceAtw,
  type ListDeviceDataAtw,
  type SetDeviceDataAtw,
  type SetDevicePostDataAtw,
  type UpdateDeviceDataAtw,
  type ValuesAtw,
  FLAGS_ATW,
} from './atw'
import {
  type GetDeviceDataErv,
  type ListDeviceDataErv,
  type ListDeviceErv,
  type SetDeviceDataErv,
  type SetDevicePostDataErv,
  type UpdateDeviceDataErv,
  type ValuesErv,
  FLAGS_ERV,
} from './erv'

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

export type DateTimeComponents = {
  readonly Day: number
  readonly Hour: number
  readonly Minute: number
  readonly Month: number
  readonly Second: number
  readonly Year: number
} | null
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
  readonly EndDate: DateTimeComponents
  readonly HMTimeZones: readonly HMTimeZone[]
  readonly StartDate: DateTimeComponents
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
export type AreaDataAny = AreaData<null> | AreaData<number>
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

export type TilesPostData<T extends keyof typeof DeviceType | null> = {
  readonly DeviceIDs: readonly number[]
} & (T extends keyof typeof DeviceType ?
  {
    readonly SelectedBuilding: number
    readonly SelectedDevice: number
  }
: {
    readonly SelectedBuilding?: null
    readonly SelectedDevice?: null
  })
export interface TilesData<T extends keyof typeof DeviceType | null> {
  readonly SelectedDevice: T extends keyof typeof DeviceType ? GetDeviceData[T]
  : null
  readonly Tiles: readonly {
    readonly Device: number
    readonly Offline: boolean
    readonly Power: boolean
    readonly RoomTemperature: number
    readonly RoomTemperature2: number
    readonly TankWaterTemperature: number
  }[]
}

export interface EnergyPostData {
  readonly DeviceID: number
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

export interface Values {
  readonly Ata: ValuesAta
  readonly Atw: ValuesAtw
  readonly Erv: ValuesErv
}

export const FLAGS = { Ata: FLAGS_ATA, Atw: FLAGS_ATW, Erv: FLAGS_ERV }
