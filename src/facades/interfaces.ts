import type { HourNumbers } from 'luxon'

import type { DeviceType } from '../constants.ts'
import type {
  BaseBuildingModel,
  BaseDeviceModel,
  DeviceModel,
  DeviceModelAny,
  Model,
} from '../models/interfaces.ts'
import type { ErrorLog, ErrorLogQuery } from '../services/index.ts'
import type {
  BuildingZone,
  EnergyData,
  FailureData,
  FrostProtectionData,
  GetDeviceData,
  GroupState,
  HolidayModeData,
  ListDeviceData,
  SetDeviceData,
  SuccessData,
  TilesData,
  UpdateDeviceData,
  Zone,
  ZoneSettings,
} from '../types/index.ts'

/** Parameters for configuring frost protection temperature bounds. */
export interface FrostProtectionQuery {
  /** Maximum temperature threshold (clamped to 4–16 °C range). */
  readonly max: number

  /** Minimum temperature threshold (clamped to 4–16 °C range). */
  readonly min: number

  /** Whether frost protection is enabled. Defaults to `true`. */
  readonly enabled?: boolean
}

/** Parameters for enabling or disabling holiday mode. */
export interface HolidayModeQuery {
  /** Start date in ISO 8601 format. Defaults to now when `to` is provided. */
  readonly from?: string

  /** End date in ISO 8601 format. Omit to disable holiday mode. */
  readonly to?: string
}

/** Facade for a MELCloud building, combining zone settings with super device operations. */
export interface BuildingFacade extends BaseBuildingModel, SuperDeviceFacade {
  /** Fetch the latest building zone settings after syncing devices. */
  readonly fetch: () => Promise<ZoneSettings>
}

/** Facade for an individual MELCloud device with type-safe data access and control. */
export interface DeviceFacade<T extends DeviceType>
  extends BaseDeviceModel<T>, Facade {
  /** Bitfield flags mapping each updatable property to its effective flag value. */
  readonly flags: Record<keyof UpdateDeviceData<T>, number>

  /** Fetch the latest device data after syncing. */
  readonly fetch: () => Promise<ListDeviceData<T>>

  /** Fetch operation mode usage as pie chart data. */
  readonly operationModes: (
    query: ReportQuery,
  ) => Promise<ReportChartPieOptions>

  /** Send updated device values, clamping temperatures to valid ranges. */
  readonly setValues: (data: UpdateDeviceData<T>) => Promise<SetDeviceData<T>>

  /** Fetch temperature history as line chart data. */
  readonly temperatures: (query: ReportQuery) => Promise<ReportChartLineOptions>

  /** Fetch tile overview data, optionally selecting a specific device. */
  readonly tiles: ((select: true | DeviceModel<T>) => Promise<TilesData<T>>) &
    ((select?: false) => Promise<TilesData<null>>)

  /** Fetch current device values from the API. */
  readonly values: () => Promise<GetDeviceData<T>>

  /** Fetch energy consumption report. ATA and ATW only. */
  readonly energy: (query: ReportQuery) => Promise<EnergyData<T>>

  /** Fetch hourly temperature report. ATW only. */
  readonly hourlyTemperatures: (
    hour?: HourNumbers,
  ) => Promise<ReportChartLineOptions>

  /** Fetch internal temperature report. ATW only. */
  readonly internalTemperatures: (
    query: ReportQuery,
  ) => Promise<ReportChartLineOptions>
}

/** Base facade contract shared by all facade types (building, floor, area, device). */
export interface Facade extends Model {
  /** All devices managed by this facade. */
  readonly devices: readonly DeviceModelAny[]

  /** Retrieve the error log for all devices in this facade. */
  readonly errors: (query: ErrorLogQuery) => Promise<ErrorLog | FailureData>

  /** Get the current frost protection settings. */
  readonly frostProtection: () => Promise<FrostProtectionData>

  /** Get the current holiday mode settings. */
  readonly holidayMode: () => Promise<HolidayModeData>

  /** Trigger a sync callback for downstream consumers. */
  readonly onSync: (params?: { type?: DeviceType }) => Promise<void>

  /** Update frost protection settings with temperature clamping. */
  readonly setFrostProtection: (
    query: FrostProtectionQuery,
  ) => Promise<FailureData | SuccessData>

  /** Enable or disable holiday mode. */
  readonly setHolidayMode: (
    query: HolidayModeQuery,
  ) => Promise<FailureData | SuccessData>

  /** Turn all devices in this facade on or off. */
  readonly setPower: (value?: boolean) => Promise<boolean>

  /** Fetch WiFi signal strength report as line chart data. */
  readonly signal: (hour?: HourNumbers) => Promise<ReportChartLineOptions>

  /** Fetch tile overview data, optionally selecting a specific device. */
  readonly tiles: ((select?: false) => Promise<TilesData<null>>) &
    (<T extends DeviceType>(select: DeviceModel<T>) => Promise<TilesData<T>>)
}

/** Manager for lazily creating and caching facade instances. */
export interface FacadeManager {
  /** Get or create a facade for the given model instance. Returns `null` if no instance is provided. */
  readonly get: (instance?: Model) => Facade | null

  /** Build a hierarchical zone structure, optionally filtered by device type. */
  readonly getBuildings: (params?: { type?: DeviceType }) => BuildingZone[]

  /** Flatten the building hierarchy into a sorted list of all zones. */
  readonly getZones: (params?: { type?: DeviceType }) => Zone[]
}

/** Facade for zones (building, floor, area) that contain multiple ATA devices supporting group operations. */
export interface SuperDeviceFacade extends Facade {
  /** Get the current group state for all ATA devices. */
  readonly group: () => Promise<GroupState>

  /** Update the group state for all ATA devices. */
  readonly setGroup: (state: GroupState) => Promise<FailureData | SuccessData>
}

/** Line chart data with named series and a measurement unit. */
export interface ReportChartLineOptions extends ReportChartOptions {
  readonly series: readonly {
    readonly data: (number | null)[]
    readonly name: string
  }[]

  /** Measurement unit label (e.g. `'°C'`, `'dBm'`). */
  readonly unit: string
}

/** Base chart options with date range and formatted axis labels. */
export interface ReportChartOptions {
  /** Start date of the report period. */
  readonly from: string

  /** Formatted axis labels (dates, months, etc.). */
  readonly labels: readonly string[]

  /** End date of the report period. */
  readonly to: string
}

/** Pie chart data with labeled segments. */
export interface ReportChartPieOptions extends ReportChartOptions {
  /** Numeric values for each pie segment. */
  readonly series: number[]
}

/** Date range query for report endpoints. */
export interface ReportQuery {
  /** Start date in ISO 8601 format. Defaults to `'1970-01-01'`. */
  readonly from?: string

  /** End date in ISO 8601 format. Defaults to now. */
  readonly to?: string
}

/** Union of all device facade types. */
export type DeviceFacadeAny =
  | DeviceFacade<typeof DeviceType.Ata>
  | DeviceFacade<typeof DeviceType.Atw>
  | DeviceFacade<typeof DeviceType.Erv>
