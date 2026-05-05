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
  Hour,
  Result,
} from '../types/index.ts'
import type { BaseAPIConfig, SyncCallback } from './types.ts'

/**
 * Low-level API adapter exposing all MELCloud HTTP endpoints.
 * Methods are grouped by supported device types.
 *
 * Best-effort getters return `Result<T>` so callers can branch on the
 * typed failure shape (`network` / `unauthorized` / `rate-limited` /
 * `server`) instead of catching opaque exceptions.
 *
 * Mutations (`update*`, `login`) and sync (`fetch`) keep their
 * throw-on-failure contract — symmetric with Home's `updateValues`
 * and `list`.
 *
 * Every method returns the unwrapped payload (no `{ data }` wrapper).
 * Transport metadata (status, headers) lives inside the SDK on
 * `request<T>()`; consumers don't see it. This is the resource-focused
 * convention (Stripe, Linear) — applied uniformly across both Classic
 * and Home so the public surface is symmetric.
 * @category Configuration
 */
export interface ClassicAPIAdapter {
  /**
   * Notify any registered `events.onSyncComplete` observer that a sync
   * just landed. Routed through the lifecycle emitter so a misbehaving
   * observer cannot break the caller.
   */
  readonly notifySync: SyncCallback
  /** Luxon zone read by facades to interpret offset-less ISO strings in the user's zone. */
  readonly timezone?: string
  /** Fetch all buildings and sync the model registry. */
  readonly fetch: () => Promise<ClassicBuildingWithStructure[]>
  /** Fetch energy consumption report. Supported by ATA and ATW devices. */
  readonly getEnergy: <T extends ClassicDeviceType>({
    postData,
  }: {
    postData: ClassicEnergyPostData
  }) => Promise<Result<ClassicEnergyData<T>>>
  /** Fetch raw error log entries from the Classic API. */
  readonly getErrorEntries: ({
    postData,
  }: {
    postData: ClassicErrorLogPostData
  }) => Promise<Result<ClassicErrorLogData[] | ClassicFailureData>>
  /**
   * Retrieve a parsed and paginated error log for the given devices.
   * Supported by all device types.
   */
  readonly getErrorLog: (
    query: ClassicErrorLogQuery,
    deviceIds: number[],
  ) => Promise<Result<ClassicErrorLog>>
  /** Get frost protection settings for a building, floor, area, or device. */
  readonly getFrostProtection: ({
    params,
  }: {
    params: ClassicSettingsParams
  }) => Promise<Result<ClassicFrostProtectionData>>
  /** Fetch ATA device group state. ATA only. */
  readonly getGroup: ({
    postData,
  }: {
    postData: ClassicGetGroupPostData
  }) => Promise<Result<ClassicGetGroupData>>
  /** Get holiday mode settings for a building, floor, area, or device. */
  readonly getHolidayMode: ({
    params,
  }: {
    params: ClassicSettingsParams
  }) => Promise<Result<ClassicHolidayModeData>>
  /** Fetch hourly temperature report. ATW only. */
  readonly getHourlyTemperatures: ({
    postData,
  }: {
    postData: { device: number; hour: Hour }
  }) => Promise<Result<ClassicReportData>>
  /** Fetch internal temperature report. ATW only. */
  readonly getInternalTemperatures: ({
    postData,
  }: {
    postData: ClassicReportPostData
  }) => Promise<Result<ClassicReportData>>
  /** Fetch operation mode log data for charting. */
  readonly getOperationModes: ({
    postData,
  }: {
    postData: ClassicReportPostData
  }) => Promise<Result<ClassicOperationModeLogData>>
  /** Fetch WiFi signal strength report. */
  readonly getSignal: ({
    postData,
  }: {
    postData: { devices: number | number[]; hour: Hour }
  }) => Promise<Result<ClassicReportData>>
  /** Fetch temperature log data. */
  readonly getTemperatures: ({
    postData,
  }: {
    postData: ClassicTemperatureLogPostData
  }) => Promise<Result<ClassicReportData>>
  /** Fetch tile data for device overview. */
  readonly getTiles: (({
    postData,
  }: {
    postData: ClassicTilesPostData<null>
  }) => Promise<Result<ClassicTilesData<null>>>) &
    (<T extends ClassicDeviceType>({
      postData,
    }: {
      postData: ClassicTilesPostData<T>
    }) => Promise<Result<ClassicTilesData<T>>>)
  /** Fetch current device data by device and building ID. */
  readonly getValues: <T extends ClassicDeviceType>({
    params,
  }: {
    params: ClassicGetDeviceDataParams
  }) => Promise<Result<ClassicGetDeviceData<T>>>
  /** Update frost protection settings. */
  readonly updateFrostProtection: ({
    postData,
  }: {
    postData: ClassicFrostProtectionPostData
  }) => Promise<ClassicFailureData | ClassicSuccessData>
  /** Update ATA device group state. ATA only. */
  readonly updateGroupState: ({
    postData,
  }: {
    postData: ClassicSetGroupPostData
  }) => Promise<ClassicFailureData | ClassicSuccessData>
  /** Update holiday mode settings. */
  readonly updateHolidayMode: ({
    postData,
  }: {
    postData: ClassicHolidayModePostData
  }) => Promise<ClassicFailureData | ClassicSuccessData>
  /** Turn devices on or off. */
  readonly updatePower: ({
    postData,
  }: {
    postData: ClassicSetPowerPostData
  }) => Promise<boolean>
  /** Send updated device values to the Classic API. */
  readonly updateValues: <T extends ClassicDeviceType>({
    postData,
    type,
  }: {
    postData: ClassicSetDevicePostData<T>
    type: T
  }) => Promise<ClassicSetDeviceData<T>>
}

/**
 * Configuration options for creating a MELCloud Classic API instance.
 * @category Configuration
 */
export interface ClassicAPIConfig extends BaseAPIConfig {
  /** Locale language code (e.g. `'en'`, `'fr'`). */
  readonly language?: string
  /** Whether to verify SSL certificates. Defaults to `true`. */
  readonly shouldVerifySSL?: boolean
  /** IANA timezone identifier (e.g. `'Europe/Paris'`). */
  readonly timezone?: string
}

/**
 * Persistent settings managed by the Classic API for session authentication.
 * @category Configuration
 */
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

/**
 * A single error entry from the device error log.
 * @category Configuration
 */
export interface ClassicErrorDetails {
  /** ISO 8601 date of the error occurrence. */
  readonly date: string
  /** Numeric ID of the device that reported the error. */
  readonly deviceId: number
  /** Error message text. */
  readonly error: string
}

/**
 * Parsed error log with pagination support.
 * @category Configuration
 */
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

/**
 * Query parameters for paginating the error log.
 * @category Configuration
 */
export interface ClassicErrorLogQuery {
  /**
   * Start date in ISO 8601 format. When set, the query is pinned to that
   * single day; `offset` is ignored and `period` only shapes
   * `nextFromDate` for chained pagination.
   */
  readonly from?: string
  /**
   * Page offset, in `period`-sized windows. `0` (default) is the most
   * recent window; `1` is the previous, etc. Pages are separated by a
   * one-day boundary so consecutive pages don't overlap.
   */
  readonly offset?: number
  /** Number of days per page. Defaults to `1`. */
  readonly period?: number
  /** End date in ISO 8601 format. Defaults to now. */
  readonly to?: string
}
