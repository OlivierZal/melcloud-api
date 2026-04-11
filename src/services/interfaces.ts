import type { HourNumbers } from 'luxon'

import type { DeviceType } from '../constants.ts'
import type { ModelRegistry } from '../models/index.ts'
import type {
  BuildingWithStructure,
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
  HomeAtaValues,
  HomeBuilding,
  HomeEnergyData,
  HomeErrorLogEntry,
  HomeReportData,
  HomeUser,
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
import type { HomeDeviceRegistry } from './home-device-registry.ts'

/** Common configuration shared by all API clients. */
export interface BaseAPIConfig extends Partial<LoginCredentials> {
  /** Interval in minutes between automatic syncs. Set to `null` to disable. */
  readonly autoSyncInterval?: number | null

  /** Custom logger. Defaults to `console`. */
  readonly logger?: Logger

  /** Callback invoked after sync operations. */
  readonly onSync?: OnSyncFunction

  /**
   * Maximum time in milliseconds for a single HTTP request before
   * axios aborts it. Defaults to 30 000 ms (30 s). Set to `0` to
   * disable the timeout (not recommended).
   */
  readonly requestTimeout?: number

  /** External setting manager for persisting credentials and session data. */
  readonly settingManager?: SettingManager
}

/** Configuration options for the MELCloud Home API. */
export interface HomeAPIConfig extends BaseAPIConfig {
  /** Base URL of the MELCloud Home BFF server. */
  readonly baseURL?: string
}

/** Configuration options for creating a MELCloud API instance. */
export interface APIConfig extends BaseAPIConfig {
  /** Locale language code (e.g. `'en'`, `'fr'`). */
  readonly language?: string

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

/** Persistent settings managed by the Home API for session authentication. */
export interface HomeAPISettings {
  /** Serialized tough-cookie CookieJar (JSON). */
  readonly cookies?: string | null

  /** Session expiry timestamp in ISO 8601 format. */
  readonly expiry?: string | null

  /** MELCloud Home account password. */
  readonly password?: string | null

  /** MELCloud Home account username (email). */
  readonly username?: string | null
}

/** A single error entry from the device error log. */
export interface ErrorDetails {
  /** ISO 8601 date of the error occurrence. */
  readonly date: string

  /** Numeric ID of the device that reported the error. */
  readonly deviceId: number

  /** Error message text. */
  readonly error: string
}

/** Parsed error log with pagination support. */
export interface ErrorLog {
  /** List of error entries, sorted in reverse chronological order. */
  readonly errors: readonly ErrorDetails[]

  /** ISO date string for the queried period start. */
  readonly fromDate: string

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

/** MELCloud Home API contract. */
export interface HomeAPI {
  /** Device registry with stable model references across syncs. */
  readonly registry: HomeDeviceRegistry

  /** The currently authenticated user, or `null`. */
  readonly user: HomeUser | null

  /** Authenticate with MELCloud Home using the provided or stored credentials. */
  readonly authenticate: (data?: LoginCredentials) => Promise<boolean>

  /** Cancel any pending automatic sync. */
  readonly clearSync: () => void

  /** Fetch energy consumption data for a device. */
  readonly getEnergy: (
    id: string,
    params: { from: string; interval: string; to: string },
  ) => Promise<HomeEnergyData | null>

  /** Fetch the error log for a device. */
  readonly getErrorLog: (id: string) => Promise<HomeErrorLogEntry[]>

  /** Fetch WiFi signal strength (RSSI) telemetry for a device. */
  readonly getSignal: (
    id: string,
    params: { from: string; to: string },
  ) => Promise<HomeEnergyData | null>

  /** Fetch temperature trend summary for a device. */
  readonly getTemperatures: (
    id: string,
    params: { from: string; period: string; to: string },
  ) => Promise<HomeReportData[] | null>

  /** Fetch the current user's claims from the BFF. Returns `null` on failure. */
  readonly getUser: () => Promise<HomeUser | null>

  /** Whether a user is currently authenticated (session cookie valid). */
  readonly isAuthenticated: () => boolean

  /** Fetch all buildings and sync the device registry. */
  readonly list: () => Promise<HomeBuilding[]>

  /** Update the automatic sync interval and reschedule. Set to `0` or `null` to disable. */
  readonly setSyncInterval: (minutes: number | null) => void

  /** Update device values and refresh device data via list(). */
  readonly setValues: (id: string, values: HomeAtaValues) => Promise<boolean>
}

/** Full MELCloud API contract including authentication and device listing. */
export interface API extends APIAdapter {
  /** Central model registry containing all synced buildings, floors, areas, and devices. */
  readonly registry: ModelRegistry

  /** Authenticate with MELCloud using the provided or stored credentials. */
  readonly authenticate: (data?: LoginCredentials) => Promise<boolean>

  /** Cancel any pending automatic sync. */
  readonly clearSync: () => void

  /** Whether a user is currently authenticated (context key valid). */
  readonly isAuthenticated: () => boolean

  /** List all buildings and their device hierarchy. */
  readonly list: () => Promise<{ data: BuildingWithStructure[] }>

  /** Perform a login request against the MELCloud API. */
  readonly login: ({
    postData,
  }: {
    postData: LoginPostData
  }) => Promise<{ data: LoginData }>

  /** Update the user's language on the server if it differs from the current locale. */
  readonly setLanguage: (language: string) => Promise<void>

  /** Update the automatic sync interval and reschedule. Set to `0` or `null` to disable. */
  readonly setSyncInterval: (minutes: number | null) => void
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
  readonly getErrorLog: (
    query: ErrorLogQuery,
    deviceIds: number[],
  ) => Promise<ErrorLog>

  /** Fetch raw error log entries from the API. */
  readonly getErrorEntries: ({
    postData,
  }: {
    postData: ErrorLogPostData
  }) => Promise<{ data: ErrorLogData[] | FailureData }>

  /** Fetch all buildings and sync the model registry. */
  readonly fetch: () => Promise<BuildingWithStructure[]>

  /** Get frost protection settings for a building, floor, area, or device. */
  readonly getFrostProtection: ({
    params,
  }: {
    params: SettingsParams
  }) => Promise<{ data: FrostProtectionData }>

  /** Get holiday mode settings for a building, floor, area, or device. */
  readonly getHolidayMode: ({
    params,
  }: {
    params: SettingsParams
  }) => Promise<{ data: HolidayModeData }>

  /** Fetch operation mode log data for charting. */
  readonly getOperationModes: ({
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
  readonly getSignal: ({
    postData,
  }: {
    postData: { devices: number | number[]; hour: HourNumbers }
  }) => Promise<{ data: ReportData }>

  /** Fetch temperature log data. */
  readonly getTemperatures: ({
    postData,
  }: {
    postData: TemperatureLogPostData
  }) => Promise<{ data: ReportData }>

  /** Fetch tile data for device overview. */
  readonly getTiles: (({
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
  readonly getValues: <T extends DeviceType>({
    params,
  }: {
    params: GetDeviceDataParams
  }) => Promise<{ data: GetDeviceData<T> }>

  /** Fetch energy consumption report. Supported by ATA and ATW devices. */
  readonly getEnergy: <T extends DeviceType>({
    postData,
  }: {
    postData: EnergyPostData
  }) => Promise<{ data: EnergyData<T> }>

  /** Fetch ATA device group state. ATA only. */
  readonly getGroup: ({
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
  readonly getHourlyTemperatures: ({
    postData,
  }: {
    postData: { device: number; hour: HourNumbers }
  }) => Promise<{ data: ReportData }>

  /** Fetch internal temperature report. ATW only. */
  readonly getInternalTemperatures: ({
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
