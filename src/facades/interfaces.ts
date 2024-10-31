import type {
  DeviceType,
  FanSpeed,
  Horizontal,
  OperationMode,
  OperationModeZone,
  VentilationMode,
  Vertical,
} from '../enums.js'
import type { DeviceModel } from '../models/index.js'
import type {
  EnergyData,
  FailureData,
  FrostProtectionData,
  GetDeviceData,
  GroupAtaState,
  HolidayModeData,
  ListDevice,
  SetDeviceData,
  SuccessData,
  TilesData,
  UpdateDeviceData,
  WifiData,
  ZoneSettings,
} from '../types/index.js'

import type { AreaFacade } from './area.js'
import type { BuildingFacade } from './building.js'
import type { DeviceAtaFacade } from './device_ata.js'
import type { DeviceAtwFacade } from './device_atw.js'
import type { DeviceErvFacade } from './device_erv.js'
import type { FloorFacade } from './floor.js'

export interface BaseValues {
  readonly power?: boolean
}

export interface ValuesAta extends BaseValues {
  readonly fan?: Exclude<FanSpeed, FanSpeed.silent>
  readonly horizontal?: Horizontal
  readonly mode?: OperationMode
  readonly temperature?: number
  readonly vertical?: Vertical
}

export interface ValuesAtw extends BaseValues {
  readonly coolFlowTemperature?: number
  readonly coolFlowTemperatureZone2?: number
  readonly forcedHotWater?: boolean
  readonly heatFlowTemperature?: number
  readonly heatFlowTemperatureZone2?: number
  readonly hotWaterTemperature?: number
  readonly mode?: OperationModeZone
  readonly modeZone2?: OperationModeZone
  readonly temperature?: number
  readonly temperatureZone2?: number
}

export interface ValuesErv extends BaseValues {
  readonly fan?: Exclude<FanSpeed, FanSpeed.silent>
  readonly mode?: VentilationMode
}

export interface Values {
  readonly Ata: ValuesAta
  readonly Atw: ValuesAtw
  readonly Erv: ValuesErv
}

export interface ErrorLogQuery {
  readonly from?: string
  readonly limit?: string
  readonly offset?: string
  readonly to?: string
}

export interface ErrorDetails {
  readonly date: string
  readonly device: string
  readonly error: string
}

export interface ErrorLog {
  readonly errors: ErrorDetails[]
  readonly fromDateHuman: string
  readonly nextFromDate: string
  readonly nextToDate: string
}

export interface DeviceFacade {
  Ata: DeviceAtaFacade
  Atw: DeviceAtwFacade
  Erv: DeviceErvFacade
}
export type DeviceFacadeAny =
  | DeviceAtaFacade
  | DeviceAtwFacade
  | DeviceErvFacade

export type Facade = AreaFacade | BuildingFacade | DeviceFacadeAny | FloorFacade

export interface IBaseFacade {
  getErrors: (query: ErrorLogQuery) => Promise<ErrorLog | FailureData>
  getFrostProtection: () => Promise<FrostProtectionData>
  getHolidayMode: () => Promise<HolidayModeData>
  getTiles: ((select?: false) => Promise<TilesData<null>>) &
    (<U extends keyof typeof DeviceType>(
      select: DeviceModel<U>,
    ) => Promise<TilesData<U>>)
  getWifiReport: (hour?: number) => Promise<WifiData>
  id: number
  name: string
  setFrostProtection: ({
    enabled,
    max,
    min,
  }: {
    max: number
    min: number
    enabled?: boolean
  }) => Promise<FailureData | SuccessData>
  setHolidayMode: (({
    days,
    from,
  }: {
    days: number
    from?: string
  }) => Promise<FailureData | SuccessData>) &
    (({
      from,
      to,
    }: {
      to: string | null
      from?: string
    }) => Promise<FailureData | SuccessData>)
  setPower: (enabled?: boolean) => Promise<boolean>
}

export interface IBaseSuperDeviceFacade extends IBaseFacade {
  getAta: () => Promise<GroupAtaState>
  setAta: (state: GroupAtaState) => Promise<FailureData | SuccessData>
}

export interface IBuildingFacade extends IBaseSuperDeviceFacade {
  data: ZoneSettings
  fetch: () => Promise<ZoneSettings>
}

export interface IDeviceFacade<T extends keyof typeof DeviceType>
  extends IBaseFacade {
  data: ListDevice[T]['Device']
  fetch: () => Promise<ListDevice[T]['Device']>
  flags: Record<keyof UpdateDeviceData[T], number>
  get: () => Promise<GetDeviceData[T]>
  getEnergyReport: ({
    from,
    to,
  }: {
    from?: string
    to?: string
  }) => Promise<EnergyData[T]>
  getTiles: ((select: true | DeviceModel<T>) => Promise<TilesData<T>>) &
    ((select?: false) => Promise<TilesData<null>>)
  set: (data: UpdateDeviceData[T]) => Promise<SetDeviceData[T]>
  type: T
  values: Values[T]
}
