import type { ClassicDeviceType } from '../constants.ts'
import type {
  ApiRequestError,
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
 * Best-effort getters return `Result<T, ApiRequestError>` so callers
 * can branch on the typed failure shape (`network` / `unauthorized` /
 * `rate-limited` / `server`) instead of catching opaque exceptions.
 * The success payload is the unwrapped data — the prior `{ data }`
 * envelope was stripped at the boundary, mirroring the Home API.
 *
 * Mutations (`update*`, `login`) and sync (`fetch`) keep their
 * throw-on-failure contract — symmetric with Home's `updateValues`
 * and `list`.
 */
export interface ClassicAPIAdapter {
  /**
   * Notify any registered `events.onSyncComplete` observer that a sync
   * just landed. Routed through the lifecycle emitter so a misbehaving
   * observer cannot break the caller.
   */
  readonly notifySync: SyncCallback
  /** Fetch all buildings and sync the model registry. */
  readonly fetch: () => Promise<ClassicBuildingWithStructure[]>
  /** Fetch energy consumption report. Supported by ATA and ATW devices. */
  readonly getEnergy: <T extends ClassicDeviceType>({
    postData,
  }: {
    postData: ClassicEnergyPostData
  }) => Promise<Result<ClassicEnergyData<T>, ApiRequestError>>
  /** Fetch raw error log entries from the Classic API. */
  readonly getErrorEntries: ({
    postData,
  }: {
    postData: ClassicErrorLogPostData
  }) => Promise<
    Result<ClassicErrorLogData[] | ClassicFailureData, ApiRequestError>
  >
  /**
   * Retrieve a parsed and paginated error log for the given devices.
   * Supported by all device types.
   */
  readonly getErrorLog: (
    query: ClassicErrorLogQuery,
    deviceIds: number[],
  ) => Promise<Result<ClassicErrorLog, ApiRequestError>>
  /** Get frost protection settings for a building, floor, area, or device. */
  readonly getFrostProtection: ({
    params,
  }: {
    params: ClassicSettingsParams
  }) => Promise<Result<ClassicFrostProtectionData, ApiRequestError>>
  /** Fetch ATA device group state. ATA only. */
  readonly getGroup: ({
    postData,
  }: {
    postData: ClassicGetGroupPostData
  }) => Promise<Result<ClassicGetGroupData, ApiRequestError>>
  /** Get holiday mode settings for a building, floor, area, or device. */
  readonly getHolidayMode: ({
    params,
  }: {
    params: ClassicSettingsParams
  }) => Promise<Result<ClassicHolidayModeData, ApiRequestError>>
  /** Fetch hourly temperature report. ATW only. */
  readonly getHourlyTemperatures: ({
    postData,
  }: {
    postData: { device: number; hour: Hour }
  }) => Promise<Result<ClassicReportData, ApiRequestError>>
  /** Fetch internal temperature report. ATW only. */
  readonly getInternalTemperatures: ({
    postData,
  }: {
    postData: ClassicReportPostData
  }) => Promise<Result<ClassicReportData, ApiRequestError>>
  /** Fetch operation mode log data for charting. */
  readonly getOperationModes: ({
    postData,
  }: {
    postData: ClassicReportPostData
  }) => Promise<Result<ClassicOperationModeLogData, ApiRequestError>>
  /** Fetch WiFi signal strength report. */
  readonly getSignal: ({
    postData,
  }: {
    postData: { devices: number | number[]; hour: Hour }
  }) => Promise<Result<ClassicReportData, ApiRequestError>>
  /** Fetch temperature log data. */
  readonly getTemperatures: ({
    postData,
  }: {
    postData: ClassicTemperatureLogPostData
  }) => Promise<Result<ClassicReportData, ApiRequestError>>
  /** Fetch tile data for device overview. */
  readonly getTiles: (({
    postData,
  }: {
    postData: ClassicTilesPostData<null>
  }) => Promise<Result<ClassicTilesData<null>, ApiRequestError>>) &
    (<T extends ClassicDeviceType>({
      postData,
    }: {
      postData: ClassicTilesPostData<T>
    }) => Promise<Result<ClassicTilesData<T>, ApiRequestError>>)
  /** Fetch current device data by device and building ID. */
  readonly getValues: <T extends ClassicDeviceType>({
    params,
  }: {
    params: ClassicGetDeviceDataParams
  }) => Promise<Result<ClassicGetDeviceData<T>, ApiRequestError>>
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
