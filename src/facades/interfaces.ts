import type { HourNumbers } from 'luxon'

import type { ErrorLog, ErrorLogQuery } from '../api/index.ts'
import type {
  BaseBuilding,
  BaseDevice,
  ClassicDevice,
  DeviceAny,
  Identifiable,
} from '../entities/index.ts'
import type {
  EnergyData,
  FailureData,
  FrostProtectionData,
  GetDeviceData,
  GroupState,
  HolidayModeData,
  HotWaterState,
  ListDeviceData,
  SetDeviceData,
  SuccessData,
  TilesData,
  UpdateDeviceData,
  ZoneSettings,
  ZoneState,
} from '../types/index.ts'
import { ClassicDeviceType } from '../constants.ts'

/** Parameters for configuring frost protection temperature bounds. */
export interface FrostProtectionQuery {
  /** Maximum temperature threshold (clamped to 4–16 °C range). */
  readonly max: number

  /** Minimum temperature threshold (clamped to 4–16 °C range). */
  readonly min: number

  /** Whether frost protection is enabled. Defaults to `true`. */
  readonly isEnabled?: boolean
}

/** Parameters for enabling or disabling holiday mode. */
export interface HolidayModeQuery {
  /** Start date in ISO 8601 format. Defaults to now when `to` is provided. */
  readonly from?: string

  /** End date in ISO 8601 format. Omit to disable holiday mode. */
  readonly to?: string
}

/** Facade for a MELCloud building, combining zone settings with super device operations. */
export interface BuildingFacade extends BaseBuilding, ZoneFacade {
  /** Fetch the latest building zone settings after syncing devices. */
  readonly fetch: () => Promise<ZoneSettings>
}

/** Facade for Air-to-Water (ATW) devices with hot water and zone state access. */
export interface ClassicDeviceAtwFacade extends DeviceFacade<
  typeof ClassicDeviceType.Atw
> {
  /** Current hot water state. */
  readonly hotWater: HotWaterState

  /** Current zone 1 state. */
  readonly zone1: ZoneState
}

/** Facade for ATW devices with two heating/cooling zones. */
export interface ClassicDeviceAtwHasZone2Facade extends ClassicDeviceAtwFacade {
  /** Current zone 2 state. */
  readonly zone2: ZoneState
}

/** Facade for an individual MELCloud device with type-safe data access and control. */
export interface DeviceFacade<T extends ClassicDeviceType>
  extends BaseDevice<T>, Facade {
  /** Bitfield flags mapping each updatable property to its effective flag value. */
  readonly flags: Record<keyof UpdateDeviceData<T>, number>

  /** Fetch the latest device data after syncing. */
  readonly fetch: () => Promise<ListDeviceData<T>>

  /** Fetch operation mode usage as pie chart data. */
  readonly getOperationModes: (
    query: ReportQuery,
  ) => Promise<ReportChartPieOptions>

  /** Send updated device values, clamping temperatures to valid ranges. */
  readonly updateValues: (
    data: UpdateDeviceData<T>,
  ) => Promise<SetDeviceData<T>>

  /** Fetch temperature history as line chart data. */
  readonly getTemperatures: (
    query: ReportQuery,
  ) => Promise<ReportChartLineOptions>

  /** Fetch tile overview data, optionally selecting a specific device. */
  readonly getTiles: ((device: true | DeviceAny) => Promise<TilesData<T>>) &
    ((device?: false) => Promise<TilesData<null>>)

  /** Fetch current device values from the Classic API. */
  readonly getValues: () => Promise<GetDeviceData<T>>

  /** Fetch energy consumption report. ATA and ATW only. */
  readonly getEnergy: (query: ReportQuery) => Promise<EnergyData<T>>

  /** Fetch hourly temperature report. ATW only. */
  readonly getHourlyTemperatures: (
    hour?: HourNumbers,
  ) => Promise<ReportChartLineOptions>

  /** Fetch internal temperature report. ATW only. */
  readonly getInternalTemperatures: (
    query: ReportQuery,
  ) => Promise<ReportChartLineOptions>
}

/** Base facade contract shared by all facade types (building, floor, area, device). */
export interface Facade extends Identifiable {
  /** All devices managed by this facade. */
  readonly devices: readonly DeviceAny[]

  /**
   * Whether the underlying entity still exists in the registry.
   * Non-throwing staleness check — see {@link EntityNotFoundError} for the
   * throwing counterpart surfaced by other accessors.
   */
  readonly exists: boolean

  /** Retrieve the error log for all devices in this facade. */
  readonly getErrorLog: (
    query: ErrorLogQuery,
  ) => Promise<ErrorLog | FailureData>

  /** Get the current frost protection settings. */
  readonly getFrostProtection: () => Promise<FrostProtectionData>

  /** Get the current holiday mode settings. */
  readonly getHolidayMode: () => Promise<HolidayModeData>

  /** Trigger a sync callback for downstream consumers. */
  readonly notifySync: (params?: { type?: ClassicDeviceType }) => Promise<void>

  /** Update frost protection settings with temperature clamping. */
  readonly updateFrostProtection: (
    query: FrostProtectionQuery,
  ) => Promise<FailureData | SuccessData>

  /** Enable or disable holiday mode. */
  readonly updateHolidayMode: (
    query: HolidayModeQuery,
  ) => Promise<FailureData | SuccessData>

  /** Turn all devices in this facade on or off. */
  readonly updatePower: (value?: boolean) => Promise<boolean>

  /** Fetch WiFi signal strength report as line chart data. */
  readonly getSignalStrength: (
    hour?: HourNumbers,
  ) => Promise<ReportChartLineOptions>

  /** Fetch tile overview data, optionally selecting a specific device. */
  readonly getTiles: ((device?: false) => Promise<TilesData<null>>) &
    (<T extends ClassicDeviceType>(
      device: ClassicDevice<T>,
    ) => Promise<TilesData<T>>)
}

/** Facade for zones (building, floor, area) that contain multiple ATA devices supporting group operations. */
export interface ZoneFacade extends Facade {
  /** Get the current group state for all ATA devices. */
  readonly getGroup: () => Promise<GroupState>

  /** Update the group state for all ATA devices. */
  readonly updateGroupState: (
    state: GroupState,
  ) => Promise<FailureData | SuccessData>
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
  | ClassicDeviceAtwFacade
  | ClassicDeviceAtwHasZone2Facade
  | DeviceFacade<typeof ClassicDeviceType.Ata>
  | DeviceFacade<typeof ClassicDeviceType.Erv>

/**
 * Type guard that narrows a device facade to the ATA variant.
 * @param facade - The device facade to check.
 * @returns Whether the facade is an ATA facade.
 */
export const isAtaFacade = (
  facade: DeviceFacade<ClassicDeviceType>,
): facade is DeviceFacade<typeof ClassicDeviceType.Ata> =>
  facade.type === ClassicDeviceType.Ata

/**
 * Type guard that narrows a device facade to the ATW variant.
 * Allows consumers to safely access `hotWater` and `zone1` without type assertions.
 * @param facade - The device facade to check.
 * @returns Whether the facade is an ATW facade.
 */
export const isAtwFacade = (
  facade: DeviceFacade<ClassicDeviceType>,
): facade is ClassicDeviceAtwFacade => facade.type === ClassicDeviceType.Atw

/**
 * Type guard that narrows a device facade to the ERV variant.
 * @param facade - The device facade to check.
 * @returns Whether the facade is an ERV facade.
 */
export const isErvFacade = (
  facade: DeviceFacade<ClassicDeviceType>,
): facade is DeviceFacade<typeof ClassicDeviceType.Erv> =>
  facade.type === ClassicDeviceType.Erv

/**
 * Type guard that narrows an ATW facade to the zone 2 variant.
 * Allows consumers to safely access `zone2` without type assertions.
 * @param facade - The ATW device facade to check.
 * @returns Whether the facade supports zone 2.
 */
export const hasZone2 = (
  facade: ClassicDeviceAtwFacade,
): facade is ClassicDeviceAtwHasZone2Facade => 'zone2' in facade
