import type {
  ClassicErrorLog,
  ClassicErrorLogQuery,
} from '../api/classic-interfaces.ts'
import type { ClassicDevice } from '../entities/classic-device.ts'
import type {
  ClassicBaseBuilding,
  ClassicBaseDevice,
  ClassicDeviceAny,
} from '../entities/classic-interfaces.ts'
import type { Identifiable } from '../entities/interfaces.ts'
import type {
  ClassicEnergyData,
  ClassicFailureData,
  ClassicFrostProtectionData,
  ClassicGetDeviceData,
  ClassicGroupState,
  ClassicHolidayModeData,
  ClassicHotWaterState,
  ClassicHour,
  ClassicListDeviceData,
  ClassicSetDeviceData,
  ClassicSuccessData,
  ClassicTilesData,
  ClassicUpdateDeviceData,
  ClassicZoneSettings,
  ClassicZoneState,
} from '../types/index.ts'
import { ClassicDeviceType } from '../constants.ts'
import type {
  ReportChartLineOptions,
  ReportChartPieOptions,
  ReportQuery,
} from './interfaces.ts'

/** Facade for a MELCloud building, combining zone settings with super device operations. */
export interface ClassicBuildingFacade
  extends ClassicBaseBuilding, ClassicZoneFacade {
  /** Fetch the latest building zone settings after syncing devices. */
  readonly fetch: () => Promise<ClassicZoneSettings>
}

/** Facade for Air-to-Water (ATW) devices with hot water and zone state access. */
export interface ClassicDeviceAtwFacade extends ClassicDeviceFacade<
  typeof ClassicDeviceType.Atw
> {
  /** Current hot water state. */
  readonly hotWater: ClassicHotWaterState
  /** Current zone 1 state. */
  readonly zone1: ClassicZoneState
}

/** Facade for ATW devices with two heating/cooling zones. */
export interface ClassicDeviceAtwHasZone2Facade extends ClassicDeviceAtwFacade {
  /** Current zone 2 state. */
  readonly zone2: ClassicZoneState
}

/** Facade for an individual MELCloud device with type-safe data access and control. */
export interface ClassicDeviceFacade<T extends ClassicDeviceType>
  extends ClassicBaseDevice<T>, ClassicFacade {
  /** Bitfield flags mapping each updatable property to its effective flag value. */
  readonly flags: Record<keyof ClassicUpdateDeviceData<T>, number>
  /** Fetch the latest device data after syncing. */
  readonly fetch: () => Promise<Readonly<ClassicListDeviceData<T>>>
  /** Fetch energy consumption report. ATA and ATW only. */
  readonly getEnergy: (query: ReportQuery) => Promise<ClassicEnergyData<T>>
  /** Fetch hourly temperature report. ATW only. */
  readonly getHourlyTemperatures: (
    hour?: ClassicHour,
  ) => Promise<ReportChartLineOptions>
  /** Fetch internal temperature report. ATW only. */
  readonly getInternalTemperatures: (
    query: ReportQuery,
  ) => Promise<ReportChartLineOptions>
  /** Fetch operation mode usage as pie chart data. */
  readonly getOperationModes: (
    query: ReportQuery,
  ) => Promise<ReportChartPieOptions>
  /** Fetch temperature history as line chart data. */
  readonly getTemperatures: (
    query: ReportQuery,
  ) => Promise<ReportChartLineOptions>
  /** Fetch tile overview data, optionally selecting a specific device. */
  readonly getTiles: ((
    device: true | ClassicDeviceAny,
  ) => Promise<ClassicTilesData<T>>) &
    ((device?: false) => Promise<ClassicTilesData<null>>)
  /** Fetch current device values from the Classic API. */
  readonly getValues: () => Promise<ClassicGetDeviceData<T>>
  /** Send updated device values, clamping temperatures to valid ranges. */
  readonly updateValues: (
    data: ClassicUpdateDeviceData<T>,
  ) => Promise<ClassicSetDeviceData<T>>
}

/** Union of all device facade types. */
export type ClassicDeviceFacadeAny =
  | ClassicDeviceAtwFacade
  | ClassicDeviceAtwHasZone2Facade
  | ClassicDeviceFacade<typeof ClassicDeviceType.Ata>
  | ClassicDeviceFacade<typeof ClassicDeviceType.Erv>

/** Base facade contract shared by all facade types (building, floor, area, device). */
export interface ClassicFacade extends Identifiable {
  /** All devices managed by this facade. */
  readonly devices: readonly ClassicDeviceAny[]
  /**
   * Whether the underlying entity still exists in the registry.
   * Non-throwing staleness check — see {@link EntityNotFoundError} for the
   * throwing counterpart surfaced by other accessors.
   */
  readonly exists: boolean
  /** Retrieve the error log for all devices in this facade. */
  readonly getErrorLog: (
    query: ClassicErrorLogQuery,
  ) => Promise<ClassicErrorLog | ClassicFailureData>
  /** Get the current frost protection settings. */
  readonly getFrostProtection: () => Promise<ClassicFrostProtectionData>
  /** Get the current holiday mode settings. */
  readonly getHolidayMode: () => Promise<ClassicHolidayModeData>
  /** Fetch WiFi signal strength report as line chart data. */
  readonly getSignalStrength: (
    hour?: ClassicHour,
  ) => Promise<ReportChartLineOptions>
  /** Fetch tile overview data, optionally selecting a specific device. */
  readonly getTiles: ((device?: false) => Promise<ClassicTilesData<null>>) &
    (<T extends ClassicDeviceType>(
      device: ClassicDevice<T>,
    ) => Promise<ClassicTilesData<T>>)
  /** Trigger a sync callback for downstream consumers. */
  readonly notifySync: (params?: { type?: ClassicDeviceType }) => Promise<void>
  /** Update frost protection settings with temperature clamping. */
  readonly updateFrostProtection: (
    query: ClassicFrostProtectionQuery,
  ) => Promise<ClassicFailureData | ClassicSuccessData>
  /** Enable or disable holiday mode. */
  readonly updateHolidayMode: (
    query: ClassicHolidayModeQuery,
  ) => Promise<ClassicFailureData | ClassicSuccessData>
  /** Turn all devices in this facade on or off. */
  readonly updatePower: (value?: boolean) => Promise<boolean>
}

/** Parameters for configuring frost protection temperature bounds. */
export interface ClassicFrostProtectionQuery {
  /** Maximum temperature threshold (clamped to 4–16 °C range). */
  readonly max: number
  /** Minimum temperature threshold (clamped to 4–16 °C range). */
  readonly min: number
  /** Whether frost protection is enabled. Defaults to `true`. */
  readonly isEnabled?: boolean
}

/** Parameters for enabling or disabling holiday mode. */
export interface ClassicHolidayModeQuery {
  /** Start date in ISO 8601 format. Defaults to now when `to` is provided. */
  readonly from?: string
  /** End date in ISO 8601 format. Omit to disable holiday mode. */
  readonly to?: string
}

/** Facade for zones (building, floor, area) that contain multiple ATA devices supporting group operations. */
export interface ClassicZoneFacade extends ClassicFacade {
  /** Get the current group state for all ATA devices. */
  readonly getGroup: () => Promise<ClassicGroupState>
  /** Update the group state for all ATA devices. */
  readonly updateGroupState: (
    state: ClassicGroupState,
  ) => Promise<ClassicFailureData | ClassicSuccessData>
}

/**
 * Type guard that narrows a device facade to the ATA variant.
 * @param facade - The device facade to check.
 * @returns Whether the facade is an ATA facade.
 */
export const isClassicAtaFacade = (
  facade: ClassicDeviceFacade<ClassicDeviceType>,
): facade is ClassicDeviceFacade<typeof ClassicDeviceType.Ata> =>
  facade.type === ClassicDeviceType.Ata

/**
 * Type guard that narrows a device facade to the ATW variant.
 * Allows consumers to safely access `hotWater` and `zone1` without type assertions.
 * @param facade - The device facade to check.
 * @returns Whether the facade is an ATW facade.
 */
export const isClassicAtwFacade = (
  facade: ClassicDeviceFacade<ClassicDeviceType>,
): facade is ClassicDeviceAtwFacade => facade.type === ClassicDeviceType.Atw

/**
 * Type guard that narrows a device facade to the ERV variant.
 * @param facade - The device facade to check.
 * @returns Whether the facade is an ERV facade.
 */
export const isClassicErvFacade = (
  facade: ClassicDeviceFacade<ClassicDeviceType>,
): facade is ClassicDeviceFacade<typeof ClassicDeviceType.Erv> =>
  facade.type === ClassicDeviceType.Erv

/**
 * Type guard that narrows an ATW facade to the zone 2 variant.
 * Allows consumers to safely access `zone2` without type assertions.
 * @param facade - The ATW device facade to check.
 * @returns Whether the facade supports zone 2.
 */
export const hasClassicZone2 = (
  facade: ClassicDeviceAtwFacade,
): facade is ClassicDeviceAtwHasZone2Facade => 'zone2' in facade
