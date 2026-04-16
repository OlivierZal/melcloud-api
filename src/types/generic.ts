import type { HourNumbers } from 'luxon'

import type { ClassicDeviceType, LabelType } from '../constants.ts'
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
import type { BuildingID, DeviceID } from './ids.ts'

/**
 * Central mapping from device type to its associated data types.
 * Adding a new device type requires a single entry here instead of
 * updating multiple conditional type chains.
 */
interface DeviceDataMapping {
  [ClassicDeviceType.Ata]: {
    energy: EnergyDataAta
    list: ListDeviceDataAta
    set: SetDeviceDataAta
    update: UpdateDeviceDataAta
  }
  [ClassicDeviceType.Atw]: {
    energy: EnergyDataAtw
    list: ListDeviceDataAtw
    set: SetDeviceDataAtw
    update: UpdateDeviceDataAtw
  }
  [ClassicDeviceType.Erv]: {
    energy: never
    list: ListDeviceDataErv
    set: SetDeviceDataErv
    update: UpdateDeviceDataErv
  }
}

export interface AreaData<T extends number | null> extends FloorData {
  readonly FloorId: T
}

export type AreaDataAny = AreaData<null> | AreaData<number>

export interface AreaZone extends BaseZone {
  readonly devices: readonly DeviceZone[]
  readonly model: 'areas'
}

export interface BaseZone {
  readonly id: number
  readonly level: number
  readonly name: string
}

export interface BuildingData extends ZoneSettings {
  readonly ID: BuildingID
  readonly Location: number
  readonly Name: string
}

export interface BuildingWithStructure extends BuildingData {
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

export interface BuildingZone extends BaseZone {
  readonly areas: readonly AreaZone[]
  readonly devices: readonly DeviceZone[]
  readonly floors: readonly FloorZone[]
  readonly model: 'buildings'
}

export type DateTimeComponents = {
  readonly Day: number
  readonly Hour: number
  readonly Minute: number
  readonly Month: number
  readonly Second: number
  readonly Year: number
} | null

export interface DeviceZone extends BaseZone {
  readonly model: 'devices'
}

export type EnergyData<T extends ClassicDeviceType> =
  DeviceDataMapping[T]['energy']

export interface EnergyPostData {
  readonly DeviceID: DeviceID
  readonly FromDate: string
  readonly ToDate: string
}

export interface ErrorLogData {
  readonly DeviceId: DeviceID
  readonly EndDate: string
  readonly ErrorMessage: string | null
  readonly StartDate: string
}

export interface ErrorLogPostData {
  readonly DeviceIDs: DeviceID | readonly DeviceID[]
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
  readonly BuildingId: BuildingID
  readonly ID: number
  readonly Name: string
}

export interface FloorZone extends BaseZone {
  readonly areas: readonly AreaZone[]
  readonly devices: readonly DeviceZone[]
  readonly model: 'floors'
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

export type GetDeviceData<T extends ClassicDeviceType> = BaseGetDeviceData &
  SetDeviceData<T>

export interface GetDeviceDataParams {
  readonly buildingId: number
  readonly id: number
}

export interface HolidayModeData {
  readonly EndDate: NonNullable<DateTimeComponents>
  readonly HMDefined: boolean
  readonly HMEnabled: boolean
  readonly HMEndDate: string | null
  readonly HMStartDate: string | null
  readonly StartDate: NonNullable<DateTimeComponents>
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
  readonly HMTimeZones: readonly HolidayModeTimeZone[]
  readonly StartDate: DateTimeComponents
}

export interface HolidayModeTimeZone extends HolidayModeLocation {
  readonly TimeZone?: number
}

export interface HourlyReportPostData {
  readonly devices: number[]
  readonly hour: HourNumbers
}

export interface ListDevice<
  T extends ClassicDeviceType,
> extends BaseListDevice<T> {
  readonly Device: ListDeviceData<T>
}

export type ListDeviceAny =
  | ListDevice<typeof ClassicDeviceType.Ata>
  | ListDevice<typeof ClassicDeviceType.Atw>
  | ListDevice<typeof ClassicDeviceType.Erv>

export type ListDeviceData<T extends ClassicDeviceType> =
  DeviceDataMapping[T]['list']

export type ListDeviceDataAny = ListDeviceData<ClassicDeviceType>

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

export type OperationModeLogData = {
  Key: string
  Value: number
}[]

export interface ReportData {
  readonly Data: readonly (readonly (number | null)[])[]
  readonly FromDate: string
  readonly Labels: readonly string[]
  readonly LabelType: LabelType
  readonly Points: number
  readonly Series: number
  readonly ToDate: string
}

export interface ReportPostData {
  readonly DeviceID: DeviceID
  readonly FromDate: string
  readonly ToDate: string
  readonly Duration?: number
}

export type SetDeviceData<T extends ClassicDeviceType> =
  DeviceDataMapping[T]['set']

export type SetDevicePostData<T extends ClassicDeviceType> =
  BaseDevicePostData & Required<UpdateDeviceData<T>>

export interface SetPowerPostData {
  readonly DeviceIds: DeviceID | readonly DeviceID[]
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

export interface TemperatureLogPostData extends ReportPostData {
  readonly Location?: number
}

export interface TilesData<T extends ClassicDeviceType | null> {
  readonly SelectedDevice: T extends ClassicDeviceType ? GetDeviceData<T> : null
  readonly Tiles: readonly {
    readonly Device: number
    readonly Offline: boolean
    readonly Power: boolean
    readonly RoomTemperature: number
    readonly RoomTemperature2: number
    readonly TankWaterTemperature: number
  }[]
}

export type TilesPostData<T extends ClassicDeviceType | null> = {
  readonly DeviceIDs: number | readonly number[]
} & (T extends ClassicDeviceType ?
  { readonly SelectedBuilding: number; readonly SelectedDevice: number }
: { readonly SelectedBuilding?: null; readonly SelectedDevice?: null })

export type UpdateDeviceData<T extends ClassicDeviceType> =
  DeviceDataMapping[T]['update']

export type Zone = AreaZone | BuildingZone | DeviceZone | FloorZone

export interface ZoneSettings
  extends FrostProtectionData, Omit<HolidayModeData, 'EndDate' | 'StartDate'> {}
