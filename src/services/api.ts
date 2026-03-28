import https from 'node:https'

import {
  type HourNumbers,
  DateTime,
  Duration,
  Settings as LuxonSettings,
} from 'luxon'
import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
  HttpStatusCode,
} from 'axios'

import type {
  AreaDataAny,
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
  ListDeviceAny,
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
import { DeviceType, Language } from '../constants.ts'
import { authenticate, setting, syncDevices } from '../decorators/index.ts'
import {
  APICallRequestData,
  APICallResponseData,
  createAPICallErrorData,
} from '../logging/index.ts'
import { ModelRegistry } from '../models/index.ts'
import type {
  API,
  APIConfig,
  ErrorLog,
  ErrorLogQuery,
  Logger,
  OnSyncFunction,
  SettingManager,
} from './interfaces.ts'
import { DisposableTimeout } from './disposable-timeout.ts'

const deviceTypeNames = {
  [DeviceType.Ata]: 'Ata',
  [DeviceType.Atw]: 'Atw',
  [DeviceType.Erv]: 'Erv',
} satisfies Record<DeviceType, string>

const API_BASE_URL = 'https://app.melcloud.com/Mitsubishi.Wifi.Client'
const APP_VERSION = '1.37.2.0'
const LIST_PATH = '/User/ListDevices'
const LOGIN_PATH = '/Login/ClientLogin3'
const noop = (): void => undefined

const DEFAULT_RETRY_HOURS = 2
const DEFAULT_SYNC_INTERVAL = 5
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

const isLanguage = (value: string): value is keyof typeof Language =>
  value in Language

const formatErrors = (errors: Record<string, readonly string[]>): string =>
  Object.entries(errors)
    .map(([error, messages]) => `${error}: ${messages.join(', ')}`)
    .join('\n')

const parseErrorLogQuery = ({
  from,
  limit,
  offset,
  to,
}: ErrorLogQuery): {
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
  buildings: BuildingWithStructure[],
): Generator<AreaDataAny> {
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
  buildings: BuildingWithStructure[],
): Generator<ListDeviceAny> {
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
 * Main MELCloud API client. Handles authentication, device syncing, and all
 * API endpoint calls. Uses a private constructor — create instances via {@link MELCloudAPI.create}.
 */
export class MELCloudAPI implements API, Disposable {
  readonly #api: AxiosInstance

  #autoSyncInterval: number

  #language = 'en'

  #pauseListUntil = DateTime.now()

  readonly #registry = new ModelRegistry()

  readonly #retryTimeout = new DisposableTimeout()

  readonly #syncTimeout = new DisposableTimeout()

  public readonly logger: Logger

  public readonly onSync?: OnSyncFunction

  public readonly settingManager?: SettingManager

  @setting
  private accessor contextKey = ''

  @setting
  private accessor expiry = ''

  @setting
  private accessor password = ''

  @setting
  private accessor username = ''

  private get language(): string {
    return this.#language
  }

  private set language(value: string) {
    this.#language = value
    LuxonSettings.defaultLocale = value
  }

  public get registry(): ModelRegistry {
    return this.#registry
  }

  private constructor(config: APIConfig = {}) {
    const {
      autoSyncInterval = DEFAULT_SYNC_INTERVAL,
      language,
      logger = console,
      onSync,
      password,
      settingManager,
      shouldVerifySSL = true,
      timezone,
      username,
    } = config
    this.#autoSyncInterval = Duration.fromObject({
      minutes: autoSyncInterval ?? 0,
    }).as('milliseconds')
    this.logger = logger
    this.onSync = onSync
    this.settingManager = settingManager
    this.#applyOptionalConfig({ language, password, timezone, username })
    this.#api = this.#createAPI(shouldVerifySSL)
  }

  /**
   * Create and initialize a new API instance, performing an initial device sync.
   * @param config - Optional configuration for the API client.
   * @returns The initialized API instance.
   */
  public static async create(config?: APIConfig): Promise<MELCloudAPI> {
    const api = new MELCloudAPI(config)
    await api.fetch()
    return api
  }

  @authenticate
  public async authenticate(data?: LoginCredentials): Promise<boolean> {
    const { password, username } = data ?? { password: '', username: '' }
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
  @syncDevices()
  public async fetch(): Promise<BuildingWithStructure[]> {
    this.clearSync()
    try {
      return await this.#fetch()
    } catch (error) {
      this.logger.error('Failed to fetch devices:', error)
      return []
    } finally {
      this.#planNextSync()
    }
  }

  /** Cancel any pending automatic sync timer. */
  public clearSync(): void {
    this.#syncTimeout.clear()
  }

  public async getEnergy<T extends DeviceType>({
    postData,
  }: {
    postData: EnergyPostData
  }): Promise<{ data: EnergyData<T> }> {
    return this.#api.post('/EnergyCost/Report', postData)
  }

  public async getErrorEntries({
    postData,
  }: {
    postData: ErrorLogPostData
  }): Promise<{ data: ErrorLogData[] | FailureData }> {
    return this.#api.post('/Report/GetUnitErrorLog2', postData)
  }

  public async getFrostProtection({
    params,
  }: {
    params: SettingsParams
  }): Promise<{ data: FrostProtectionData }> {
    return this.#api.get('/FrostProtection/GetSettings', {
      params,
    })
  }

  /**
   * Retrieve a parsed, paginated error log for the specified devices.
   * Filters out entries with invalid dates or empty messages.
   * @param query - The error log query parameters (date range, pagination).
   * @param deviceIds - Device IDs to fetch errors for; defaults to all devices.
   * @returns Parsed error log with pagination metadata.
   */
  public async getErrorLog(
    query: ErrorLogQuery,
    deviceIds = this.#registry.getDevices().map(({ id }) => id),
  ): Promise<ErrorLog> {
    const { fromDate, period, toDate } = parseErrorLogQuery(query)
    const nextToDate = fromDate.minus({ days: 1 })
    const errorLog = await this.#errorLog(deviceIds, fromDate, toDate)

    return {
      errors: errorLog
        .flatMap(
          ({
            DeviceId: deviceId,
            ErrorMessage: errorMessage,
            StartDate: startDate,
          }) => {
            const dateTime = DateTime.fromISO(startDate)
            const date =
              dateTime.year === INVALID_YEAR ?
                ''
              : dateTime.toLocaleString(DateTime.DATETIME_MED)
            const device = this.#registry.devices.getById(deviceId)?.name ?? ''
            const error = errorMessage?.trim() ?? ''
            return date && error ? [{ date, device, error }] : []
          },
        )
        .toReversed(),
      fromDateHuman: fromDate.toLocaleString(DateTime.DATE_FULL),
      nextFromDate: toISODate(nextToDate.minus({ days: period })),
      nextToDate: toISODate(nextToDate),
    }
  }

  public async getGroup({
    postData,
  }: {
    postData: GetGroupPostData
  }): Promise<{ data: GetGroupData }> {
    return this.#api.post('/Group/Get', postData)
  }

  public async getHolidayMode({
    params,
  }: {
    params: SettingsParams
  }): Promise<{ data: HolidayModeData }> {
    return this.#api.get('/HolidayMode/GetSettings', {
      params,
    })
  }

  public async getHourlyTemperatures({
    postData,
  }: {
    postData: { device: number; hour: HourNumbers }
  }): Promise<{ data: ReportData }> {
    return this.#api.post('/Report/GetHourlyTemperature', postData)
  }

  public async getInternalTemperatures({
    postData,
  }: {
    postData: ReportPostData
  }): Promise<{ data: ReportData }> {
    return this.#api.post('/Report/GetInternalTemperatures2', postData)
  }

  public async getOperationModes({
    postData,
  }: {
    postData: ReportPostData
  }): Promise<{ data: OperationModeLogData }> {
    return this.#api.post('/Report/GetOperationModeLog2', postData)
  }

  public async getSignal({
    postData,
  }: {
    postData: { devices: number | number[]; hour: HourNumbers }
  }): Promise<{ data: ReportData }> {
    return this.#api.post('/Report/GetSignalStrength', postData)
  }

  public async getTemperatures({
    postData,
  }: {
    postData: TemperatureLogPostData
  }): Promise<{ data: ReportData }> {
    return this.#api.post('/Report/GetTemperatureLog2', postData)
  }

  public async getTiles({
    postData,
  }: {
    postData: TilesPostData<null>
  }): Promise<{ data: TilesData<null> }>
  public async getTiles<T extends DeviceType>({
    postData,
  }: {
    postData: TilesPostData<T>
  }): Promise<{ data: TilesData<T> }>
  public async getTiles<T extends DeviceType | null>({
    postData,
  }: {
    postData: TilesPostData<T>
  }): Promise<{ data: TilesData<T> }> {
    return this.#api.post('/Tile/Get2', postData)
  }

  public async getValues<T extends DeviceType>({
    params,
  }: {
    params: GetDeviceDataParams
  }): Promise<{ data: GetDeviceData<T> }> {
    return this.#api.get('/Device/Get', { params })
  }

  public async list(): Promise<{ data: BuildingWithStructure[] }> {
    return this.#api.get(LIST_PATH)
  }

  public async login({
    postData,
  }: {
    postData: LoginPostData
  }): Promise<{ data: LoginData }> {
    return this.#api.post(LOGIN_PATH, postData)
  }

  /** Dispose both sync and retry timers. */
  public [Symbol.dispose](): void {
    this.#syncTimeout[Symbol.dispose]()
    this.#retryTimeout[Symbol.dispose]()
  }

  public async setFrostProtection({
    postData,
  }: {
    postData: FrostProtectionPostData
  }): Promise<{ data: FailureData | SuccessData }> {
    return this.#api.post('/FrostProtection/Update', postData)
  }

  public async setGroup({
    postData,
  }: {
    postData: SetGroupPostData
  }): Promise<{ data: FailureData | SuccessData }> {
    return this.#api.post('/Group/SetAta', postData)
  }

  public async setHolidayMode({
    postData,
  }: {
    postData: HolidayModePostData
  }): Promise<{ data: FailureData | SuccessData }> {
    return this.#api.post('/HolidayMode/Update', postData)
  }

  /**
   * Update the user's language on the server if it differs from the current locale.
   * @param language - The language code to set.
   */
  public async setLanguage(language: string): Promise<void> {
    if (language !== this.language) {
      const { data: hasLanguageChanged } = await this.#api.post<boolean>(
        '/User/UpdateLanguage',
        { language: this.#getLanguageCode(language) },
      )
      if (hasLanguageChanged) {
        this.language = language
      }
    }
  }

  public async setPower({
    postData,
  }: {
    postData: SetPowerPostData
  }): Promise<{ data: boolean }> {
    return this.#api.post('/Device/Power', postData)
  }

  /**
   * Update the automatic sync interval and reschedule.
   * @param minutes - Interval in minutes. Set to `0` or `null` to disable auto-sync.
   */
  public setSyncInterval(minutes: number | null): void {
    this.#autoSyncInterval = Duration.fromObject({
      minutes: minutes ?? 0,
    }).as('milliseconds')
    this.clearSync()
    this.#planNextSync()
  }

  public async setValues<T extends DeviceType>({
    postData,
    type,
  }: {
    postData: SetDevicePostData<T>
    type: T
  }): Promise<{ data: SetDeviceData<T> }> {
    return this.#api.post(`/Device/Set${deviceTypeNames[type]}`, postData)
  }

  // Allow one retry per RETRY_DELAY window to avoid infinite retry loops
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
    if (username !== undefined) {
      this.username = username
    }
    if (password !== undefined) {
      this.password = password
    }
  }

  #canRetry(): boolean {
    if (!this.#retryTimeout.isActive) {
      this.#retryTimeout.schedule(noop, RETRY_DELAY)
      return true
    }
    return false
  }

  #createAPI(shouldRejectUnauthorized: boolean): AxiosInstance {
    const api = axios.create({
      baseURL: API_BASE_URL,
      httpsAgent: new https.Agent({
        rejectUnauthorized: shouldRejectUnauthorized,
      }),
    })
    this.#setupAxiosInterceptors(api)
    return api
  }

  async #errorLog(
    deviceIds: number[],
    fromDate: DateTime,
    toDate: DateTime,
  ): Promise<ErrorLogData[]> {
    const { data } = await this.getErrorEntries({
      postData: {
        DeviceIDs: deviceIds,
        FromDate: toISODate(fromDate),
        ToDate: toISODate(toDate),
      },
    })
    if ('AttributeErrors' in data) {
      throw new Error(formatErrors(data.AttributeErrors))
    }
    return data
  }

  async #fetch(): Promise<BuildingWithStructure[]> {
    const { data } = await this.list()
    this.#registry.syncBuildings(data)
    this.#registry.syncFloors(
      data.flatMap(({ Structure: { Floors: floors } }) => floors),
    )
    this.#registry.syncAreas([...collectAreas(data)])
    this.#registry.syncDevices([...collectDevices(data)])
    return data
  }

  #getLanguageCode(language: string = this.language): Language {
    return isLanguage(language) ? Language[language] : Language.en
  }

  async #handleError(error: AxiosError): Promise<AxiosError> {
    const errorData = createAPICallErrorData(error)
    this.logger.error(String(errorData))

    const { config, response: { headers, status } = {} } = error
    if (status === HttpStatusCode.TooManyRequests) {
      const retryAfterSeconds = Number(headers?.['retry-after'])
      const retryDuration =
        Number.isFinite(retryAfterSeconds) ?
          { seconds: retryAfterSeconds }
        : { hours: DEFAULT_RETRY_HOURS }
      this.#pauseListUntil = DateTime.now().plus(retryDuration)
      this.logger.error(
        `Rate limited (429): pausing list operations for ${this.#pauseListUntil.diffNow().shiftTo('minutes').toHuman()}`,
      )
    } else if (
      status === HttpStatusCode.Unauthorized &&
      this.#canRetry() &&
      config &&
      config.url !== LOGIN_PATH &&
      (await this.authenticate())
    ) {
      return this.#api.request(config)
    }
    throw new Error(errorData.errorMessage, { cause: error })
  }

  async #handleRequest(
    config: InternalAxiosRequestConfig,
  ): Promise<InternalAxiosRequestConfig> {
    const newConfig = { ...config }
    if (newConfig.url === LIST_PATH && this.#pauseListUntil > DateTime.now()) {
      throw new Error(
        `API requests to ${LIST_PATH} are on hold for ${this.#pauseListUntil
          .diffNow()
          .shiftTo('minutes')
          .toHuman()}`,
      )
    }
    if (newConfig.url !== LOGIN_PATH) {
      // Re-authenticate proactively if session token has expired
      const { contextKey, expiry } = this
      if (expiry && DateTime.fromISO(expiry) < DateTime.now()) {
        await this.authenticate()
      }
      newConfig.headers.set('X-MitsContextKey', contextKey)
    }
    this.logger.log(String(new APICallRequestData(newConfig)))
    return newConfig
  }

  #handleResponse(response: AxiosResponse): AxiosResponse {
    this.logger.log(String(new APICallResponseData(response)))
    return response
  }

  #planNextSync(): void {
    if (this.#autoSyncInterval) {
      this.#syncTimeout.schedule(() => {
        this.fetch().catch((error: unknown) => {
          this.logger.error('Auto-sync failed:', error)
        })
      }, this.#autoSyncInterval)
    }
  }

  #setupAxiosInterceptors(api: AxiosInstance): void {
    api.interceptors.request.use(
      async (
        config: InternalAxiosRequestConfig,
      ): Promise<InternalAxiosRequestConfig> => this.#handleRequest(config),
      async (error: AxiosError): Promise<AxiosError> =>
        this.#handleError(error),
    )
    api.interceptors.response.use(
      (response: AxiosResponse): AxiosResponse =>
        this.#handleResponse(response),
      async (error: AxiosError): Promise<AxiosError> =>
        this.#handleError(error),
    )
  }
}
