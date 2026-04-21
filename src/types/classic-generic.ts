import type { ClassicDeviceType, ClassicLabelType } from '../constants.ts'
import type {
  ClassicEnergyDataAta,
  ClassicListDeviceDataAta,
  ClassicSetDeviceDataAta,
  ClassicUpdateDeviceDataAta,
} from './classic-ata.ts'
import type {
  ClassicEnergyDataAtw,
  ClassicListDeviceDataAtw,
  ClassicSetDeviceDataAtw,
  ClassicUpdateDeviceDataAtw,
} from './classic-atw.ts'
import type {
  ClassicBaseDevicePostData,
  ClassicBaseGetDeviceData,
  ClassicBaseListDevice,
} from './classic-bases.ts'
import type {
  ClassicListDeviceDataErv,
  ClassicSetDeviceDataErv,
  ClassicUpdateDeviceDataErv,
} from './classic-erv.ts'
import type { Hour } from './hour.ts'
import type { ClassicBuildingID, ClassicDeviceID } from './ids.ts'

/**
 * Central mapping from device type to its associated data types.
 * Adding a new device type requires a single entry here instead of
 * updating multiple conditional type chains.
 */
interface DeviceDataMapping {
  [ClassicDeviceType.Ata]: {
    energy: ClassicEnergyDataAta
    list: ClassicListDeviceDataAta
    set: ClassicSetDeviceDataAta
    update: ClassicUpdateDeviceDataAta
  }
  [ClassicDeviceType.Atw]: {
    energy: ClassicEnergyDataAtw
    list: ClassicListDeviceDataAtw
    set: ClassicSetDeviceDataAtw
    update: ClassicUpdateDeviceDataAtw
  }
  [ClassicDeviceType.Erv]: {
    energy: never
    list: ClassicListDeviceDataErv
    set: ClassicSetDeviceDataErv
    update: ClassicUpdateDeviceDataErv
  }
}

export interface BaseZone {
  readonly id: number
  readonly level: number
  readonly name: string
}

export interface ClassicAreaData<
  T extends number | null,
> extends ClassicFloorData {
  readonly FloorId: T
}

export type ClassicAreaDataAny = ClassicAreaData<null> | ClassicAreaData<number>

export interface ClassicAreaZone extends BaseZone {
  readonly devices: readonly ClassicDeviceZone[]
  readonly model: 'areas'
}

export interface ClassicBuildingData extends ClassicZoneSettings {
  readonly ID: ClassicBuildingID
  readonly Location: number
  readonly Name: string
}

export interface ClassicBuildingWithStructure extends ClassicBuildingData {
  readonly Structure: {
    readonly Areas: readonly (ClassicAreaData<null> & {
      readonly Devices: readonly ClassicListDeviceAny[]
    })[]
    readonly Devices: readonly ClassicListDeviceAny[]
    readonly Floors: readonly (ClassicFloorData & {
      readonly Areas: readonly (ClassicAreaData<number> & {
        readonly Devices: readonly ClassicListDeviceAny[]
      })[]
      readonly Devices: readonly ClassicListDeviceAny[]
    })[]
  }
}

export interface ClassicBuildingZone extends BaseZone {
  readonly areas: readonly ClassicAreaZone[]
  readonly devices: readonly ClassicDeviceZone[]
  readonly floors: readonly ClassicFloorZone[]
  readonly model: 'buildings'
}

export type ClassicDateTimeComponents = {
  readonly Day: number
  readonly Hour: number
  readonly Minute: number
  readonly Month: number
  readonly Second: number
  readonly Year: number
} | null

export interface ClassicDeviceZone extends BaseZone {
  readonly model: 'devices'
}

export type ClassicEnergyData<T extends ClassicDeviceType> =
  DeviceDataMapping[T]['energy']

export interface ClassicEnergyPostData {
  readonly DeviceID: ClassicDeviceID
  readonly FromDate: string
  readonly ToDate: string
}

export interface ClassicErrorLogData {
  readonly DeviceId: ClassicDeviceID
  readonly EndDate: string
  readonly ErrorMessage: string | null
  readonly StartDate: string
}

export interface ClassicErrorLogPostData {
  readonly DeviceIDs: ClassicDeviceID | readonly ClassicDeviceID[]
  // Number of days up to now, replaces `FromDate` and `ToDate` if strictly positive
  readonly Duration?: number
  readonly FromDate?: string
  readonly ToDate?: string
}

export interface ClassicFailureData {
  readonly AttributeErrors: Record<string, readonly string[]>
  readonly Success: false
}

export interface ClassicFloorData {
  readonly BuildingId: ClassicBuildingID
  readonly ID: number
  readonly Name: string
}

export interface ClassicFloorZone extends BaseZone {
  readonly areas: readonly ClassicAreaZone[]
  readonly devices: readonly ClassicDeviceZone[]
  readonly model: 'floors'
}

export interface ClassicFrostProtectionData {
  readonly FPDefined: boolean
  readonly FPEnabled: boolean
  readonly FPMaxTemperature: number
  readonly FPMinTemperature: number
}

export interface ClassicFrostProtectionLocation {
  readonly AreaIds?: number | readonly number[]
  readonly BuildingIds?: number | readonly number[]
  readonly DeviceIds?: number | readonly number[]
  readonly FloorIds?: number | readonly number[]
}

export interface ClassicFrostProtectionPostData extends ClassicFrostProtectionLocation {
  readonly Enabled: boolean
  readonly MaximumTemperature: number
  readonly MinimumTemperature: number
}

export type ClassicGetDeviceData<T extends ClassicDeviceType> =
  ClassicBaseGetDeviceData & ClassicSetDeviceData<T>

export interface ClassicGetDeviceDataParams {
  readonly buildingId: number
  readonly id: number
}

export interface ClassicHolidayModeData {
  readonly EndDate: NonNullable<ClassicDateTimeComponents>
  readonly HMDefined: boolean
  readonly HMEnabled: boolean
  readonly HMEndDate: string | null
  readonly HMStartDate: string | null
  readonly StartDate: NonNullable<ClassicDateTimeComponents>
  readonly TimeZone: number
}

export interface ClassicHolidayModeLocation {
  readonly Areas?: number | readonly number[]
  readonly Buildings?: number | readonly number[]
  readonly Devices?: number | readonly number[]
  readonly Floors?: number | readonly number[]
}

export interface ClassicHolidayModePostData {
  readonly Enabled: boolean
  readonly EndDate: ClassicDateTimeComponents
  readonly HMTimeZones: readonly ClassicHolidayModeTimeZone[]
  readonly StartDate: ClassicDateTimeComponents
}

export interface ClassicHolidayModeTimeZone extends ClassicHolidayModeLocation {
  readonly TimeZone?: number
}

export interface ClassicListDevice<
  T extends ClassicDeviceType,
> extends ClassicBaseListDevice<T> {
  readonly Device: ClassicListDeviceData<T>
}

export type ClassicListDeviceAny =
  | ClassicListDevice<typeof ClassicDeviceType.Ata>
  | ClassicListDevice<typeof ClassicDeviceType.Atw>
  | ClassicListDevice<typeof ClassicDeviceType.Erv>

export type ClassicListDeviceData<T extends ClassicDeviceType> =
  DeviceDataMapping[T]['list']

export type ClassicListDeviceDataAny = ClassicListDeviceData<ClassicDeviceType>

export interface ClassicLoginData {
  readonly LoginData: {
    readonly ContextKey: string
    readonly Expiry: string
  } | null
}

export interface ClassicLoginPostData {
  readonly AppVersion: string
  readonly Email: string
  readonly Password: string
  readonly Language?: number
  readonly Persist?: boolean
}

export type ClassicOperationModeLogData = {
  Key: string
  Value: number
}[]

export interface ClassicReportData {
  readonly Data: readonly (readonly (number | null)[])[]
  readonly FromDate: string
  readonly Labels: readonly string[]
  readonly LabelType: ClassicLabelType
  readonly Points: number
  readonly Series: number
  readonly ToDate: string
}

export interface ClassicReportPostData {
  readonly DeviceID: ClassicDeviceID
  readonly FromDate: string
  readonly ToDate: string
  readonly Duration?: number
}

export type ClassicSetDeviceData<T extends ClassicDeviceType> =
  DeviceDataMapping[T]['set']

export type ClassicSetDevicePostData<T extends ClassicDeviceType> =
  ClassicBaseDevicePostData & Required<ClassicUpdateDeviceData<T>>

export interface ClassicSetPowerPostData {
  readonly DeviceIds: ClassicDeviceID | readonly ClassicDeviceID[]
  readonly Power: boolean
}

export interface ClassicSettingsParams {
  readonly id: number
  readonly tableName:
    | 'ClassicArea'
    | 'ClassicBuilding'
    | 'ClassicFloor'
    | 'DeviceLocation'
}

export interface ClassicSuccessData {
  readonly AttributeErrors: null
  readonly Success: true
}

export interface ClassicTemperatureLogPostData extends ClassicReportPostData {
  readonly Location?: number
}

export interface ClassicTilesData<T extends ClassicDeviceType | null> {
  readonly SelectedDevice: T extends ClassicDeviceType ? ClassicGetDeviceData<T>
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

export type ClassicTilesPostData<T extends ClassicDeviceType | null> = {
  readonly DeviceIDs: number | readonly number[]
} & (T extends ClassicDeviceType ?
  { readonly SelectedBuilding: number; readonly SelectedDevice: number }
: { readonly SelectedBuilding?: null; readonly SelectedDevice?: null })

export type ClassicUpdateDeviceData<T extends ClassicDeviceType> =
  DeviceDataMapping[T]['update']

export type ClassicZone =
  | ClassicAreaZone
  | ClassicBuildingZone
  | ClassicDeviceZone
  | ClassicFloorZone

export interface ClassicZoneSettings
  extends
    ClassicFrostProtectionData,
    Omit<ClassicHolidayModeData, 'EndDate' | 'StartDate'> {}

export interface HourlyReportPostData {
  readonly devices: number[]
  readonly hour: Hour
}
