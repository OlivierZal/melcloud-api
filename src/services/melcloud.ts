import https from 'node:https'

import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
  HttpStatusCode,
} from 'axios'

import {
  type HourNumbers,
  DateTime,
  Duration,
  Settings as LuxonSettings,
} from 'luxon'

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

import { syncDevices } from '../decorators/index.ts'
import { DeviceType, Language } from '../enums.ts'
import {
  APICallRequestData,
  APICallResponseData,
  createAPICallErrorData,
} from '../logging/index.ts'
import { ModelRegistry } from '../models/index.ts'
import { now } from '../utils.ts'

import { DisposableTimeout } from './disposable-timeout.ts'
import {
  type APIConfig,
  type ErrorLog,
  type ErrorLogQuery,
  type IAPI,
  type Logger,
  type OnSyncFunction,
  type SettingManager,
  isAPISetting,
} from './interfaces.ts'

const DEVICE_TYPE_NAMES: Record<DeviceType, string> = {
  [DeviceType.Ata]: 'Ata',
  [DeviceType.Atw]: 'Atw',
  [DeviceType.Erv]: 'Erv',
}

const LIST_PATH = '/User/ListDevices'
const LOGIN_PATH = '/Login/ClientLogin3'

const NO_SYNC_INTERVAL = 0
const DEFAULT_SYNC_INTERVAL = 5
const RETRY_DELAY = 1000

const DEFAULT_ERROR_LOG_OFFSET = 0
const DEFAULT_ERROR_LOG_PERIOD = 1
const INVALID_YEAR = 1

const setting = (
  target: ClassAccessorDecoratorTarget<MELCloudAPI, string>,
  context: ClassAccessorDecoratorContext<MELCloudAPI, string>,
): ClassAccessorDecoratorResult<MELCloudAPI, string> => ({
  get(this: MELCloudAPI): string {
    const key = String(context.name)
    if (!isAPISetting(key)) {
      throw new Error(`Invalid setting: ${key}`)
    }
    return this.settingManager?.get(key) ?? target.get.call(this)
  },
  set(this: MELCloudAPI, value: string): void {
    const key = String(context.name)
    if (!isAPISetting(key)) {
      throw new Error(`Invalid setting: ${key}`)
    }
    if (this.settingManager) {
      this.settingManager.set(key, value)
      return
    }
    target.set.call(this, value)
  },
})

const isLanguage = (value: string): value is keyof typeof Language =>
  value in Language

const formatErrors = (errors: Record<string, readonly string[]>): string =>
  Object.entries(errors)
    .map(([error, messages]) => `${error}: ${messages.join(', ')}`)
    .join('\n')

const handleErrorLogQuery = ({
  from,
  limit,
  offset,
  to,
}: ErrorLogQuery): {
  fromDate: DateTime
  period: number
  toDate: DateTime
} => {
  const fromDate = from !== undefined && from ? DateTime.fromISO(from) : null
  const toDate = to !== undefined && to ? DateTime.fromISO(to) : DateTime.now()

  const numberLimit = Number(limit)
  const period =
    Number.isFinite(numberLimit) ? numberLimit : DEFAULT_ERROR_LOG_PERIOD

  const numberOffset = Number(offset)
  const daysOffset =
    !fromDate && Number.isFinite(numberOffset) ?
      numberOffset
    : DEFAULT_ERROR_LOG_OFFSET

  const daysLimit = fromDate ? DEFAULT_ERROR_LOG_PERIOD : period
  const days = daysLimit * daysOffset + daysOffset
  return {
    fromDate: fromDate ?? toDate.minus({ days: days + daysLimit }),
    period,
    toDate: toDate.minus({ days }),
  }
}

/**
 * Main MELCloud API client. Handles authentication, device syncing, and all
 * API endpoint calls. Uses a private constructor — create instances via {@link MELCloudAPI.create}.
 */
export class MELCloudAPI implements Disposable, IAPI {
  public readonly onSync?: OnSyncFunction

  protected readonly settingManager?: SettingManager

  readonly #api: AxiosInstance

  readonly #autoSyncInterval: number

  readonly #logger: Logger

  readonly #registry = new ModelRegistry()

  readonly #retryTimeout = new DisposableTimeout()

  readonly #syncTimeout = new DisposableTimeout()

  #language = 'en'

  #pauseListUntil = DateTime.now()

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
      minutes: autoSyncInterval ?? NO_SYNC_INTERVAL,
    }).as('milliseconds')
    this.#logger = logger
    this.onSync = onSync
    this.settingManager = settingManager
    this.#setOptionalProperties({
      language,
      password,
      timezone,
      username,
    })
    this.#api = this.#createAPI(shouldVerifySSL)
  }

  @setting
  private accessor contextKey = ''

  @setting
  private accessor expiry = ''

  @setting
  private accessor password = ''

  @setting
  private accessor username = ''

  public get registry(): ModelRegistry {
    return this.#registry
  }

  private get language(): string {
    return this.#language
  }

  private set language(value: string) {
    this.#language = value
    LuxonSettings.defaultLocale = value
  }

  /** Create and initialize a new API instance, performing an initial device sync. */
  public static async create(config?: APIConfig): Promise<MELCloudAPI> {
    const api = new MELCloudAPI(config)
    await api.fetch()
    return api
  }

  /** Fetch all buildings, sync the model registry, and schedule the next auto-sync. */
  @syncDevices()
  public async fetch(): Promise<Building[]> {
    this.clearSync()
    try {
      return await this.#fetch()
    } catch {
      return []
    } finally {
      this.#planNextSync()
    }
  }

  /**
   * Authenticate with MELCloud. If credentials are provided explicitly, errors
   * are thrown to the caller. If using stored credentials, errors are swallowed.
   */
  public async authenticate(data?: LoginCredentials): Promise<boolean> {
    const { password = this.password, username = this.username } = data ?? {}
    if (username && password) {
      try {
        return await this.#authenticate({ password, username })
      } catch (error) {
        if (data !== undefined) {
          throw error
        }
      }
    }
    return false
  }

  /** Cancel any pending automatic sync timer. */
  public clearSync(): void {
    this.#syncTimeout.clear()
  }

  public async energy({
    postData,
  }: {
    postData: EnergyPostData
  }): Promise<{ data: EnergyData<DeviceType> }> {
    return this.#api.post('/EnergyCost/Report', postData)
  }

  /**
   * Retrieve a parsed, paginated error log for the specified devices.
   * Filters out entries with invalid dates or empty messages.
   */
  public async errorLog(
    query: ErrorLogQuery,
    deviceIds = this.#registry.getAllDevices().map(({ id }) => id),
  ): Promise<ErrorLog> {
    const { fromDate, period, toDate } = handleErrorLogQuery(query)
    const nextToDate = fromDate.minus({ days: 1 })
    const errorLog = await this.#errorLog(deviceIds, fromDate, toDate)
    return {
      errors: errorLog
        .map(
          ({
            DeviceId: deviceId,
            ErrorMessage: errorMessage,
            StartDate: startDate,
          }) => ({
            date:
              DateTime.fromISO(startDate).year === INVALID_YEAR ?
                ''
              : DateTime.fromISO(startDate).toLocaleString(
                  DateTime.DATETIME_MED,
                ),
            device: this.#registry.getDeviceById(deviceId)?.name ?? '',
            error: errorMessage?.trim() ?? '',
          }),
        )
        .filter(({ date, error }) => Boolean(date && error))
        .toReversed(),
      fromDateHuman: fromDate.toLocaleString(DateTime.DATE_FULL),
      nextFromDate: nextToDate.minus({ days: period }).toISODate() ?? '',
      nextToDate: nextToDate.toISODate() ?? '',
    }
  }

  public async errors({
    postData,
  }: {
    postData: ErrorLogPostData
  }): Promise<{ data: ErrorLogData[] | FailureData }> {
    return this.#api.post('/Report/GetUnitErrorLog2', postData)
  }

  public async frostProtection({
    params,
  }: {
    params: SettingsParams
  }): Promise<{ data: FrostProtectionData }> {
    return this.#api.get('/FrostProtection/GetSettings', {
      params,
    })
  }

  public async group({
    postData,
  }: {
    postData: GetGroupPostData
  }): Promise<{ data: GetGroupData }> {
    return this.#api.post('/Group/Get', postData)
  }

  public async holidayMode({
    params,
  }: {
    params: SettingsParams
  }): Promise<{ data: HolidayModeData }> {
    return this.#api.get('/HolidayMode/GetSettings', {
      params,
    })
  }

  public async hourlyTemperatures({
    postData,
  }: {
    postData: { device: number; hour: HourNumbers }
  }): Promise<{ data: ReportData }> {
    return this.#api.post('/Report/GetHourlyTemperature', postData)
  }

  public async internalTemperatures({
    postData,
  }: {
    postData: ReportPostData
  }): Promise<{ data: ReportData }> {
    return this.#api.post('/Report/GetInternalTemperatures2', postData)
  }

  public async list(): Promise<{ data: Building[] }> {
    return this.#api.get(LIST_PATH)
  }

  public async login({
    postData,
  }: {
    postData: LoginPostData
  }): Promise<{ data: LoginData }> {
    return this.#api.post(LOGIN_PATH, postData)
  }

  public async operationModes({
    postData,
  }: {
    postData: ReportPostData
  }): Promise<{ data: OperationModeLogData }> {
    return this.#api.post('/Report/GetOperationModeLog2', postData)
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

  public async setLanguage({
    postData,
  }: {
    postData: { language: Language }
  }): Promise<{ data: boolean }> {
    return this.#api.post('/User/UpdateLanguage', postData)
  }

  public async setPower({
    postData,
  }: {
    postData: SetPowerPostData
  }): Promise<{ data: boolean }> {
    return this.#api.post('/Device/Power', postData)
  }

  public async setValues<T extends DeviceType>({
    postData,
    type,
  }: {
    postData: SetDevicePostData<T>
    type: T
  }): Promise<{ data: SetDeviceData<T> }> {
    return this.#api.post(`/Device/Set${DEVICE_TYPE_NAMES[type]}`, postData)
  }

  public async signal({
    postData,
  }: {
    postData: { devices: number | number[]; hour: HourNumbers }
  }): Promise<{ data: ReportData }> {
    return this.#api.post('/Report/GetSignalStrength', postData)
  }

  public async temperatures({
    postData,
  }: {
    postData: TemperatureLogPostData
  }): Promise<{ data: ReportData }> {
    return this.#api.post('/Report/GetTemperatureLog2', postData)
  }

  public async tiles({
    postData,
  }: {
    postData: TilesPostData<null>
  }): Promise<{ data: TilesData<null> }>
  public async tiles<T extends DeviceType>({
    postData,
  }: {
    postData: TilesPostData<T>
  }): Promise<{ data: TilesData<T> }>
  public async tiles<T extends DeviceType | null>({
    postData,
  }: {
    postData: TilesPostData<T>
  }): Promise<{ data: TilesData<T> }> {
    return this.#api.post('/Tile/Get2', postData)
  }

  /** Update the user's language on the server if it differs from the current locale. */
  public async updateLanguage(language: string): Promise<void> {
    if (language !== this.language) {
      const { data: hasLanguageChanged } = await this.setLanguage({
        postData: { language: this.#getLanguageCode(language) },
      })
      if (hasLanguageChanged) {
        this.language = language
      }
    }
  }

  public async values({
    params,
  }: {
    params: GetDeviceDataParams
  }): Promise<{ data: GetDeviceData<DeviceType> }> {
    return this.#api.get('/Device/Get', { params })
  }

  async #authenticate({
    password,
    username,
  }: LoginCredentials): Promise<boolean> {
    const {
      data: { LoginData: loginData },
    } = await this.login({
      postData: {
        AppVersion: '1.37.2.0',
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

  #canRetry(): boolean {
    if (!this.#retryTimeout.isActive) {
      this.#retryTimeout.schedule(() => {
        this.#retryTimeout.clear()
      }, RETRY_DELAY)
      return true
    }
    return false
  }

  #createAPI(rejectUnauthorized: boolean): AxiosInstance {
    const api = axios.create({
      baseURL: 'https://app.melcloud.com/Mitsubishi.Wifi.Client',
      httpsAgent: new https.Agent({ rejectUnauthorized }),
    })
    this.#setupAxiosInterceptors(api)
    return api
  }

  async #errorLog(
    deviceIds: number[],
    fromDate: DateTime,
    toDate: DateTime,
  ): Promise<ErrorLogData[]> {
    const { data } = await this.errors({
      postData: {
        DeviceIDs: deviceIds,
        FromDate: fromDate.toISODate() ?? undefined,
        ToDate: toDate.toISODate() ?? now(),
      },
    })
    if ('AttributeErrors' in data) {
      throw new Error(formatErrors(data.AttributeErrors))
    }
    return data
  }

  async #fetch(): Promise<Building[]> {
    const { data } = await this.list()
    this.#registry.syncBuildings(data)
    this.#registry.syncFloors(
      data.flatMap(({ Structure: { Floors: floors } }) => floors),
    )
    this.#registry.syncAreas(
      data.flatMap(({ Structure: { Areas: areas, Floors: floors } }) => [
        ...areas,
        ...floors.flatMap(({ Areas: floorAreas }) => floorAreas),
      ]),
    )
    this.#registry.syncDevices(
      data.flatMap(
        ({ Structure: { Areas: areas, Devices: devices, Floors: floors } }) => [
          ...devices,
          ...areas.flatMap(({ Devices: areaDevices }) => areaDevices),
          ...floors.flatMap(({ Areas: floorAreas, Devices: floorDevices }) => [
            ...floorDevices,
            ...floorAreas.flatMap(
              ({ Devices: floorAreaDevices }) => floorAreaDevices,
            ),
          ]),
        ],
      ),
    )
    return data
  }

  #getLanguageCode(language: string = this.language): Language {
    return isLanguage(language) ? Language[language] : Language.en
  }

  async #handleError(error: AxiosError): Promise<AxiosError> {
    const errorData = createAPICallErrorData(error)
    this.#logger.error(String(errorData))
    const { config, response: { status } = {} } = error
    if (status === HttpStatusCode.TooManyRequests) {
      this.#pauseListUntil = DateTime.now().plus({ hours: 2 })
    } else if (
      status === HttpStatusCode.Unauthorized &&
      this.#canRetry() &&
      config &&
      config.url !== LOGIN_PATH &&
      (await this.authenticate())
    ) {
      return this.#api.request(config)
    }
    throw new Error(errorData.errorMessage)
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
      const { contextKey, expiry } = this
      if (expiry && DateTime.fromISO(expiry) < DateTime.now()) {
        await this.authenticate()
      }
      newConfig.headers.set('X-MitsContextKey', contextKey)
    }
    this.#logger.log(String(new APICallRequestData(newConfig)))
    return newConfig
  }

  #handleResponse(response: AxiosResponse): AxiosResponse {
    this.#logger.log(String(new APICallResponseData(response)))
    return response
  }

  #planNextSync(): void {
    if (this.#autoSyncInterval) {
      this.#syncTimeout.schedule(() => {
        this.fetch().catch(() => {
          //
        })
      }, this.#autoSyncInterval)
    }
  }

  #setOptionalProperties({
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
