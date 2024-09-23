import {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
  HttpStatusCode,
  create as createAxiosInstance,
} from 'axios'
import https from 'https'
import { DateTime, Duration, Settings as LuxonSettings } from 'luxon'

import { AreaModel, BuildingModel, DeviceModel, FloorModel } from '../models'
import {
  type Building,
  type DeviceType,
  type EnergyData,
  type EnergyPostData,
  type ErrorData,
  type ErrorPostData,
  type FailureData,
  type FrostProtectionData,
  type FrostProtectionPostData,
  type GetDeviceData,
  type GetDeviceDataParams,
  type GetGroupAtaData,
  type GetGroupAtaPostData,
  type HolidayModeData,
  type HolidayModePostData,
  type LoginCredentials,
  type LoginData,
  type LoginPostData,
  type SetDeviceData,
  type SetDevicePostData,
  type SetGroupAtaPostData,
  type SetPowerPostData,
  type SettingsParams,
  type SuccessData,
  type TilesData,
  type TilesPostData,
  type WifiData,
  type WifiPostData,
  Language,
} from '../types'
import {
  type APIConfig,
  type IAPI,
  type Logger,
  type SettingManager,
  isAPISetting,
} from './interfaces'
import {
  APICallRequestData,
  APICallResponseData,
  createAPICallErrorData,
} from './logger'

const LIST_PATH = '/User/ListDevices'
const LOGIN_PATH = '/Login/ClientLogin2'

const DEFAULT_SYNC_INTERVAL = 5
const NO_SYNC_INTERVAL = 0
const RETRY_DELAY = Duration.fromObject({ minutes: 1 }).as('milliseconds')

const setting = <This extends API>(
  target: ClassAccessorDecoratorTarget<This, string>,
  context: ClassAccessorDecoratorContext<This, string>,
): ClassAccessorDecoratorResult<This, string> => ({
  get(this: This): string {
    const key = String(context.name)
    if (!isAPISetting(key)) {
      throw new Error(`Invalid setting: ${key}`)
    }
    return this.settingManager?.get(key) ?? target.get.call(this)
  },
  set(this: This, value: string): void {
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

export default class API implements IAPI {
  public readonly onSync?: () => Promise<void>

  protected readonly settingManager?: SettingManager

  #holdAPIListUntil = DateTime.now()

  #language = 'en'

  #retryTimeout: NodeJS.Timeout | null = null

  #syncTimeout: NodeJS.Timeout | null = null

  readonly #api: AxiosInstance

  readonly #autoSyncInterval: number

  readonly #logger: Logger

  private constructor(config: APIConfig = {}) {
    const {
      autoSyncInterval = DEFAULT_SYNC_INTERVAL,
      language,
      logger = console,
      onSync,
      settingManager,
      shouldVerifySSL = true,
      timezone,
    } = config
    if (language !== undefined) {
      this.language = language
    }
    if (timezone !== undefined) {
      LuxonSettings.defaultZone = timezone
    }
    this.#autoSyncInterval = Duration.fromObject({
      minutes: autoSyncInterval ?? NO_SYNC_INTERVAL,
    }).as('milliseconds')
    this.#logger = logger
    this.onSync = onSync
    this.settingManager = settingManager
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

  public get language(): string {
    return this.#language
  }

  private set language(value: string) {
    this.#language = value
    LuxonSettings.defaultLocale = this.#language
  }

  public static async create(config: APIConfig = {}): Promise<API> {
    const api = new API(config)
    await api.fetch()
    return api
  }

  public clearSync(): void {
    if (this.#syncTimeout) {
      clearTimeout(this.#syncTimeout)
      this.#syncTimeout = null
    }
  }

  public async fetch(): Promise<Building[]> {
    this.clearSync()
    try {
      const { data } = await this.#fetch()
      data.forEach((building) => {
        BuildingModel.upsert(building)
        building.Structure.Floors.forEach((floor) => {
          FloorModel.upsert(floor)
          floor.Areas.forEach((area) => {
            AreaModel.upsert(area)
            DeviceModel.upsertMany(area.Devices)
          })
          DeviceModel.upsertMany(floor.Devices)
        })
        building.Structure.Areas.forEach((area) => {
          AreaModel.upsert(area)
          DeviceModel.upsertMany(area.Devices)
        })
        DeviceModel.upsertMany(building.Structure.Devices)
      })
      await this.onSync?.()
      return data
    } catch (_error) {
      return []
    } finally {
      this.#autoSync()
    }
  }

  public async get({
    params,
  }: {
    params: GetDeviceDataParams
  }): Promise<{ data: GetDeviceData[keyof typeof DeviceType] }> {
    return this.#api.get('/Device/Get', { params })
  }

  public async getAta({
    postData,
  }: {
    postData: GetGroupAtaPostData
  }): Promise<{ data: GetGroupAtaData }> {
    try {
      return await this.#api.post('/Group/Get', postData)
    } catch (_error) {
      throw new Error('No air-to-air device found')
    }
  }

  public async getEnergyReport({
    postData,
  }: {
    postData: EnergyPostData
  }): Promise<{ data: EnergyData[keyof typeof DeviceType] }> {
    return this.#api.post('/EnergyCost/Report', postData)
  }

  public async getErrors({
    postData,
  }: {
    postData: ErrorPostData
  }): Promise<{ data: ErrorData[] | FailureData }> {
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

  public async getHolidayMode({
    params,
  }: {
    params: SettingsParams
  }): Promise<{ data: HolidayModeData }> {
    return this.#api.get('/HolidayMode/GetSettings', {
      params,
    })
  }

  public async getTiles({
    postData,
  }: {
    postData: TilesPostData<null>
  }): Promise<{ data: TilesData<null> }>

  public async getTiles<T extends keyof typeof DeviceType>({
    postData,
  }: {
    postData: TilesPostData<T>
  }): Promise<{ data: TilesData<T> }>

  public async getTiles<T extends keyof typeof DeviceType | null>({
    postData,
  }: {
    postData: TilesPostData<T>
  }): Promise<{ data: TilesData<T> }> {
    return this.#api.post('/Tile/Get2', postData)
  }

  public async getWifiReport({
    postData,
  }: {
    postData: WifiPostData
  }): Promise<{ data: WifiData }> {
    return this.#api.post('/Report/GetSignalStrength', postData)
  }

  public async login(data?: LoginCredentials): Promise<boolean> {
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

  public async set<T extends keyof typeof DeviceType>({
    heatPumpType,
    postData,
  }: {
    heatPumpType: T
    postData: SetDevicePostData[T]
  }): Promise<{ data: SetDeviceData[T] }> {
    return this.#api.post(`/Device/Set${heatPumpType}`, postData)
  }

  public async setAta({
    postData,
  }: {
    postData: SetGroupAtaPostData
  }): Promise<{ data: FailureData | SuccessData }> {
    try {
      return await this.#api.post('/Group/SetAta', postData)
    } catch (_error) {
      throw new Error('No air-to-air device found')
    }
  }

  public async setFrostProtection({
    postData,
  }: {
    postData: FrostProtectionPostData
  }): Promise<{ data: FailureData | SuccessData }> {
    return this.#api.post('/FrostProtection/Update', postData)
  }

  public async setHolidayMode({
    postData,
  }: {
    postData: HolidayModePostData
  }): Promise<{ data: FailureData | SuccessData }> {
    return this.#api.post('/HolidayMode/Update', postData)
  }

  public async setLanguage(language: string): Promise<boolean> {
    const { data: didLanguageChange } = await this.#setLanguage({
      postData: { language: this.#getLanguageCode(language) },
    })
    if (didLanguageChange) {
      this.language = language
    }
    return didLanguageChange
  }

  public async setPower({
    postData,
  }: {
    postData: SetPowerPostData
  }): Promise<{ data: boolean }> {
    return this.#api.post('/Device/Power', postData)
  }

  async #authenticate({
    password,
    username,
  }: {
    password: string
    username: string
  }): Promise<boolean> {
    const { LoginData: loginData } = (
      await this.#login({
        postData: {
          AppVersion: '1.34.10.0',
          Email: username,
          Language: this.#getLanguageCode(),
          Password: password,
          Persist: true,
        },
      })
    ).data
    if (loginData) {
      this.username = username
      this.password = password
      this.contextKey = loginData.ContextKey
      this.expiry = loginData.Expiry
      await this.fetch()
    }
    return loginData !== null
  }

  #autoSync(): void {
    if (this.#autoSyncInterval) {
      this.#syncTimeout = setTimeout(() => {
        this.fetch().catch(() => {
          //
        })
      }, this.#autoSyncInterval)
    }
  }

  #canRetry(): boolean {
    if (!this.#retryTimeout) {
      this.#retryTimeout = setTimeout(() => {
        this.#retryTimeout = null
      }, RETRY_DELAY)
      return true
    }
    return false
  }

  #createAPI(rejectUnauthorized: boolean): AxiosInstance {
    const api = createAxiosInstance({
      baseURL: 'https://app.melcloud.com/Mitsubishi.Wifi.Client',
      httpsAgent: new https.Agent({ rejectUnauthorized }),
    })
    this.#setupAxiosInterceptors(api)
    return api
  }

  async #fetch(): Promise<{ data: Building[] }> {
    return this.#api.get<Building[]>(LIST_PATH)
  }

  #getLanguageCode(language: string = this.#language): Language {
    return language in Language ?
        Language[language as keyof typeof Language]
      : Language.en
  }

  async #handleError(error: AxiosError): Promise<AxiosError> {
    const errorData = createAPICallErrorData(error)
    this.#logger.error(String(errorData))
    switch (error.response?.status) {
      case HttpStatusCode.Unauthorized:
        if (this.#canRetry() && error.config?.url !== LOGIN_PATH) {
          if ((await this.login()) && error.config) {
            return this.#api.request(error.config)
          }
        }
        break
      case HttpStatusCode.TooManyRequests:
        this.#holdAPIListUntil = DateTime.now().plus({ hours: 2 })
        break
      default:
    }
    throw new Error(errorData.errorMessage)
  }

  async #handleRequest(
    config: InternalAxiosRequestConfig,
  ): Promise<InternalAxiosRequestConfig> {
    const newConfig = { ...config }
    if (
      newConfig.url === LIST_PATH &&
      this.#holdAPIListUntil > DateTime.now()
    ) {
      throw new Error(
        `API requests to ${LIST_PATH} are on hold for ${this.#holdAPIListUntil
          .diffNow()
          .shiftTo('minutes')
          .toHuman()}`,
      )
    }
    if (newConfig.url !== LOGIN_PATH) {
      const { contextKey, expiry } = this
      if (expiry && DateTime.fromISO(expiry) < DateTime.now()) {
        await this.login()
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

  async #login({
    postData: { Email: username, Password: password, ...rest },
  }: {
    postData: LoginPostData
  }): Promise<{ data: LoginData }> {
    return this.#api.post<LoginData>(LOGIN_PATH, {
      Email: username,
      Password: password,
      ...rest,
    })
  }

  async #setLanguage({
    postData,
  }: {
    postData: { language: Language }
  }): Promise<{ data: boolean }> {
    return this.#api.post<boolean>('/User/UpdateLanguage', postData)
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
