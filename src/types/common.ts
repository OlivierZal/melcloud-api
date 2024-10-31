import type {
  DeviceType,
  FanSpeed,
  Horizontal,
  OperationMode,
  Vertical,
} from '../enums.js'

import type {
  EnergyDataAta,
  GetDeviceDataAta,
  ListDeviceAta,
  ListDeviceDataAta,
  SetDeviceDataAta,
  SetDevicePostDataAta,
  UpdateDeviceDataAta,
} from './ata.js'
import type {
  EnergyDataAtw,
  GetDeviceDataAtw,
  ListDeviceAtw,
  ListDeviceDataAtw,
  SetDeviceDataAtw,
  SetDevicePostDataAtw,
  UpdateDeviceDataAtw,
} from './atw.js'
import type {
  GetDeviceDataErv,
  ListDeviceDataErv,
  ListDeviceErv,
  SetDeviceDataErv,
  SetDevicePostDataErv,
  UpdateDeviceDataErv,
} from './erv.js'

export interface LoginCredentials {
  readonly password: string
  readonly username: string
}
export interface LoginPostData {
  readonly AppVersion: string
  readonly Email: string
  readonly Password: string
  readonly Language?: number
  readonly Persist?: boolean
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

export interface ZoneSettings
  extends FrostProtectionData,
    Omit<HolidayModeData, 'EndDate' | 'StartDate'> {}
export interface BuildingData extends ZoneSettings {
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

export interface GetGroupAtaPostData {
  readonly AreaID?: number | null
  readonly BuildingID?: number | null
  readonly FloorID?: number | null
}
export interface GroupAtaState {
  readonly FanSpeed?: Exclude<FanSpeed, FanSpeed.silent> | null
  readonly OperationMode?: OperationMode | null
  readonly Power?: boolean | null
  readonly SetTemperature?: number | null
  readonly VaneHorizontalDirection?: Horizontal | null
  readonly VaneHorizontalSwing?: boolean | null
  readonly VaneVerticalDirection?: Vertical | null
  readonly VaneVerticalSwing?: boolean | null
}
export interface SetGroupAtaPostData {
  readonly Specification: GetGroupAtaPostData
  readonly State: GroupAtaState
}
export interface GetGroupAtaData {
  readonly Data: {
    readonly Group: {
      readonly Specification: Required<SetGroupAtaPostData['Specification']>
      readonly State: Required<SetGroupAtaPostData['State']>
    }
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
