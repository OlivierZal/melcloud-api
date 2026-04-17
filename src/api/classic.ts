import { type HourNumbers, DateTime, Settings as LuxonSettings } from 'luxon'
import { Agent } from 'undici'

import type { HttpResponse } from '../http/index.ts'
import type {
  ClassicAreaDataAny,
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
  ClassicListDeviceAny,
  ClassicLoginCredentials,
  ClassicLoginData,
  ClassicLoginPostData,
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
import { ClassicDeviceType, ClassicLanguage } from '../constants.ts'
import {
  authenticate,
  classicSyncDevices,
  setting,
} from '../decorators/index.ts'
import { ClassicRegistry } from '../entities/index.ts'
import { isSessionExpired, toClassicDeviceId } from '../resilience/index.ts'
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
} from './classic-interfaces.ts'
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
const DEFAULT_SYNC_INTERVAL = 5
const DEFAULT_TIMEOUT_MS = 30_000
const RETRY_DELAY = 1000

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
  limit,
  offset,
  to,
}: ClassicErrorLogQuery): {
  fromDate: DateTime
  period: number
  toDate: DateTime
} => {
  /*
   * When fromDate is specified, period is fixed and offset is ignored, allowing
   * queries around a specific date. Otherwise, offset pages through history
   * in period-sized chunks.
   */
  const fromDate =
    from !== undefined && from !== '' ? DateTime.fromISO(from) : null
  const toDate =
    to !== undefined && to !== '' ? DateTime.fromISO(to) : DateTime.now()

  const numberLimit = Number(limit)
  const period = Number.isFinite(numberLimit) ? numberLimit : 1

  const numberOffset = Number(offset)
  const daysOffset =
    !fromDate && Number.isFinite(numberOffset) ? numberOffset : 0

  const daysLimit = fromDate ? 1 : period
  const days = daysLimit * daysOffset + daysOffset
  return {
    fromDate: fromDate ?? toDate.minus({ days: days + daysLimit }),
    period,
    toDate: toDate.minus({ days }),
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
      autoSyncInterval = DEFAULT_SYNC_INTERVAL,
      httpClient,
      language,
      password,
      requestTimeout = DEFAULT_TIMEOUT_MS,
      shouldVerifySSL = true,
      timezone,
      username,
    } = config
    super(
      { ...config, autoSyncInterval },
      {
        httpClient,
        httpConfig: {
          baseURL: API_BASE_URL,
          /*
           * Self-signed-friendly dispatcher when the caller opts out of
           * verification (shouldVerifySSL=false). `undefined` falls back
           * to the global agent so verified TLS remains the default.
           */
          ...(shouldVerifySSL ?
            {}
          : {
              dispatcher: new Agent({ connect: { rejectUnauthorized: false } }),
            }),
          timeout: requestTimeout,
        },
        rateLimitHours: DEFAULT_RETRY_HOURS,
        retryDelay: RETRY_DELAY,
        syncCallback: async () => this.fetch(),
      },
    )
    this.#applyOptionalConfig({ language, password, timezone, username })
  }

  /**
   * Create and initialize a new ClassicAPI instance, performing an initial device sync.
   * @param config - Optional configuration for the Classic API client.
   * @returns The initialized ClassicAPI instance.
   */
  public static async create(config?: ClassicAPIConfig): Promise<ClassicAPI> {
    const api = new ClassicAPI(config)
    await api.fetch()
    return api
  }

  @authenticate
  public async authenticate(data?: ClassicLoginCredentials): Promise<boolean> {
    /* v8 ignore next -- @authenticate guarantees data is always provided */
    const { password, username } = data ?? { password: '', username: '' }
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
    if (loginData) {
      this.username = username
      this.password = password
      ;({ ContextKey: this.contextKey, Expiry: this.expiry } = loginData)
      await this.fetch()
    }
    return loginData !== null
  }

  /**
   * Fetch all buildings, sync the model registry, and schedule the next auto-sync.
   * @returns The list of fetched buildings.
   */
  @classicSyncDevices()
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
  }): Promise<{ data: ClassicEnergyData<T> }> {
    return this.request('post', '/EnergyCost/Report', { data: postData })
  }

  public async getErrorEntries({
    postData,
  }: {
    postData: ClassicErrorLogPostData
  }): Promise<{ data: ClassicErrorLogData[] | ClassicFailureData }> {
    return this.request('post', '/Report/GetUnitErrorLog2', { data: postData })
  }

  /**
   * Retrieve a parsed, paginated error log for the specified devices.
   * Filters out entries with invalid dates or empty messages.
   * @param query - The error log query parameters (date range, pagination).
   * @param deviceIds - ClassicDevice IDs to fetch errors for; defaults to all devices.
   * @returns Parsed error log with pagination metadata.
   */
  public async getErrorLog(
    query: ClassicErrorLogQuery,
    deviceIds = this.#registry.getDevices().map(({ id }) => id),
  ): Promise<ClassicErrorLog> {
    const { fromDate, period, toDate } = parseErrorLogQuery(query)
    const nextToDate = fromDate.minus({ days: 1 })
    const errorLog = await this.#errorLog(deviceIds, fromDate, toDate)

    return {
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
    }
  }

  public async getFrostProtection({
    params,
  }: {
    params: ClassicSettingsParams
  }): Promise<{ data: ClassicFrostProtectionData }> {
    return this.request('get', '/FrostProtection/GetSettings', { params })
  }

  public async getGroup({
    postData,
  }: {
    postData: ClassicGetGroupPostData
  }): Promise<{ data: ClassicGetGroupData }> {
    return this.request('post', '/Group/Get', { data: postData })
  }

  public async getHolidayMode({
    params,
  }: {
    params: ClassicSettingsParams
  }): Promise<{ data: ClassicHolidayModeData }> {
    return this.request('get', '/HolidayMode/GetSettings', { params })
  }

  public async getHourlyTemperatures({
    postData,
  }: {
    postData: { device: number; hour: HourNumbers }
  }): Promise<{ data: ClassicReportData }> {
    return this.request('post', '/Report/GetHourlyTemperature', {
      data: postData,
    })
  }

  public async getInternalTemperatures({
    postData,
  }: {
    postData: ClassicReportPostData
  }): Promise<{ data: ClassicReportData }> {
    return this.request('post', '/Report/GetInternalTemperatures2', {
      data: postData,
    })
  }

  public async getOperationModes({
    postData,
  }: {
    postData: ClassicReportPostData
  }): Promise<{ data: ClassicOperationModeLogData }> {
    return this.request('post', '/Report/GetOperationModeLog2', {
      data: postData,
    })
  }

  public async getSignal({
    postData,
  }: {
    postData: { devices: number | number[]; hour: HourNumbers }
  }): Promise<{ data: ClassicReportData }> {
    return this.request('post', '/Report/GetSignalStrength', {
      data: postData,
    })
  }

  public async getTemperatures({
    postData,
  }: {
    postData: ClassicTemperatureLogPostData
  }): Promise<{ data: ClassicReportData }> {
    return this.request('post', '/Report/GetTemperatureLog2', {
      data: postData,
    })
  }

  public async getTiles({
    postData,
  }: {
    postData: ClassicTilesPostData<null>
  }): Promise<{ data: ClassicTilesData<null> }>
  public async getTiles<T extends ClassicDeviceType>({
    postData,
  }: {
    postData: ClassicTilesPostData<T>
  }): Promise<{ data: ClassicTilesData<T> }>
  public async getTiles<T extends ClassicDeviceType | null>({
    postData,
  }: {
    postData: ClassicTilesPostData<T>
  }): Promise<{ data: ClassicTilesData<T> }> {
    return this.request('post', '/Tile/Get2', { data: postData })
  }

  public async getValues<T extends ClassicDeviceType>({
    params,
  }: {
    params: ClassicGetDeviceDataParams
  }): Promise<{ data: ClassicGetDeviceData<T> }> {
    return this.request('get', '/Device/Get', { params })
  }

  public isAuthenticated(): boolean {
    return this.contextKey !== ''
  }

  public async list(): Promise<{ data: ClassicBuildingWithStructure[] }> {
    const response = await this.request<ClassicBuildingWithStructure[]>(
      'get',
      LIST_PATH,
    )
    /*
     * Zod validates the envelope + the minimal device header (Type,
     * DeviceID, etc.); the per-device-type payload (Ata/Atw/Erv) keeps
     * its compile-time contract — the `request<T>` generic binds T
     * at the call site, Zod enforces it at runtime.
     */
    parseOrThrow(ClassicBuildingListSchema, response.data, 'ListDevices')
    return response
  }

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

  public async updateFrostProtection({
    postData,
  }: {
    postData: ClassicFrostProtectionPostData
  }): Promise<{ data: ClassicFailureData | ClassicSuccessData }> {
    return this.request('post', '/FrostProtection/Update', { data: postData })
  }

  public async updateGroupState({
    postData,
  }: {
    postData: ClassicSetGroupPostData
  }): Promise<{ data: ClassicFailureData | ClassicSuccessData }> {
    return this.request('post', '/Group/SetAta', { data: postData })
  }

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

  public async updatePower({
    postData,
  }: {
    postData: ClassicSetPowerPostData
  }): Promise<{ data: boolean }> {
    return this.request('post', '/Device/Power', { data: postData })
  }

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

  // Allow one retry per RETRY_DELAY window to avoid infinite retry loops
  protected async ensureSession(): Promise<void> {
    /*
     * Re-authenticate proactively if the context key is missing or the
     * session token is expired/invalid. A malformed `expiry` (e.g. from
     * a settings migration) is treated as expired, not silently ignored.
     */
    if (this.contextKey === '' || isSessionExpired(this.expiry)) {
      await this.authenticate()
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    return this.contextKey === '' ? {} : { 'X-MitsContextKey': this.contextKey }
  }

  protected async retryAuth<T>(
    method: string,
    url: string,
    config: Record<string, unknown>,
  ): Promise<HttpResponse<T> | null> {
    if (await this.authenticate()) {
      return this.dispatch<T>(method, url, config)
    }
    return null
  }

  #applyOptionalConfig({
    language,
    password,
    timezone,
    username,
  }: {
    language?: string
    password?: string
    timezone?: string
    username?: string
  }): void {
    if (timezone !== undefined) {
      LuxonSettings.defaultZone = timezone
    }
    if (language !== undefined) {
      this.language = language
    }
    this.applyCredentials(username, password)
  }

  #clearPersistedSession(): void {
    this.contextKey = ''
    this.expiry = ''
  }

  async #errorLog(
    deviceIds: number[],
    fromDate: DateTime,
    toDate: DateTime,
  ): Promise<ClassicErrorLogData[]> {
    const { data } = await this.getErrorEntries({
      postData: {
        DeviceIDs: deviceIds.map((id) => toClassicDeviceId(id)),
        FromDate: toISODate(fromDate),
        ToDate: toISODate(toDate),
      },
    })
    if ('AttributeErrors' in data) {
      throw new Error(formatErrors(data.AttributeErrors))
    }
    return data
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

  #getLanguageCode(language: string = this.language): ClassicLanguage {
    return isLanguage(language) ? ClassicLanguage[language] : ClassicLanguage.en
  }
}
