import type { HourNumbers } from 'luxon'

import type { ClassicDeviceType } from '../constants.ts'
import type {
  ClassicBuildingWithStructure,
  ClassicEnergyData,
  ClassicEnergyPostData,
  ClassicErrorLogData,
  ClassicErrorLogPostData,
  ClassicFailureData,
  ClassicFrostProtectionData,
  ClassicFrostProtectionPostData,
  ClassicGetDeviceData,
  ClassicGetDeviceDataParams,
  ClassicGetGroupData,
  ClassicGetGroupPostData,
  ClassicHolidayModeData,
  ClassicHolidayModePostData,
  ClassicOperationModeLogData,
  ClassicReportData,
  ClassicReportPostData,
  ClassicSetDeviceData,
  ClassicSetDevicePostData,
  ClassicSetGroupPostData,
  ClassicSetPowerPostData,
  ClassicSettingsParams,
  ClassicSuccessData,
  ClassicTemperatureLogPostData,
  ClassicTilesData,
  ClassicTilesPostData,
} from '../types/index.ts'
import type { BaseAPIConfig, SyncCallback } from './interfaces.ts'

/**
 * Low-level API adapter exposing all MELCloud HTTP endpoints.
 * Methods are grouped by supported device types.
 */
export interface ClassicAPIAdapter {
  /** Callback invoked after sync operations. */
  readonly onSync?: SyncCallback
  /** Fetch all buildings and sync the model registry. */
  readonly fetch: () => Promise<ClassicBuildingWithStructure[]>
  /** Fetch energy consumption report. Supported by ATA and ATW devices. */
  readonly getEnergy: <T extends ClassicDeviceType>({
    postData,
  }: {
    postData: ClassicEnergyPostData
  }) => Promise<{ data: ClassicEnergyData<T> }>
  /** Fetch raw error log entries from the Classic API. */
  readonly getErrorEntries: ({
    postData,
  }: {
    postData: ClassicErrorLogPostData
  }) => Promise<{ data: ClassicErrorLogData[] | ClassicFailureData }>
  /**
   * Retrieve a parsed and paginated error log for the given devices.
   * Supported by all device types.
   */
  readonly getErrorLog: (
    query: ClassicErrorLogQuery,
    deviceIds: number[],
  ) => Promise<ClassicErrorLog>
  /** Get frost protection settings for a building, floor, area, or device. */
  readonly getFrostProtection: ({
    params,
  }: {
    params: ClassicSettingsParams
  }) => Promise<{ data: ClassicFrostProtectionData }>
  /** Fetch ATA device group state. ATA only. */
  readonly getGroup: ({
    postData,
  }: {
    postData: ClassicGetGroupPostData
  }) => Promise<{ data: ClassicGetGroupData }>
  /** Get holiday mode settings for a building, floor, area, or device. */
  readonly getHolidayMode: ({
    params,
  }: {
    params: ClassicSettingsParams
  }) => Promise<{ data: ClassicHolidayModeData }>
  /** Fetch hourly temperature report. ATW only. */
  readonly getHourlyTemperatures: ({
    postData,
  }: {
    postData: { device: number; hour: HourNumbers }
  }) => Promise<{ data: ClassicReportData }>
  /** Fetch internal temperature report. ATW only. */
  readonly getInternalTemperatures: ({
    postData,
  }: {
    postData: ClassicReportPostData
  }) => Promise<{ data: ClassicReportData }>
  /** Fetch operation mode log data for charting. */
  readonly getOperationModes: ({
    postData,
  }: {
    postData: ClassicReportPostData
  }) => Promise<{ data: ClassicOperationModeLogData }>
  /** Fetch WiFi signal strength report. */
  readonly getSignal: ({
    postData,
  }: {
    postData: { devices: number | number[]; hour: HourNumbers }
  }) => Promise<{ data: ClassicReportData }>
  /** Fetch temperature log data. */
  readonly getTemperatures: ({
    postData,
  }: {
    postData: ClassicTemperatureLogPostData
  }) => Promise<{ data: ClassicReportData }>
  /** Fetch tile data for device overview. */
  readonly getTiles: (({
    postData,
  }: {
    postData: ClassicTilesPostData<null>
  }) => Promise<{ data: ClassicTilesData<null> }>) &
    (<T extends ClassicDeviceType>({
      postData,
    }: {
      postData: ClassicTilesPostData<T>
    }) => Promise<{ data: ClassicTilesData<T> }>)
  /** Fetch current device data by device and building ID. */
  readonly getValues: <T extends ClassicDeviceType>({
    params,
  }: {
    params: ClassicGetDeviceDataParams
  }) => Promise<{ data: ClassicGetDeviceData<T> }>
  /** Update frost protection settings. */
  readonly updateFrostProtection: ({
    postData,
  }: {
    postData: ClassicFrostProtectionPostData
  }) => Promise<{ data: ClassicFailureData | ClassicSuccessData }>
  /** Update ATA device group state. ATA only. */
  readonly updateGroupState: ({
    postData,
  }: {
    postData: ClassicSetGroupPostData
  }) => Promise<{ data: ClassicFailureData | ClassicSuccessData }>
  /** Update holiday mode settings. */
  readonly updateHolidayMode: ({
    postData,
  }: {
    postData: ClassicHolidayModePostData
  }) => Promise<{ data: ClassicFailureData | ClassicSuccessData }>
  /** Turn devices on or off. */
  readonly updatePower: ({
    postData,
  }: {
    postData: ClassicSetPowerPostData
  }) => Promise<{ data: boolean }>
  /** Send updated device values to the Classic API. */
  readonly updateValues: <T extends ClassicDeviceType>({
    postData,
    type,
  }: {
    postData: ClassicSetDevicePostData<T>
    type: T
  }) => Promise<{ data: ClassicSetDeviceData<T> }>
}

/** Configuration options for creating a MELCloud Classic API instance. */
export interface ClassicAPIConfig extends BaseAPIConfig {
  /** Locale language code (e.g. `'en'`, `'fr'`). */
  readonly language?: string
  /** Whether to verify SSL certificates. Defaults to `true`. */
  readonly shouldVerifySSL?: boolean
  /** IANA timezone identifier (e.g. `'Europe/Paris'`). */
  readonly timezone?: string
}

/** Persistent settings managed by the Classic API for session authentication. */
export interface ClassicAPISettings {
  /** MELCloud session context key. */
  readonly contextKey?: string | null
  /** Session expiry timestamp in ISO 8601 format. */
  readonly expiry?: string | null
  /** MELCloud account password. */
  readonly password?: string | null
  /** MELCloud account username (email). */
  readonly username?: string | null
}

/** A single error entry from the device error log. */
export interface ClassicErrorDetails {
  /** ISO 8601 date of the error occurrence. */
  readonly date: string
  /** Numeric ID of the device that reported the error. */
  readonly deviceId: number
  /** Error message text. */
  readonly error: string
}

/** Parsed error log with pagination support. */
export interface ClassicErrorLog {
  /** List of error entries, sorted in reverse chronological order. */
  readonly errors: readonly ClassicErrorDetails[]
  /** ISO date string for the queried period start. */
  readonly fromDate: string
  /** ISO date string for the next page's start date. */
  readonly nextFromDate: string
  /** ISO date string for the next page's end date. */
  readonly nextToDate: string
}

/** Query parameters for paginating the error log. */
export interface ClassicErrorLogQuery {
  /** Start date in ISO 8601 format. */
  readonly from?: string
  /** Number of days per page. */
  readonly limit?: string
  /** Page offset (number of pages to skip). */
  readonly offset?: string
  /** End date in ISO 8601 format. Defaults to now. */
  readonly to?: string
}
