import {
  APICallRequestData,
  APICallResponseData,
  createAPICallErrorData,
} from './logger'
import { AreaModel, BuildingModel, DeviceModel, FloorModel } from '../models'
import {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  HttpStatusCode,
  type InternalAxiosRequestConfig,
  create as createAxiosInstance,
} from 'axios'
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
  type HolidayModeData,
  type HolidayModePostData,
  Language,
  type LoginCredentials,
  type LoginData,
  type LoginPostData,
  type SetAtaGroupPostData,
  type SetDeviceData,
  type SetDevicePostData,
  type SetPowerPostData,
  type SettingsParams,
  type SuccessData,
  type TilesData,
  type TilesPostData,
  type WifiData,
  type WifiPostData,
} from '../types'
import { DateTime, Duration, Settings as LuxonSettings } from 'luxon'
import {
  type IMELCloudAPI,
  type Logger,
  type SettingManager,
  isAPISetting,
} from './interfaces'
import https from 'https'

const LIST_URL = '/User/ListDevices'
const LOGIN_URL = '/Login/ClientLogin'

const MINUTES_0 = 0
const MINUTES_5 = 5

const getLanguage = (language = LuxonSettings.defaultLocale): Language =>
  language in Language ?
    Language[language as keyof typeof Language]
  : Language.en

const setting = <T extends API, R extends string | null | undefined>(
  target: ClassAccessorDecoratorTarget<T, R>,
  context: ClassAccessorDecoratorContext<T, R>,
): ClassAccessorDecoratorResult<T, R> => ({
  get(this: T): R {
    const key = String(context.name)
    if (!isAPISetting(key)) {
      throw new Error(`Invalid setting: ${key}`)
    }
    return typeof this.settingManager === 'undefined' ?
        target.get.call(this)
      : (this.settingManager.get(key) as R)
  },
  set(this: T, value: R): void {
    const key = String(context.name)
    if (!isAPISetting(key)) {
      throw new Error(`Invalid setting: ${key}`)
    }
    if (typeof this.settingManager === 'undefined') {
      target.set.call(this, value)
    } else {
      this.settingManager.set(key, value)
    }
  },
})

export default class API implements IMELCloudAPI {
  protected readonly settingManager?: SettingManager

  readonly #syncFunction?: () => Promise<void>

  @setting
  accessor contextKey = ''

  @setting
  accessor expiry = ''

  @setting
  accessor password = ''

  @setting
  accessor username = ''

  #holdAPIListUntil = DateTime.now()

  #retry = true

  #retryTimeout!: NodeJS.Timeout

  #syncTimeout: NodeJS.Timeout | null = null

  readonly #api: AxiosInstance

  readonly #autoSync: Duration

  readonly #logger: Logger

  public constructor(
    config: {
      autoSync?: number | null
      language?: string
      logger?: Logger
      settingManager?: SettingManager
      shouldVerifySSL?: boolean
      syncFunction?: () => Promise<void>
      timezone?: string
    } = {},
  ) {
    const {
      autoSync = MINUTES_5,
      language = 'en',
      logger = console,
      settingManager,
      shouldVerifySSL = true,
      syncFunction,
      timezone,
    } = config
    LuxonSettings.defaultLocale = language
    if (typeof timezone !== 'undefined') {
      LuxonSettings.defaultZone = timezone
    }
    this.settingManager = settingManager
    this.#api = createAxiosInstance({
      baseURL: 'https://app.melcloud.com/Mitsubishi.Wifi.Client',
      httpsAgent: new https.Agent({ rejectUnauthorized: shouldVerifySSL }),
    })
    this.#autoSync = Duration.fromObject({ minutes: autoSync ?? MINUTES_0 })
    this.#logger = logger
    this.#syncFunction = syncFunction
    this.#setupAxiosInterceptors()
  }

  public async applyLogin(data?: LoginCredentials): Promise<boolean> {
    const { username = this.username, password = this.password } = data ?? {}
    if (username && password) {
      try {
        return (
          (
            await this.login({
              postData: {
                AppVersion: '1.32.0.0',
                Email: username,
                Language: getLanguage(),
                Password: password,
                Persist: true,
              },
            })
          ).data.LoginData !== null
        )
      } catch (error) {
        if (typeof data !== 'undefined') {
          throw error
        }
      }
    }
    return false
  }

  public clearSync(): void {
    if (this.#syncTimeout) {
      clearTimeout(this.#syncTimeout)
      this.#syncTimeout = null
    }
  }

  public async fetch(): Promise<{ data: Building[] }> {
    this.clearSync()
    const response = await this.#api.get<Building[]>(LIST_URL)
    response.data.forEach((building) => {
      DeviceModel.upsertMany(building.Structure.Devices)
      building.Structure.Areas.forEach((area) => {
        DeviceModel.upsertMany(area.Devices)
        AreaModel.upsert(area)
      })
      building.Structure.Floors.forEach((floor) => {
        DeviceModel.upsertMany(floor.Devices)
        FloorModel.upsert(floor)
        floor.Areas.forEach((area) => {
          DeviceModel.upsertMany(area.Devices)
          AreaModel.upsert(area)
        })
      })
      BuildingModel.upsert(building)
    })
    await this.#syncFunction?.()
    if (this.#autoSync.as('milliseconds')) {
      this.#syncTimeout = setTimeout(() => {
        this.fetch().catch((error: unknown) => {
          this.#logger.error(error)
        })
      }, this.#autoSync.as('milliseconds'))
    }
    return response
  }

  public async get<T extends keyof typeof DeviceType>({
    params,
  }: {
    params: GetDeviceDataParams
  }): Promise<{ data: GetDeviceData[T] }> {
    return this.#api.get('/Device/Get', { params })
  }

  public async getEnergyReport<T extends keyof typeof DeviceType>({
    postData,
  }: {
    postData: EnergyPostData
  }): Promise<{ data: EnergyData[T] }> {
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

  public async login({
    postData: { Email: username, Password: password, ...rest },
  }: {
    postData: LoginPostData
  }): Promise<{ data: LoginData }> {
    const response = await this.#api.post<LoginData>(LOGIN_URL, {
      Email: username,
      Password: password,
      ...rest,
    })
    if (response.data.LoginData) {
      this.username = username
      this.password = password
      this.contextKey = response.data.LoginData.ContextKey
      this.expiry = response.data.LoginData.Expiry
      await this.fetch()
    } else {
      this.clearSync()
    }
    return response
  }

  public async set<T extends keyof typeof DeviceType>({
    heatPumpType,
    postData,
  }: {
    heatPumpType: T
    postData: SetDevicePostData<T>
  }): Promise<{ data: SetDeviceData[T] }> {
    return this.#api.post(`/Device/Set${heatPumpType}`, postData)
  }

  public async setAta({
    postData,
  }: {
    postData: SetAtaGroupPostData
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

  public async setLanguage(language: string): Promise<{ data: boolean }> {
    const response = await this.#api.post<boolean>('/User/UpdateLanguage', {
      language: getLanguage(language) satisfies Language,
    })
    if (response.data) {
      LuxonSettings.defaultLocale = language
    }
    return response
  }

  public async setPower({
    postData,
  }: {
    postData: SetPowerPostData
  }): Promise<{ data: boolean }> {
    return this.#api.post('/Device/Power', postData)
  }

  async #handleError(error: AxiosError): Promise<AxiosError> {
    const errorData = createAPICallErrorData(error)
    this.#logger.error(String(errorData))
    switch (error.response?.status) {
      case HttpStatusCode.Unauthorized:
        if (this.#retry && error.config?.url !== LOGIN_URL) {
          this.#handleRetry()
          if ((await this.applyLogin()) && error.config) {
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
    if (newConfig.url === LIST_URL && this.#holdAPIListUntil > DateTime.now()) {
      throw new Error(
        `API requests to ${LIST_URL} are on hold for ${this.#holdAPIListUntil
          .diffNow()
          .shiftTo('minutes')
          .toHuman()}`,
      )
    }
    if (newConfig.url !== LOGIN_URL) {
      const { contextKey, expiry } = this
      if (expiry && DateTime.fromISO(expiry) < DateTime.now()) {
        await this.applyLogin()
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

  #handleRetry(): void {
    this.#retry = false
    clearTimeout(this.#retryTimeout)
    this.#retryTimeout = setTimeout(
      () => {
        this.#retry = true
      },
      Duration.fromObject({ minutes: 1 }).as('milliseconds'),
    )
  }

  #setupAxiosInterceptors(): void {
    this.#api.interceptors.request.use(
      async (
        config: InternalAxiosRequestConfig,
      ): Promise<InternalAxiosRequestConfig> => this.#handleRequest(config),
      async (error: AxiosError): Promise<AxiosError> =>
        this.#handleError(error),
    )
    this.#api.interceptors.response.use(
      (response: AxiosResponse): AxiosResponse =>
        this.#handleResponse(response),
      async (error: AxiosError): Promise<AxiosError> =>
        this.#handleError(error),
    )
  }
}
