import type { ClassicDeviceType } from '../constants.ts'
import type { ClassicRegistry } from '../entities/classic-registry.ts'
import type {
  ErrorLogEntry,
  ErrorLogPage,
  ErrorLogQuery,
} from '../error-log.ts'
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
import type {
  BaseAPIAdapter,
  BaseAPIConfig,
  BaseAPISettings,
  SyncCallback,
} from './types.ts'

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
 * `request<T>()`; consumers don't see it. Applied uniformly across
 * both Classic and Home so the public surface is symmetric.
 * @category Configuration
 */
export interface ClassicAPIAdapter extends BaseAPIAdapter {
  /**
   * Notify any registered `events.onSyncComplete` observer that a sync
   * just landed. Routed through the lifecycle emitter so a misbehaving
   * observer cannot break the caller.
   */
  readonly notifySync: SyncCallback
  /**
   * Classic model registry synced by the fetch cycle.
   */
  readonly registry: ClassicRegistry
  /**
   * Fetch all buildings and sync the model registry.
   */
  readonly fetch: () => Promise<ClassicBuildingWithStructure[]>
  /**
   * Fetch energy consumption report. Supported by ATA and ATW devices.
   */
  readonly getEnergy: <T extends ClassicDeviceType>({
    postData,
  }: {
    postData: ClassicEnergyPostData
  }) => Promise<Result<ClassicEnergyData<T>>>
  /**
   * Fetch raw error log entries from the Classic API.
   */
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
  /**
   * Get frost protection settings for a building, floor, area, or device.
   */
  readonly getFrostProtection: ({
    params,
  }: {
    params: ClassicSettingsParams
  }) => Promise<Result<ClassicFrostProtectionData>>
  /**
   * Fetch ATA device group state. ATA only.
   */
  readonly getGroup: ({
    postData,
  }: {
    postData: ClassicGetGroupPostData
  }) => Promise<Result<ClassicGetGroupData>>
  /**
   * Get holiday mode settings for a building, floor, area, or device.
   */
  readonly getHolidayMode: ({
    params,
  }: {
    params: ClassicSettingsParams
  }) => Promise<Result<ClassicHolidayModeData>>
  /**
   * Fetch hourly temperature report. ATW only.
   */
  readonly getHourlyTemperatures: ({
    postData,
  }: {
    postData: { device: number; hour: Hour }
  }) => Promise<Result<ClassicReportData>>
  /**
   * Fetch internal temperature report. ATW only.
   */
  readonly getInternalTemperatures: ({
    postData,
  }: {
    postData: ClassicReportPostData
  }) => Promise<Result<ClassicReportData>>
  /**
   * Fetch operation mode log data for charting.
   */
  readonly getOperationModes: ({
    postData,
  }: {
    postData: ClassicReportPostData
  }) => Promise<Result<ClassicOperationModeLogData>>
  /**
   * Fetch WiFi signal strength report.
   */
  readonly getSignal: ({
    postData,
  }: {
    postData: { devices: number | number[]; hour: Hour }
  }) => Promise<Result<ClassicReportData>>
  /**
   * Fetch temperature log data.
   */
  readonly getTemperatures: ({
    postData,
  }: {
    postData: ClassicTemperatureLogPostData
  }) => Promise<Result<ClassicReportData>>
  /**
   * Fetch tile data for device overview.
   */
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
  /**
   * Fetch current device data by device and building ID.
   */
  readonly getValues: <T extends ClassicDeviceType>({
    params,
  }: {
    params: ClassicGetDeviceDataParams
  }) => Promise<Result<ClassicGetDeviceData<T>>>
  /**
   * Update frost protection settings.
   */
  readonly updateFrostProtection: ({
    postData,
  }: {
    postData: ClassicFrostProtectionPostData
  }) => Promise<ClassicFailureData | ClassicSuccessData>
  /**
   * Update ATA device group state. ATA only.
   */
  readonly updateGroupState: ({
    postData,
  }: {
    postData: ClassicSetGroupPostData
  }) => Promise<ClassicFailureData | ClassicSuccessData>
  /**
   * Update holiday mode settings.
   */
  readonly updateHolidayMode: ({
    postData,
  }: {
    postData: ClassicHolidayModePostData
  }) => Promise<ClassicFailureData | ClassicSuccessData>
  /**
   * Turn devices on or off.
   */
  readonly updatePower: ({
    postData,
  }: {
    postData: ClassicSetPowerPostData
  }) => Promise<boolean>
  /**
   * Send updated device values to the Classic API.
   */
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
  /**
   * Upstream account language code (e.g. `'en'`, `'fr'`).
   */
  readonly language?: string | undefined
  /**
   * BCP-47 locale tag for report chart labels (day-of-week, month
   * names). Independent of {@link language} — `language` controls
   * upstream messages, `locale` controls how the SDK formats labels
   * locally. Defaults to the runtime locale when unset.
   */
  readonly locale?: string | undefined
  /**
   * Whether to verify SSL certificates. Defaults to `true`.
   */
  readonly shouldVerifySSL?: boolean | undefined
  /**
   * IANA timezone identifier (e.g. `'Europe/Paris'`).
   */
  readonly timezone?: string | undefined
}

/**
 * Persistent settings managed by the Classic API for session authentication.
 * @category Configuration
 */
export interface ClassicAPISettings extends BaseAPISettings {
  /**
   * MELCloud session context key.
   */
  readonly contextKey?: string | null
}

/**
 * Parsed error log — the cross-dialect {@link ErrorLogPage} with the
 * Classic-precise entries: neutral shape, reverse chronological order,
 * plus the chained window bounds.
 * @category Configuration
 */
export interface ClassicErrorLog extends ErrorLogPage {
  /**
   * The page's entries, sorted in reverse chronological order.
   */
  readonly entries: readonly ClassicErrorLogEntry[]
}

/**
 * One Classic error-log entry: the cross-dialect {@link ErrorLogEntry}
 * kept precise — the Classic wire always carries a numeric device id
 * and a message text, so neither loosens to the neutral optionality.
 * @category Configuration
 */
export interface ClassicErrorLogEntry extends ErrorLogEntry {
  /**
   * Numeric ID of the device that reported the error.
   */
  readonly deviceId: number
  /**
   * Error message text (empty or null wire messages are filtered out).
   */
  readonly message: string
}

/**
 * Query parameters for paginating the error log — the cross-dialect
 * {@link ErrorLogQuery}.
 * @category Configuration
 */
export type ClassicErrorLogQuery = ErrorLogQuery
