import type { HourNumbers } from 'luxon'

import type { DeviceType } from '../enums.ts'

import type {
  EnergyDataAta,
  ListDeviceDataAta,
  SetDeviceDataAta,
  UpdateDeviceDataAta,
} from './ata.ts'
import type {
  EnergyDataAtw,
  ListDeviceDataAtw,
  SetDeviceDataAtw,
  UpdateDeviceDataAtw,
} from './atw.ts'
import type {
  BaseDevicePostData,
  BaseGetDeviceData,
  BaseListDevice,
} from './bases.ts'
import type {
  ListDeviceDataErv,
  SetDeviceDataErv,
  UpdateDeviceDataErv,
} from './erv.ts'

export interface AreaData<T extends number | null> extends FloorData {
  readonly FloorId: T
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

export interface BuildingData extends ZoneSettings {
  readonly ID: number
  readonly Name: string
}

export interface EnergyPostData {
  readonly DeviceID: number
  readonly FromDate: string
  readonly ToDate: string
}

export interface ErrorLogData {
  readonly DeviceId: number
  readonly EndDate: string
  readonly ErrorMessage: string | null
  readonly StartDate: string
}

export interface ErrorLogPostData {
  readonly DeviceIDs: number | readonly number[]
  readonly FromDate?: string
  readonly ToDate?: string
  // Number of days up to now, replaces `FromDate` and `ToDate` if strictly positive
  readonly Duration?: number
}

export interface FailureData {
  readonly AttributeErrors: Record<string, readonly string[]>
  readonly Success: false
}

export interface FloorData {
  readonly BuildingId: number
  readonly ID: number
  readonly Name: string
}

export interface FrostProtectionData {
  readonly FPDefined: boolean
  readonly FPEnabled: boolean
  readonly FPMaxTemperature: number
  readonly FPMinTemperature: number
}

export interface FrostProtectionLocation {
  readonly AreaIds?: number | readonly number[]
  readonly BuildingIds?: number | readonly number[]
  readonly DeviceIds?: number | readonly number[]
  readonly FloorIds?: number | readonly number[]
}

export interface FrostProtectionPostData extends FrostProtectionLocation {
  readonly Enabled: boolean
  readonly MaximumTemperature: number
  readonly MinimumTemperature: number
}

export interface GetDeviceDataParams {
  readonly buildingId: number
  readonly id: number
}

export interface HMTimeZone extends HolidayModeLocation {
  readonly TimeZone?: number
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

export interface HolidayModeLocation {
  readonly Areas?: number | readonly number[]
  readonly Buildings?: number | readonly number[]
  readonly Devices?: number | readonly number[]
  readonly Floors?: number | readonly number[]
}

export interface HolidayModePostData {
  readonly Enabled: boolean
  readonly EndDate: DateTimeComponents
  readonly HMTimeZones: readonly HMTimeZone[]
  readonly StartDate: DateTimeComponents
}

export interface HourlyReportPostData {
  readonly devices: number[]
  readonly hour: HourNumbers
}

export interface ListDevice<T extends DeviceType> extends BaseListDevice {
  readonly Device: ListDeviceData<T>
}

export interface LoginCredentials {
  readonly password: string
  readonly username: string
}

export interface LoginData {
  readonly LoginData: {
    readonly ContextKey: string
    readonly Expiry: string
  } | null
}

export interface LoginPostData {
  readonly AppVersion: string
  readonly Email: string
  readonly Password: string
  readonly Language?: number
  readonly Persist?: boolean
}

export interface ReportData {
  readonly Data: readonly (readonly (number | null)[])[]
  readonly FromDate: string
  readonly Labels: readonly string[]
  readonly Points: number
  readonly Series: number
  readonly ToDate: string
}

export interface ReportPostData {
  readonly DeviceID: number
  readonly FromDate: string
  readonly ToDate: string
}

export interface SetPowerPostData {
  readonly DeviceIds: number | readonly number[]
  readonly Power: boolean
}

export interface SettingsParams {
  readonly id: number
  readonly tableName: 'Area' | 'Building' | 'DeviceLocation' | 'Floor'
}

export interface SuccessData {
  readonly AttributeErrors: null
  readonly Success: true
}

export interface TilesData<T extends DeviceType | null> {
  readonly SelectedDevice: T extends DeviceType ? GetDeviceData<T> : null
  readonly Tiles: readonly {
    readonly Device: number
    readonly Offline: boolean
    readonly Power: boolean
    readonly RoomTemperature: number
    readonly RoomTemperature2: number
    readonly TankWaterTemperature: number
  }[]
}

export interface ZoneSettings
  extends FrostProtectionData,
    Omit<HolidayModeData, 'EndDate' | 'StartDate'> {}

export type AreaDataAny = AreaData<null> | AreaData<number>

export type DateTimeComponents = {
  readonly Day: number
  readonly Hour: number
  readonly Minute: number
  readonly Month: number
  readonly Second: number
  readonly Year: number
} | null

export type EnergyData<T extends DeviceType> =
  T extends DeviceType.Ata ? EnergyDataAta
  : T extends DeviceType.Atw ? EnergyDataAtw
  : never

export type GetDeviceData<T extends DeviceType> = BaseGetDeviceData &
  SetDeviceData<T>

export type ListDeviceAny =
  | ListDevice<DeviceType.Ata>
  | ListDevice<DeviceType.Atw>
  | ListDevice<DeviceType.Erv>

export type ListDeviceData<T extends DeviceType> =
  T extends DeviceType.Ata ? ListDeviceDataAta
  : T extends DeviceType.Atw ? ListDeviceDataAtw
  : T extends DeviceType.Erv ? ListDeviceDataErv
  : never

export type ListDeviceDataAny =
  | ListDeviceData<DeviceType.Ata>
  | ListDeviceData<DeviceType.Atw>
  | ListDeviceData<DeviceType.Erv>

export type OperationModeLogData = {
  Key: string
  Value: number
}[]

export type SetDeviceData<T extends DeviceType> =
  T extends DeviceType.Ata ? SetDeviceDataAta
  : T extends DeviceType.Atw ? SetDeviceDataAtw
  : T extends DeviceType.Erv ? SetDeviceDataErv
  : never

export type SetDevicePostData<T extends DeviceType> = BaseDevicePostData &
  Required<UpdateDeviceData<T>>

export type TilesPostData<T extends DeviceType | null> = {
  readonly DeviceIDs: number | readonly number[]
} & (T extends DeviceType ?
  { readonly SelectedBuilding: number; readonly SelectedDevice: number }
: { readonly SelectedBuilding?: null; readonly SelectedDevice?: null })

export type UpdateDeviceData<T extends DeviceType> =
  T extends DeviceType.Ata ? UpdateDeviceDataAta
  : T extends DeviceType.Atw ? UpdateDeviceDataAtw
  : T extends DeviceType.Erv ? UpdateDeviceDataErv
  : never
