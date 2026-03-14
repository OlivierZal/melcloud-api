import type { HourNumbers } from 'luxon'

import type { DeviceType, Language } from '../constants.ts'
import type { ModelRegistry } from '../models/index.ts'
import type {
  Building,
  EnergyData,
  EnergyPostData,
  ErrorLogData,
  ErrorLogPostData,
  FailureData,
  FrostProtectionData,
  FrostProtectionPostData,
  GetDeviceData,
  GetDeviceDataParams,
  GetGroupData,
  GetGroupPostData,
  HolidayModeData,
  HolidayModePostData,
  LoginCredentials,
  LoginData,
  LoginPostData,
  OperationModeLogData,
  ReportData,
  ReportPostData,
  SetDeviceData,
  SetDevicePostData,
  SetGroupPostData,
  SetPowerPostData,
  SettingsParams,
  SuccessData,
  TemperatureLogPostData,
  TilesData,
  TilesPostData,
} from '../types/index.ts'

/** Configuration options for creating a MELCloud API instance. */
export interface APIConfig extends Partial<LoginCredentials> {
  /** Interval in minutes between automatic syncs. Set to `null` to disable. */
  readonly autoSyncInterval?: number | null

  /** Locale language code (e.g. `'en'`, `'fr'`). */
  readonly language?: string

  /** Custom logger for API request/response/error logging. Defaults to `console`. */
  readonly logger?: Logger

  /** Callback invoked after each sync operation completes. */
  readonly onSync?: OnSyncFunction

  /** External setting manager for persisting credentials and session data. */
  readonly settingManager?: SettingManager

  /** Whether to verify SSL certificates. Defaults to `true`. */
  readonly shouldVerifySSL?: boolean

  /** IANA timezone identifier (e.g. `'Europe/Paris'`). */
  readonly timezone?: string
}

/** Persistent settings managed by the API for session authentication. */
export interface APISettings {
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
export interface ErrorDetails {
  /** Human-readable date of the error occurrence. */
  readonly date: string

  /** Name of the device that reported the error. */
  readonly device: string

  /** Error message text. */
  readonly error: string
}

/** Parsed error log with pagination support. */
export interface ErrorLog {
  /** List of error entries, sorted in reverse chronological order. */
  readonly errors: readonly ErrorDetails[]

  /** Human-readable start date of the queried period. */
  readonly fromDateHuman: string

  /** ISO date string for the next page's start date. */
  readonly nextFromDate: string

  /** ISO date string for the next page's end date. */
  readonly nextToDate: string
}

/** Query parameters for paginating the error log. */
export interface ErrorLogQuery {
  /** Start date in ISO 8601 format. */
  readonly from?: string

  /** Number of days per page. */
  readonly limit?: string

  /** Page offset (number of pages to skip). */
  readonly offset?: string

  /** End date in ISO 8601 format. Defaults to now. */
  readonly to?: string
}

/** Full MELCloud API contract including authentication and device listing. */
export interface API extends APIAdapter {
  /** Central model registry containing all synced buildings, floors, areas, and devices. */
  readonly registry: ModelRegistry

  /** Authenticate with MELCloud using the provided or stored credentials. */
  readonly authenticate: (data?: LoginCredentials) => Promise<boolean>

  /** Cancel any pending automatic sync. */
  readonly clearSync: () => void

  /** List all buildings and their device hierarchy. */
  readonly list: () => Promise<{ data: Building[] }>

  /** Perform a login request against the MELCloud API. */
  readonly login: ({
    postData,
  }: {
    postData: LoginPostData
  }) => Promise<{ data: LoginData }>

  /** Update the user's preferred language on the MELCloud server. */
  readonly setLanguage: ({
    postData,
  }: {
    postData: { language: Language }
  }) => Promise<{ data: boolean }>

  /** Update the language if it differs from the current one. */
  readonly updateLanguage: (language: string) => Promise<void>
}

/**
 * Low-level API adapter exposing all MELCloud HTTP endpoints.
 * Methods are grouped by supported device types.
 */
export interface APIAdapter {
  /** Callback invoked after sync operations. */
  readonly onSync?: OnSyncFunction

  /**
   * Retrieve a parsed and paginated error log for the given devices.
   * Supported by all device types.
   */
  readonly errorLog: (
    query: ErrorLogQuery,
    deviceIds: number[],
  ) => Promise<ErrorLog>

  /** Fetch raw error log entries from the API. */
  readonly errors: ({
    postData,
  }: {
    postData: ErrorLogPostData
  }) => Promise<{ data: ErrorLogData[] | FailureData }>

  /** Fetch all buildings and sync the model registry. */
  readonly fetch: () => Promise<Building[]>

  /** Get frost protection settings for a building, floor, area, or device. */
  readonly frostProtection: ({
    params,
  }: {
    params: SettingsParams
  }) => Promise<{ data: FrostProtectionData }>

  /** Get holiday mode settings for a building, floor, area, or device. */
  readonly holidayMode: ({
    params,
  }: {
    params: SettingsParams
  }) => Promise<{ data: HolidayModeData }>

  /** Fetch operation mode log data for charting. */
  readonly operationModes: ({
    postData,
  }: {
    postData: ReportPostData
  }) => Promise<{ data: OperationModeLogData }>

  /** Update frost protection settings. */
  readonly setFrostProtection: ({
    postData,
  }: {
    postData: FrostProtectionPostData
  }) => Promise<{ data: FailureData | SuccessData }>

  /** Update holiday mode settings. */
  readonly setHolidayMode: ({
    postData,
  }: {
    postData: HolidayModePostData
  }) => Promise<{ data: FailureData | SuccessData }>

  /** Turn devices on or off. */
  readonly setPower: ({
    postData,
  }: {
    postData: SetPowerPostData
  }) => Promise<{ data: boolean }>

  /** Send updated device values to the API. */
  readonly setValues: <T extends DeviceType>({
    postData,
    type,
  }: {
    postData: SetDevicePostData<T>
    type: T
  }) => Promise<{ data: SetDeviceData<T> }>

  /** Fetch WiFi signal strength report. */
  readonly signal: ({
    postData,
  }: {
    postData: { devices: number | number[]; hour: HourNumbers }
  }) => Promise<{ data: ReportData }>

  /** Fetch temperature log data. */
  readonly temperatures: ({
    postData,
  }: {
    postData: TemperatureLogPostData
  }) => Promise<{ data: ReportData }>

  /** Fetch tile data for device overview. */
  readonly tiles: (({
    postData,
  }: {
    postData: TilesPostData<null>
  }) => Promise<{ data: TilesData<null> }>) &
    (<T extends DeviceType>({
      postData,
    }: {
      postData: TilesPostData<T>
    }) => Promise<{ data: TilesData<T> }>)

  /** Fetch current device data by device and building ID. */
  readonly values: <T extends DeviceType>({
    params,
  }: {
    params: GetDeviceDataParams
  }) => Promise<{ data: GetDeviceData<T> }>

  /** Fetch energy consumption report. Supported by ATA and ATW devices. */
  readonly energy: <T extends DeviceType>({
    postData,
  }: {
    postData: EnergyPostData
  }) => Promise<{ data: EnergyData<T> }>

  /** Fetch ATA device group state. ATA only. */
  readonly group: ({
    postData,
  }: {
    postData: GetGroupPostData
  }) => Promise<{ data: GetGroupData }>

  /** Update ATA device group state. ATA only. */
  readonly setGroup: ({
    postData,
  }: {
    postData: SetGroupPostData
  }) => Promise<{ data: FailureData | SuccessData }>

  /** Fetch hourly temperature report. ATW only. */
  readonly hourlyTemperatures: ({
    postData,
  }: {
    postData: { device: number; hour: HourNumbers }
  }) => Promise<{ data: ReportData }>

  /** Fetch internal temperature report. ATW only. */
  readonly internalTemperatures: ({
    postData,
  }: {
    postData: ReportPostData
  }) => Promise<{ data: ReportData }>
}

/** Logger interface for API call tracing. */
export interface Logger {
  /** Log error messages. */
  readonly error: Console['error']

  /** Log informational messages. */
  readonly log: Console['log']
}

/** External storage adapter for persisting API session settings. */
export interface SettingManager {
  /** Retrieve a setting value by key. Returns the stored value, or `null`/`undefined` if absent. */
  readonly get: (key: string) => string | null | undefined

  /** Store a setting value by key. */
  readonly set: (key: string, value: string) => void
}

/** Callback invoked after sync operations, with optional device IDs and type filter. */
export type OnSyncFunction = (params?: {
  ids?: number[]
  type?: DeviceType
}) => Promise<void>
