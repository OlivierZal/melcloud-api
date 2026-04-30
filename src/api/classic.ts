import { DateTime, Settings as LuxonSettings } from 'luxon'
import { Agent } from 'undici'

import { ClassicDeviceType, ClassicLanguage } from '../constants.ts'
import { setting, syncDevices } from '../decorators/index.ts'
import { ClassicRegistry } from '../entities/index.ts'
import { AuthenticationError } from '../errors/index.ts'
import { isSessionExpired, toClassicDeviceId } from '../resilience/index.ts'
import { SESSION_REFRESH_AHEAD_MS } from '../time-units.ts'
import {
  type ApiRequestError,
  type ClassicAreaDataAny,
  type ClassicBuildingWithStructure,
  type ClassicEnergyData,
  type ClassicEnergyPostData,
  type ClassicErrorLogData,
  type ClassicErrorLogPostData,
  type ClassicFailureData,
  type ClassicFrostProtectionData,
  type ClassicFrostProtectionPostData,
  type ClassicGetDeviceData,
  type ClassicGetDeviceDataParams,
  type ClassicGetGroupData,
  type ClassicGetGroupPostData,
  type ClassicHolidayModeData,
  type ClassicHolidayModePostData,
  type ClassicListDeviceAny,
  type ClassicLoginData,
  type ClassicLoginPostData,
  type ClassicOperationModeLogData,
  type ClassicReportData,
  type ClassicReportPostData,
  type ClassicSetDeviceData,
  type ClassicSetDevicePostData,
  type ClassicSetGroupPostData,
  type ClassicSetPowerPostData,
  type ClassicSettingsParams,
  type ClassicSuccessData,
  type ClassicTemperatureLogPostData,
  type ClassicTilesData,
  type ClassicTilesPostData,
  type Hour,
  type LoginCredentials,
  type Result,
  err,
  mapResult,
  ok,
} from '../types/index.ts'
import { isKeyOf } from '../utils.ts'
import {
  ClassicBuildingListSchema,
  ClassicLoginDataSchema,
  parseOrThrow,
} from '../validation/index.ts'
import type {
  ClassicAPIAdapter,
  ClassicAPIConfig,
  ClassicErrorLog,
  ClassicErrorLogQuery,
} from './classic-types.ts'
import { BaseAPI } from './base.ts'

const deviceTypeNames = {
  [ClassicDeviceType.Ata]: 'Ata',
  [ClassicDeviceType.Atw]: 'Atw',
  [ClassicDeviceType.Erv]: 'Erv',
} satisfies Record<ClassicDeviceType, string>

const API_BASE_URL = 'https://app.melcloud.com/Mitsubishi.Wifi.Client'
const APP_VERSION = '1.38.4.0'
const LIST_PATH = '/User/ListDevices'
const LOGIN_PATH = '/Login/ClientLogin3'

const DEFAULT_RETRY_HOURS = 2
const DEFAULT_SYNC_INTERVAL_MINUTES = 5

// MELCloud uses year 1 for uninitialized error dates; filter these out as invalid
const INVALID_YEAR = 1

const toISODate = (dateTime: DateTime): string => {
  const result = dateTime.toISODate()

  if (result === null) {
    throw new Error('Invalid DateTime: cannot convert to ISO date')
  }

  return result
}

const isLanguage = isKeyOf(ClassicLanguage)

const formatErrors = (errors: Record<string, readonly string[]>): string =>
  Object.entries(errors)
    .map(([error, messages]) => `${error}: ${messages.join(', ')}`)
    .join('\n')

const parseErrorLogQuery = ({
  from,
  offset = 0,
  period = 1,
  to,
}: ClassicErrorLogQuery): {
  fromDate: DateTime
  period: number
  toDate: DateTime
} => {
  // When `from` is set the query is pinned to that single day; offset
  // is therefore moot and ignored. Otherwise pages are stacked
  // backwards from `to` in `period`-sized windows.
  const fromDateOverride =
    from !== undefined && from !== '' ? DateTime.fromISO(from) : null
  const toDate =
    to !== undefined && to !== '' ? DateTime.fromISO(to) : DateTime.now()
  // A page covers `period` days; consecutive pages are separated by a
  // one-day boundary so day N is never returned twice. Each step back
  // therefore moves `period + 1` days, hence the `* (period + 1)`.
  const daysBack = fromDateOverride ? 0 : offset * (period + 1)
  return {
    fromDate: fromDateOverride ?? toDate.minus({ days: daysBack + period }),
    period,
    toDate: toDate.minus({ days: daysBack }),
  }
}

// Collect all areas from both building-level and floor-level
const collectAreas = function* collectAreas(
  buildings: ClassicBuildingWithStructure[],
): Generator<ClassicAreaDataAny> {
  for (const {
    Structure: { Areas: areas, Floors: floors },
  } of buildings) {
    yield* areas
    for (const { Areas: floorAreas } of floors) {
      yield* floorAreas
    }
  }
}

// Collect all devices from every level of the hierarchy
const collectDevices = function* collectDevices(
  buildings: ClassicBuildingWithStructure[],
): Generator<ClassicListDeviceAny> {
  for (const {
    Structure: { Areas: areas, Devices: devices, Floors: floors },
  } of buildings) {
    yield* devices
    for (const { Devices: areaDevices } of areas) {
      yield* areaDevices
    }
    for (const { Areas: floorAreas, Devices: floorDevices } of floors) {
      yield* floorDevices
      for (const { Devices: floorAreaDevices } of floorAreas) {
        yield* floorAreaDevices
      }
    }
  }
}

/**
 * Main MELCloud Classic API client. Handles authentication, device syncing, and all
 * ClassicAPI endpoint calls. Uses a private constructor — create instances via {@link ClassicAPI.create}.
 */
export class ClassicAPI extends BaseAPI implements ClassicAPIAdapter {
  public get registry(): ClassicRegistry {
    return this.#registry
  }

  #language = 'en'

  readonly #registry = new ClassicRegistry()

  @setting
  private accessor contextKey = ''

  private get language(): string {
    return this.#language
  }

  private set language(value: string) {
    this.#language = value
  }

  private constructor(config: ClassicAPIConfig = {}) {
    const {
      language,
      password,
      shouldVerifySSL = true,
      timezone,
      username,
    } = config
    super(config, {
      defaultSyncIntervalMinutes: DEFAULT_SYNC_INTERVAL_MINUTES,
      httpConfig: {
        baseURL: API_BASE_URL,

        // Self-signed-friendly dispatcher when the caller opts out of
        // verification (shouldVerifySSL=false). `undefined` falls back
        // to the global agent so verified TLS remains the default.
        ...(shouldVerifySSL ?
          {}
        : {
            dispatcher: new Agent({ connect: { rejectUnauthorized: false } }),
          }),
      },
      rateLimitHours: DEFAULT_RETRY_HOURS,
      syncCallback: async () => this.fetch(),
    })
    if (timezone !== undefined) {
      LuxonSettings.defaultZone = timezone
    }
    if (language !== undefined) {
      this.language = language
    }
    this.applyCredentials(username, password)
  }

  /**
   * Create and initialize a MELCloud Classic API instance.
   *
   * Delegates post-construction setup to {@link BaseAPI.initialize}
   * so the #1281-class invariant is enforced uniformly: on return,
   * either the registry is populated or the instance is in a
   * documented empty state (no credentials, no persisted session).
   * @param config - Optional configuration for the Classic API client.
   * @returns The initialized ClassicAPI instance.
   */
  public static async create(config?: ClassicAPIConfig): Promise<ClassicAPI> {
    const api = new ClassicAPI(config)
    await api.initialize()
    return api
  }

  /**
   * Fetch all buildings, sync the model registry, and schedule the next auto-sync.
   * @returns The list of fetched buildings.
   */
  @syncDevices()
  public async fetch(): Promise<ClassicBuildingWithStructure[]> {
    this.clearSync()
    try {
      return await this.#fetch()
    } catch (error) {
      this.logger.error('Failed to fetch devices:', error)
      return []
    } finally {
      this.syncManager.planNext()
    }
  }

  public async getEnergy<T extends ClassicDeviceType>({
    postData,
  }: {
    postData: ClassicEnergyPostData
  }): Promise<Result<ClassicEnergyData<T>, ApiRequestError>> {
    return this.safeRequest<ClassicEnergyData<T>>(
      'post',
      '/EnergyCost/Report',
      { data: postData },
    )
  }

  public async getErrorEntries({
    postData,
  }: {
    postData: ClassicErrorLogPostData
  }): Promise<
    Result<ClassicErrorLogData[] | ClassicFailureData, ApiRequestError>
  > {
    return this.safeRequest<ClassicErrorLogData[] | ClassicFailureData>(
      'post',
      '/Report/GetUnitErrorLog2',
      { data: postData },
    )
  }

  /**
   * Retrieve a parsed, paginated error log for the specified devices.
   * Filters out entries with invalid dates or empty messages.
   * @param query - The error log query parameters (date range, pagination).
   * @param deviceIds - ClassicDevice IDs to fetch errors for; defaults to all devices.
   * @returns Parsed error log with pagination metadata, or a typed failure.
   */
  public async getErrorLog(
    query: ClassicErrorLogQuery,
    deviceIds: number[] = this.#registry.getDevices().map(({ id }) => id),
  ): Promise<Result<ClassicErrorLog, ApiRequestError>> {
    const { fromDate, period, toDate } = parseErrorLogQuery(query)
    const nextToDate = fromDate.minus({ days: 1 })
    return mapResult(
      await this.#getErrorLog(deviceIds, fromDate, toDate),
      (errorLog) => ({
        errors: errorLog
          .flatMap(
            ({
              DeviceId: errorDeviceId,
              ErrorMessage: errorMessage,
              StartDate: startDate,
            }) => {
              const dateTime = DateTime.fromISO(startDate)
              if (dateTime.year === INVALID_YEAR) {
                return []
              }
              const error = errorMessage?.trim() ?? ''
              return error ?
                  [{ date: startDate, deviceId: errorDeviceId, error }]
                : []
            },
          )
          .toReversed(),
        fromDate: toISODate(fromDate),
        nextFromDate: toISODate(nextToDate.minus({ days: period })),
        nextToDate: toISODate(nextToDate),
      }),
    )
  }

  public async getFrostProtection({
    params,
  }: {
    params: ClassicSettingsParams
  }): Promise<Result<ClassicFrostProtectionData, ApiRequestError>> {
    return this.safeRequest<ClassicFrostProtectionData>(
      'get',
      '/FrostProtection/GetSettings',
      { params },
    )
  }

  public async getGroup({
    postData,
  }: {
    postData: ClassicGetGroupPostData
  }): Promise<Result<ClassicGetGroupData, ApiRequestError>> {
    return this.safeRequest<ClassicGetGroupData>('post', '/Group/Get', {
      data: postData,
    })
  }

  public async getHolidayMode({
    params,
  }: {
    params: ClassicSettingsParams
  }): Promise<Result<ClassicHolidayModeData, ApiRequestError>> {
    return this.safeRequest<ClassicHolidayModeData>(
      'get',
      '/HolidayMode/GetSettings',
      { params },
    )
  }

  public async getHourlyTemperatures({
    postData,
  }: {
    postData: { device: number; hour: Hour }
  }): Promise<Result<ClassicReportData, ApiRequestError>> {
    return this.safeRequest<ClassicReportData>(
      'post',
      '/Report/GetHourlyTemperature',
      { data: postData },
    )
  }

  public async getInternalTemperatures({
    postData,
  }: {
    postData: ClassicReportPostData
  }): Promise<Result<ClassicReportData, ApiRequestError>> {
    return this.safeRequest<ClassicReportData>(
      'post',
      '/Report/GetInternalTemperatures2',
      { data: postData },
    )
  }

  public async getOperationModes({
    postData,
  }: {
    postData: ClassicReportPostData
  }): Promise<Result<ClassicOperationModeLogData, ApiRequestError>> {
    return this.safeRequest<ClassicOperationModeLogData>(
      'post',
      '/Report/GetOperationModeLog2',
      { data: postData },
    )
  }

  public async getSignal({
    postData,
  }: {
    postData: { devices: number | number[]; hour: Hour }
  }): Promise<Result<ClassicReportData, ApiRequestError>> {
    return this.safeRequest<ClassicReportData>(
      'post',
      '/Report/GetSignalStrength',
      { data: postData },
    )
  }

  public async getTemperatures({
    postData,
  }: {
    postData: ClassicTemperatureLogPostData
  }): Promise<Result<ClassicReportData, ApiRequestError>> {
    return this.safeRequest<ClassicReportData>(
      'post',
      '/Report/GetTemperatureLog2',
      { data: postData },
    )
  }

  public async getTiles({
    postData,
  }: {
    postData: ClassicTilesPostData<null>
  }): Promise<Result<ClassicTilesData<null>, ApiRequestError>>
  public async getTiles<T extends ClassicDeviceType>({
    postData,
  }: {
    postData: ClassicTilesPostData<T>
  }): Promise<Result<ClassicTilesData<T>, ApiRequestError>>
  public async getTiles<T extends ClassicDeviceType | null>({
    postData,
  }: {
    postData: ClassicTilesPostData<T>
  }): Promise<Result<ClassicTilesData<T>, ApiRequestError>> {
    return this.safeRequest<ClassicTilesData<T>>('post', '/Tile/Get2', {
      data: postData,
    })
  }

  /**
   * Read the live device data for a single device.
   *
   * Wrapped by `@classicUpdateDevice` — the returned payload is also
   * written back into the in-memory registry, so subsequent
   * registry-backed facades reflect the fresh state.
   * @param root0 - Destructured options.
   * @param root0.params - `buildingId` + `id` of the target device.
   * @returns The device-type-discriminated data payload.
   */
  public async getValues<T extends ClassicDeviceType>({
    params,
  }: {
    params: ClassicGetDeviceDataParams
  }): Promise<Result<ClassicGetDeviceData<T>, ApiRequestError>> {
    return this.safeRequest<ClassicGetDeviceData<T>>('get', '/Device/Get', {
      params,
    })
  }

  public isAuthenticated(): boolean {
    return this.contextKey !== ''
  }

  public async list(): Promise<{ data: ClassicBuildingWithStructure[] }> {
    const response = await this.request<ClassicBuildingWithStructure[]>(
      'get',
      LIST_PATH,
    )

    // Zod validates the envelope + the minimal device header (Type,
    // DeviceID, etc.); the per-device-type payload (Ata/Atw/Erv) keeps
    // its compile-time contract — the `request<T>` generic binds T
    // at the call site, Zod enforces it at runtime.
    parseOrThrow(ClassicBuildingListSchema, response.data, 'ListDevices')
    return response
  }

  /**
   * Low-level POST to `/Login/ClientLogin3`. Prefer {@link authenticate},
   * which adds credential fallback, persists the resulting
   * `contextKey`/`expiry`, and is triggered automatically on 401.
   * @param root0 - Destructured options.
   * @param root0.postData - Login credentials + app version + language.
   * @returns The raw login envelope, Zod-validated.
   */
  public async login({
    postData,
  }: {
    postData: ClassicLoginPostData
  }): Promise<{ data: ClassicLoginData }> {
    const response = await this.dispatch<ClassicLoginData>('post', LOGIN_PATH, {
      data: postData,
    })
    return {
      ...response,
      data: parseOrThrow(ClassicLoginDataSchema, response.data, 'ClientLogin3'),
    }
  }

  /**
   * Update frost protection settings for a zone.
   *
   * The response is discriminated: on success returns
   * `ClassicSuccessData` (`Success: true`); on partial/total failure
   * returns `ClassicFailureData` with `AttributeErrors` describing the
   * rejected fields. Callers should branch on `Success` before reading
   * the remaining fields.
   * @param root0 - Destructured options.
   * @param root0.postData - Zone identifier + new temperature bounds.
   * @returns The success or failure envelope.
   */
  public async updateFrostProtection({
    postData,
  }: {
    postData: ClassicFrostProtectionPostData
  }): Promise<{ data: ClassicFailureData | ClassicSuccessData }> {
    return this.request('post', '/FrostProtection/Update', { data: postData })
  }

  /**
   * Apply an ATA group state update across every device in a building
   * zone. Same success/failure envelope shape as
   * {@link updateFrostProtection}.
   * @param root0 - Destructured options.
   * @param root0.postData - Group target + state fields to apply.
   * @returns The success or failure envelope.
   */
  public async updateGroupState({
    postData,
  }: {
    postData: ClassicSetGroupPostData
  }): Promise<{ data: ClassicFailureData | ClassicSuccessData }> {
    return this.request('post', '/Group/SetAta', { data: postData })
  }

  /**
   * Update holiday-mode settings for a zone. Same envelope
   * discrimination as {@link updateFrostProtection}.
   * @param root0 - Destructured options.
   * @param root0.postData - Zone identifier + holiday-mode fields.
   * @returns The success or failure envelope.
   */
  public async updateHolidayMode({
    postData,
  }: {
    postData: ClassicHolidayModePostData
  }): Promise<{ data: ClassicFailureData | ClassicSuccessData }> {
    return this.request('post', '/HolidayMode/Update', { data: postData })
  }

  /**
   * Update the user's language on the server if it differs from the current locale.
   * @param language - The language code to set.
   */
  public async updateLanguage(language: string): Promise<void> {
    if (language === this.language) {
      return
    }
    const { data: hasLanguageChanged } = await this.request<boolean>(
      'post',
      '/User/UpdateLanguage',
      { data: { language: this.#getLanguageCode(language) } },
    )
    if (hasLanguageChanged) {
      this.language = language
    }
  }

  /**
   * Toggle power on one or more devices via `/Device/Power`.
   *
   * Wrapped by `@classicUpdateDevices` — the updated `Power` flag is
   * mirrored into every registry entry in scope, so facades reading
   * `device.power` see the new state without a re-fetch.
   * @param root0 - Destructured options.
   * @param root0.postData - `DeviceIds` array + target `Power` state.
   * @returns The server-echoed power state.
   */
  public async updatePower({
    postData,
  }: {
    postData: ClassicSetPowerPostData
  }): Promise<{ data: boolean }> {
    return this.request('post', '/Device/Power', { data: postData })
  }

  /**
   * Send a set-device payload to `/Device/SetAta`, `/Device/SetAtw`
   * or `/Device/SetErv` depending on the `DeviceType` on the body.
   *
   * Wrapped by `@classicUpdateDevice` — the `EffectiveFlags` bitmask
   * returned by MELCloud is applied back to the matching registry
   * entry so subsequent reads reflect exactly the fields the server
   * acknowledged (not necessarily the ones requested).
   * @param root0 - Destructured options.
   * @param root0.postData - Discriminated set-device payload.
   * @param root0.type - Device type selecting the target endpoint.
   * @returns The server response, narrowed by `DeviceType`.
   */
  public async updateValues<T extends ClassicDeviceType>({
    postData,
    type,
  }: {
    postData: ClassicSetDevicePostData<T>
    type: T
  }): Promise<{ data: ClassicSetDeviceData<T> }> {
    return this.request('post', `/Device/Set${deviceTypeNames[type]}`, {
      data: postData,
    })
  }

  protected override async doAuthenticate({
    password,
    username,
  }: LoginCredentials): Promise<void> {
    this.#clearPersistedSession()
    const {
      data: { LoginData: loginData },
    } = await this.login({
      postData: {
        AppVersion: APP_VERSION,
        Email: username,
        Language: this.#getLanguageCode(),
        Password: password,
        Persist: true,
      },
    })
    if (loginData === null) {
      throw new AuthenticationError('MELCloud Classic rejected the credentials')
    }
    this.username = username
    this.password = password
    ;({ ContextKey: this.contextKey, Expiry: this.expiry } = loginData)
  }

  protected getAuthHeaders(): Record<string, string> {
    return this.contextKey === '' ? {} : { 'X-MitsContextKey': this.contextKey }
  }

  /**
   * Classic considers a session in need of refresh when the
   * `contextKey` is missing **or** its expiry timestamp is within
   * {@link SESSION_REFRESH_AHEAD_MS} of now. The forward window lets
   * the shared `BaseAPI.ensureSession` template renew the session
   * pre-emptively, keeping re-login latency off the request's
   * critical path.
   * @returns `true` when a refresh should run before the next request.
   */
  protected override needsSessionRefresh(): boolean {
    return (
      this.contextKey === '' ||
      isSessionExpired(this.expiry, SESSION_REFRESH_AHEAD_MS)
    )
  }

  /**
   * Classic session refresh = best-effort `resumeSession`. The
   * `contextKey → login → refetch` flow is the only path available
   * (no refresh-token equivalent on the Classic API); `resumeSession`
   * logs + swallows on failure so the triggering request can still
   * attempt its own 401 retry path.
   */
  protected override async performSessionRefresh(): Promise<void> {
    await this.resumeSession()
  }

  /**
   * Reactive-401 refresh for Classic: no token-refresh shortcut exists
   * on this API, so the only recovery path is a best-effort
   * {@link resumeSession} from persisted credentials. On success the
   * shared {@link AuthRetryPolicy} replays the original request.
   * @returns `true` when the session is authenticated afterwards.
   */
  protected override async reauthenticate(): Promise<boolean> {
    return this.resumeSession()
  }

  protected override async syncRegistry(): Promise<void> {
    await this.fetch()
  }

  /**
   * Classic's request pipeline is auth-self-healing: a call that
   * arrives with a stale `contextKey` 401s, triggers retry-auth via
   * stored credentials, and succeeds on the second try. A single
   * `fetch()` therefore covers both "valid session" and "expired
   * session, re-auth from stored creds" in one round-trip. We report
   * `true` iff that produced an authenticated state; otherwise the
   * template falls through to {@link authenticate}, preserving the
   * explicit-credentials path and leaving a consistent empty state
   * when neither a session nor credentials are available.
   * @returns `true` when fetch yielded an authenticated session.
   */
  protected override async tryReuseSession(): Promise<boolean> {
    await this.fetch()
    return this.isAuthenticated()
  }

  #clearPersistedSession(): void {
    this.contextKey = ''
    this.expiry = ''
  }

  async #fetch(): Promise<ClassicBuildingWithStructure[]> {
    const { data } = await this.list()
    this.#registry.syncBuildings(data)
    this.#registry.syncFloors(
      data.flatMap(({ Structure: { Floors: floors } }) => floors),
    )
    this.#registry.syncAreas([...collectAreas(data)])
    this.#registry.syncDevices([...collectDevices(data)])
    return data
  }

  async #getErrorLog(
    deviceIds: number[],
    fromDate: DateTime,
    toDate: DateTime,
  ): Promise<Result<ClassicErrorLogData[], ApiRequestError>> {
    const result = await this.getErrorEntries({
      postData: {
        DeviceIDs: deviceIds.map((id) => toClassicDeviceId(id)),
        FromDate: toISODate(fromDate),
        ToDate: toISODate(toDate),
      },
    })
    if (!result.ok) {
      return result
    }
    const { value: data } = result
    if ('AttributeErrors' in data) {
      // Domain-level failure (server rejected the query) surfaces as a
      // synthetic `validation` variant — the call itself succeeded at
      // transport, but the payload is unusable.
      return err({
        cause: new Error(formatErrors(data.AttributeErrors)),
        issue: formatErrors(data.AttributeErrors),
        kind: 'validation',
      })
    }
    return ok(data)
  }

  #getLanguageCode(language: string = this.language): ClassicLanguage {
    return isLanguage(language) ? ClassicLanguage[language] : ClassicLanguage.en
  }
}
