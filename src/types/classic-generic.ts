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
 * @internal
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

/** Common shape shared by every Classic zone variant returned from the registry — id, hierarchy depth, display name. */
export interface BaseZone {
  readonly id: number
  readonly level: number
  readonly name: string
}

/** Wire-format area entry from `ListDevices`; `FloorId` is `null` when the area sits directly under the building, or a floor id otherwise. */
export interface ClassicAreaData<
  T extends number | null,
> extends ClassicFloorData {
  readonly FloorId: T
}

/** Either floor-bound or directly under-building variant of {@link ClassicAreaData}. */
export type ClassicAreaDataAny = ClassicAreaData<null> | ClassicAreaData<number>

/** Registry zone for an area, listing the devices it contains. */
export interface ClassicAreaZone extends BaseZone {
  readonly devices: readonly ClassicDeviceZone[]
  readonly model: 'areas'
}

/** Wire-format building entry from `ListDevices` (without the nested `Structure`). */
export interface ClassicBuildingData extends ClassicZoneSettings {
  readonly ID: ClassicBuildingID
  readonly Location: number
  readonly Name: string
}

/** Full wire-format building from `ListDevices`, including the nested floor / area / device hierarchy. */
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

/** Registry zone for a building, including its floors, areas, and devices. */
export interface ClassicBuildingZone extends BaseZone {
  readonly areas: readonly ClassicAreaZone[]
  readonly devices: readonly ClassicDeviceZone[]
  readonly floors: readonly ClassicFloorZone[]
  readonly model: 'buildings'
}

/** MELCloud's date-time-as-components encoding used on holiday-mode payloads; `null` when the date is unset. */
export type ClassicDateTimeComponents = {
  readonly Day: number
  readonly Hour: number
  readonly Minute: number
  readonly Month: number
  readonly Second: number
  readonly Year: number
} | null

/** Registry zone for an individual device. */
export interface ClassicDeviceZone extends BaseZone {
  readonly model: 'devices'
}

/** Wire-format energy report payload narrowed by the device's `Type` (Ata or Atw — Erv has no energy data). */
export type ClassicEnergyData<T extends ClassicDeviceType> =
  DeviceDataMapping[T]['energy']

/** POST body for `EnergyCost/Report` — single device, ISO date range. */
export interface ClassicEnergyPostData {
  readonly DeviceID: ClassicDeviceID
  readonly FromDate: string
  readonly ToDate: string
}

/** Single error-log entry returned by `Report/GetUnitErrorLog2`. */
export interface ClassicErrorLogData {
  readonly DeviceId: ClassicDeviceID
  readonly EndDate: string
  readonly ErrorMessage: string | null
  readonly StartDate: string
}

/** POST body for `Report/GetUnitErrorLog2`; either an explicit date range or a rolling `Duration` window. */
export interface ClassicErrorLogPostData {
  readonly DeviceIDs: ClassicDeviceID | readonly ClassicDeviceID[]
  // Number of days up to now, replaces `FromDate` and `ToDate` if strictly positive
  readonly Duration?: number
  readonly FromDate?: string
  readonly ToDate?: string
}

/** Failure half of the discriminated mutation response — `Success: false` plus per-attribute rejection messages. */
export interface ClassicFailureData {
  readonly AttributeErrors: Record<string, readonly string[]>
  readonly Success: false
}

/** Wire-format floor entry from `ListDevices`. */
export interface ClassicFloorData {
  readonly BuildingId: ClassicBuildingID
  readonly ID: number
  readonly Name: string
}

/** Registry zone for a floor, including its areas and devices. */
export interface ClassicFloorZone extends BaseZone {
  readonly areas: readonly ClassicAreaZone[]
  readonly devices: readonly ClassicDeviceZone[]
  readonly model: 'floors'
}

/** Frost-protection settings retrieved from `FrostProtection/GetSettings`. */
export interface ClassicFrostProtectionData {
  readonly FPDefined: boolean
  readonly FPEnabled: boolean
  readonly FPMaxTemperature: number
  readonly FPMinTemperature: number
}

/** Identifier bundle scoping a frost-protection update to one or more buildings, floors, areas, or devices. */
export interface ClassicFrostProtectionLocation {
  readonly AreaIds?: number | readonly number[]
  readonly BuildingIds?: number | readonly number[]
  readonly DeviceIds?: number | readonly number[]
  readonly FloorIds?: number | readonly number[]
}

/** POST body for `FrostProtection/Update` — scope plus the new bounds and on/off flag. */
export interface ClassicFrostProtectionPostData extends ClassicFrostProtectionLocation {
  readonly Enabled: boolean
  readonly MaximumTemperature: number
  readonly MinimumTemperature: number
}

/** Wire-format response body from `Device/Get`, narrowed by device type. */
export type ClassicGetDeviceData<T extends ClassicDeviceType> =
  ClassicBaseGetDeviceData & ClassicSetDeviceData<T>

/** Query-string parameters for `Device/Get`. */
export interface ClassicGetDeviceDataParams {
  readonly buildingId: number
  readonly id: number
}

/** Holiday-mode settings retrieved from `HolidayMode/GetSettings`. */
export interface ClassicHolidayModeData {
  readonly EndDate: NonNullable<ClassicDateTimeComponents>
  readonly HMDefined: boolean
  readonly HMEnabled: boolean
  readonly HMEndDate: string | null
  readonly HMStartDate: string | null
  readonly StartDate: NonNullable<ClassicDateTimeComponents>
  readonly TimeZone: number
}

/** Identifier bundle scoping a holiday-mode update to one or more buildings, floors, areas, or devices. */
export interface ClassicHolidayModeLocation {
  readonly Areas?: number | readonly number[]
  readonly Buildings?: number | readonly number[]
  readonly Devices?: number | readonly number[]
  readonly Floors?: number | readonly number[]
}

/** POST body for `HolidayMode/Update` — start/end dates plus per-time-zone scope entries. */
export interface ClassicHolidayModePostData {
  readonly Enabled: boolean
  readonly EndDate: ClassicDateTimeComponents
  readonly HMTimeZones: readonly ClassicHolidayModeTimeZone[]
  readonly StartDate: ClassicDateTimeComponents
}

/** Per-time-zone scope entry inside a `HolidayMode/Update` body. */
export interface ClassicHolidayModeTimeZone extends ClassicHolidayModeLocation {
  readonly TimeZone?: number
}

/** Wire-format `ListDevices` device entry: header (id, name, parents) plus the typed `Device` payload. */
export interface ClassicListDevice<
  T extends ClassicDeviceType,
> extends ClassicBaseListDevice<T> {
  readonly Device: ClassicListDeviceData<T>
}

/** Discriminated union over every Classic device type returned by `ListDevices`. */
export type ClassicListDeviceAny =
  | ClassicListDevice<typeof ClassicDeviceType.Ata>
  | ClassicListDevice<typeof ClassicDeviceType.Atw>
  | ClassicListDevice<typeof ClassicDeviceType.Erv>

/** Wire-format `Device` payload from `ListDevices`, narrowed by device type. */
export type ClassicListDeviceData<T extends ClassicDeviceType> =
  DeviceDataMapping[T]['list']

/** Union of every Classic list-device data shape across device types. */
export type ClassicListDeviceDataAny = ClassicListDeviceData<ClassicDeviceType>

/** Wire-format response from `Login/ClientLogin3`; `LoginData` is `null` when credentials are rejected. */
export interface ClassicLoginData {
  readonly LoginData: {
    readonly ContextKey: string
    readonly Expiry: string
  } | null
}

/** POST body for `Login/ClientLogin3`. */
export interface ClassicLoginPostData {
  readonly AppVersion: string
  readonly Email: string
  readonly Password: string
  readonly Language?: number
  readonly Persist?: boolean
}

/** Operation-mode breakdown returned by `Report/GetOperationModeLog2` — one `{Key,Value}` entry per mode. */
export type ClassicOperationModeLogData = {
  Key: string
  Value: number
}[]

/** Generic report payload (temperatures, signal, etc.) returned by the various `Report/*` endpoints. */
export interface ClassicReportData {
  readonly Data: readonly (readonly (number | null)[])[]
  readonly FromDate: string
  readonly Labels: readonly string[]
  readonly LabelType: ClassicLabelType
  readonly Points: number
  readonly Series: number
  readonly ToDate: string
}

/** Common POST body for the `Report/*` endpoints — single device, ISO date range, optional rolling `Duration`. */
export interface ClassicReportPostData {
  readonly DeviceID: ClassicDeviceID
  readonly FromDate: string
  readonly ToDate: string
  readonly Duration?: number
}

/** Wire-format response from `Device/Set{Ata,Atw,Erv}`, narrowed by device type. */
export type ClassicSetDeviceData<T extends ClassicDeviceType> =
  DeviceDataMapping[T]['set']

/** POST body for `Device/Set{Ata,Atw,Erv}` — base header plus every required field for the device type. */
export type ClassicSetDevicePostData<T extends ClassicDeviceType> =
  ClassicBaseDevicePostData & Required<ClassicUpdateDeviceData<T>>

/** POST body for `Device/Power`. */
export interface ClassicSetPowerPostData {
  readonly DeviceIds: ClassicDeviceID | readonly ClassicDeviceID[]
  readonly Power: boolean
}

/** Query-string parameters identifying a zone settings target (used by `FrostProtection/GetSettings`, `HolidayMode/GetSettings`). */
export interface ClassicSettingsParams {
  readonly id: number
  readonly tableName:
    | 'ClassicArea'
    | 'ClassicBuilding'
    | 'ClassicFloor'
    | 'DeviceLocation'
}

/** Success half of the discriminated mutation response — `Success: true` and no attribute errors. */
export interface ClassicSuccessData {
  readonly AttributeErrors: null
  readonly Success: true
}

/** POST body for `Report/GetTemperatureLog2`; extends the generic report body with an optional `Location` selector. */
export interface ClassicTemperatureLogPostData extends ClassicReportPostData {
  readonly Location?: number
}

/** Wire-format response from `Tile/Get2`; the optional `SelectedDevice` carries full device data when a device id was specified. */
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

/** POST body for `Tile/Get2`; conditionally requires `SelectedBuilding` + `SelectedDevice` when scoped to a single device. */
export type ClassicTilesPostData<T extends ClassicDeviceType | null> = {
  readonly DeviceIDs: number | readonly number[]
} & (T extends ClassicDeviceType ?
  { readonly SelectedBuilding: number; readonly SelectedDevice: number }
: { readonly SelectedBuilding?: null; readonly SelectedDevice?: null })

/** Mutable fields for a `Device/Set{Ata,Atw,Erv}` payload, narrowed by device type. */
export type ClassicUpdateDeviceData<T extends ClassicDeviceType> =
  DeviceDataMapping[T]['update']

/** Discriminated union of every registry zone shape (building / floor / area / device). */
export type ClassicZone =
  | ClassicAreaZone
  | ClassicBuildingZone
  | ClassicDeviceZone
  | ClassicFloorZone

/** Inherited frost-protection + holiday-mode flags carried on every building, floor, and area record. */
export interface ClassicZoneSettings
  extends
    ClassicFrostProtectionData,
    Omit<ClassicHolidayModeData, 'EndDate' | 'StartDate'> {}

/** POST body for the hourly temperature / signal endpoints — multiple devices for a fixed hour-of-day. */
export interface HourlyReportPostData {
  readonly devices: number[]
  readonly hour: Hour
}
