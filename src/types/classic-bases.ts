import type { CLASSIC_FLAG_UNCHANGED, ClassicDeviceType } from '../constants.ts'
import type { ClassicDevicePermissions } from './classic-generic.ts'
import type {
  ClassicAreaID,
  ClassicBuildingID,
  ClassicDeviceID,
  ClassicFloorID,
} from './ids.ts'

/**
 * Common header fields for any `Device/Set*` POST body: target id and the bitfield identifying which mutated fields should be applied.
 * @category Types
 */
export interface ClassicBaseDevicePostData {
  readonly DeviceID: ClassicDeviceID
  readonly EffectiveFlags: number
}

/**
 * Shape returned by `Device/Get` for any device type — same body as a set-device payload but with `EffectiveFlags` pinned to the unchanged sentinel.
 * @category Types
 */
export interface ClassicBaseGetDeviceData extends ClassicBaseSetDeviceData {
  readonly EffectiveFlags: typeof CLASSIC_FLAG_UNCHANGED
}

/**
 * `ListDevices` device wrapper — identity, parent zones, ownership,
 * firmware/network metadata, UI hints, and per-capability permission
 * flags. The typed `Device` payload is added on top by
 * {@link ClassicListDevice}.
 * @category Types
 */
export interface ClassicBaseListDevice<
  T extends ClassicDeviceType = ClassicDeviceType,
> {
  readonly AccessLevel: number
  readonly AdaptorType: number
  readonly AreaID: ClassicAreaID | null
  readonly AreaName: string | null
  readonly BuildingCountry: number | null
  readonly BuildingID: ClassicBuildingID
  readonly BuildingName: string
  readonly DateCreated: string
  readonly DetectedCountry: number | null
  readonly DeviceID: ClassicDeviceID
  readonly DeviceName: string
  readonly DiagnosticEndDate: string | null
  readonly DiagnosticMode: number
  readonly DirectAccess: boolean
  readonly EndDate: string
  readonly EstimateAtaEnergyProduction: boolean
  readonly EstimateAtaEnergyProductionOptIn: boolean
  readonly ExpectedCommand: number
  readonly FirmwareDeployment: string | null
  readonly FirmwareUpdateAborted: boolean
  readonly FloorID: ClassicFloorID | null
  readonly FloorName: string | null
  readonly HideDryModeControl: boolean
  readonly HideOutdoorTemperature: boolean
  readonly HideRoomTemperature: boolean
  readonly HideSupplyTemperature: boolean
  readonly HideVaneControls: boolean
  readonly ImageID: number
  readonly InstallationDate: string | null
  readonly LastServiceDate: string | null
  readonly LinkedDevice: ClassicDeviceID | null
  readonly LocalIPAddress: string | null
  readonly Location: number
  readonly MacAddress: string
  readonly MaxTemperature: number
  readonly MinTemperature: number
  readonly OwnerCountry: number | null
  readonly OwnerEmail: string
  readonly OwnerID: number
  readonly OwnerName: string
  readonly Permissions: ClassicDevicePermissions
  readonly Presets: readonly Readonly<Record<string, unknown>>[]
  readonly RegistReason: string
  readonly RegistRetry: number
  readonly Registrations: number
  readonly SerialNumber: string
  readonly TimeZone: number
  readonly Type: T
  readonly Zone1Name: string | null
  readonly Zone2Name: string | null
}

export interface ClassicBaseListDeviceData extends Omit<
  ClassicBaseGetDeviceData,
  keyof ClassicTransientDeviceData
> {
  readonly WifiSignalStrength: number
}

export interface ClassicBaseSetDeviceData
  extends ClassicTransientDeviceData, Required<ClassicBaseUpdateDeviceData> {
  readonly EffectiveFlags: number
  readonly Offline: boolean
}

export interface ClassicBaseUpdateDeviceData {
  readonly Power?: boolean
}

export interface ClassicTransientDeviceData {
  readonly LastCommunication: string
  readonly NextCommunication: string
}
