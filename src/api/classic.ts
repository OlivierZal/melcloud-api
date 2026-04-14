import https from 'node:https'

import { type HourNumbers, DateTime, Settings as LuxonSettings } from 'luxon'
import axios, { type AxiosInstance, type AxiosResponse } from 'axios'

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
import { ClassicRegistry } from '../models/index.ts'
import { isSessionExpired, toDeviceId } from '../resilience/index.ts'
import type {
  ClassicAPIAdapter,
  ClassicAPIConfig,
  ErrorLog,
  ErrorLogQuery,
} from './interfaces.ts'
import { BaseAPI } from './base.ts'

const deviceTypeNames = {
  [DeviceType.Ata]: 'Ata',
  [DeviceType.Atw]: 'Atw',
  [DeviceType.Erv]: 'Erv',
} satisfies Record<DeviceType, string>

const API_BASE_URL = 'https://app.melcloud.com/Mitsubishi.Wifi.Client'
const APP_VERSION = '1.37.2.0'
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
      language,
      password,
      requestTimeout = DEFAULT_TIMEOUT_MS,
      shouldVerifySSL = true,
      timezone,
      username,
    } = config
    const axiosInstance = ClassicAPI.#createAxiosInstance(
      shouldVerifySSL,
      requestTimeout,
    )
    super(
      { ...config, autoSyncInterval },
      {
        axiosConfig: { baseURL: API_BASE_URL, timeout: requestTimeout },
        axiosInstance,
        rateLimitHours: DEFAULT_RETRY_HOURS,
        retryDelay: RETRY_DELAY,
        syncCallback: async () => this.fetch(),
      },
    )
    this.#applyOptionalConfig({ language, password, timezone, username })
  }

  static #createAxiosInstance(
    shouldRejectUnauthorized: boolean,
    timeout: number,
  ): AxiosInstance {
    return axios.create({
      baseURL: API_BASE_URL,
      httpsAgent: new https.Agent({
        rejectUnauthorized: shouldRejectUnauthorized,
      }),
      timeout,
    })
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
  public async authenticate(data?: LoginCredentials): Promise<boolean> {
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
  @syncDevices()
  public async fetch(): Promise<BuildingWithStructure[]> {
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

  public async getEnergy<T extends DeviceType>({
    postData,
  }: {
    postData: EnergyPostData
  }): Promise<{ data: EnergyData<T> }> {
    return this.request('post', '/EnergyCost/Report', { data: postData })
  }

  public async getErrorEntries({
    postData,
  }: {
    postData: ErrorLogPostData
  }): Promise<{ data: ErrorLogData[] | FailureData }> {
    return this.request('post', '/Report/GetUnitErrorLog2', { data: postData })
  }

  public async getFrostProtection({
    params,
  }: {
    params: SettingsParams
  }): Promise<{ data: FrostProtectionData }> {
    return this.request('get', '/FrostProtection/GetSettings', { params })
  }

  public isAuthenticated(): boolean {
    return this.contextKey !== ''
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

  public async getGroup({
    postData,
  }: {
    postData: GetGroupPostData
  }): Promise<{ data: GetGroupData }> {
    return this.request('post', '/Group/Get', { data: postData })
  }

  public async getHolidayMode({
    params,
  }: {
    params: SettingsParams
  }): Promise<{ data: HolidayModeData }> {
    return this.request('get', '/HolidayMode/GetSettings', { params })
  }

  public async getHourlyTemperatures({
    postData,
  }: {
    postData: { device: number; hour: HourNumbers }
  }): Promise<{ data: ReportData }> {
    return this.request('post', '/Report/GetHourlyTemperature', {
      data: postData,
    })
  }

  public async getInternalTemperatures({
    postData,
  }: {
    postData: ReportPostData
  }): Promise<{ data: ReportData }> {
    return this.request('post', '/Report/GetInternalTemperatures2', {
      data: postData,
    })
  }

  public async getOperationModes({
    postData,
  }: {
    postData: ReportPostData
  }): Promise<{ data: OperationModeLogData }> {
    return this.request('post', '/Report/GetOperationModeLog2', {
      data: postData,
    })
  }

  public async getSignal({
    postData,
  }: {
    postData: { devices: number | number[]; hour: HourNumbers }
  }): Promise<{ data: ReportData }> {
    return this.request('post', '/Report/GetSignalStrength', {
      data: postData,
    })
  }

  public async getTemperatures({
    postData,
  }: {
    postData: TemperatureLogPostData
  }): Promise<{ data: ReportData }> {
    return this.request('post', '/Report/GetTemperatureLog2', {
      data: postData,
    })
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
    return this.request('post', '/Tile/Get2', { data: postData })
  }

  public async getValues<T extends DeviceType>({
    params,
  }: {
    params: GetDeviceDataParams
  }): Promise<{ data: GetDeviceData<T> }> {
    return this.request('get', '/Device/Get', { params })
  }

  public async list(): Promise<{ data: BuildingWithStructure[] }> {
    return this.request('get', LIST_PATH)
  }

  public async login({
    postData,
  }: {
    postData: LoginPostData
  }): Promise<{ data: LoginData }> {
    return this.dispatch('post', LOGIN_PATH, { data: postData })
  }

  public async updateFrostProtection({
    postData,
  }: {
    postData: FrostProtectionPostData
  }): Promise<{ data: FailureData | SuccessData }> {
    return this.request('post', '/FrostProtection/Update', { data: postData })
  }

  public async updateGroupState({
    postData,
  }: {
    postData: SetGroupPostData
  }): Promise<{ data: FailureData | SuccessData }> {
    return this.request('post', '/Group/SetAta', { data: postData })
  }

  public async updateHolidayMode({
    postData,
  }: {
    postData: HolidayModePostData
  }): Promise<{ data: FailureData | SuccessData }> {
    return this.request('post', '/HolidayMode/Update', { data: postData })
  }

  /**
   * Update the user's language on the server if it differs from the current locale.
   * @param language - The language code to set.
   */
  public async updateLanguage(language: string): Promise<void> {
    if (language !== this.language) {
      const { data: hasLanguageChanged } = await this.request<boolean>(
        'post',
        '/User/UpdateLanguage',
        { data: { language: this.#getLanguageCode(language) } },
      )
      if (hasLanguageChanged) {
        this.language = language
      }
    }
  }

  public async updatePower({
    postData,
  }: {
    postData: SetPowerPostData
  }): Promise<{ data: boolean }> {
    return this.request('post', '/Device/Power', { data: postData })
  }

  public async updateValues<T extends DeviceType>({
    postData,
    type,
  }: {
    postData: SetDevicePostData<T>
    type: T
  }): Promise<{ data: SetDeviceData<T> }> {
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

  protected async retryAuth(
    method: string,
    url: string,
    config: Record<string, unknown>,
  ): Promise<AxiosResponse | null> {
    if (await this.authenticate()) {
      return this.dispatch(method, url, config)
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
  ): Promise<ErrorLogData[]> {
    const { data } = await this.getErrorEntries({
      postData: {
        DeviceIDs: deviceIds.map((id) => toDeviceId(id)),
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
}
