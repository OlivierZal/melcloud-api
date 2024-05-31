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
  type BuildingDataParams,
  type DeviceData,
  type DeviceDataFromGet,
  type DeviceDataParams,
  type DeviceType,
  type ErrorLogData,
  type ErrorLogPostData,
  type FailureData,
  type FrostProtectionData,
  type FrostProtectionPostData,
  type HolidayModeData,
  type HolidayModePostData,
  Language,
  type LoginCredentials,
  type LoginData,
  type LoginPostData,
  type PostData,
  type ReportData,
  type ReportPostData,
  type SuccessData,
  type TilesData,
  type TilesPostData,
} from '..'
import { DateTime, Duration } from 'luxon'
import APICallRequestData from './APICallRequestData'
import APICallResponseData from './APICallResponseData'
import createAPICallErrorData from './createAPICallErrorData'
import https from 'https'

export interface APISettings {
  readonly contextKey?: string | null
  readonly expiry?: string | null
  readonly password?: string | null
  readonly username?: string | null
}

export interface Logger {
  readonly error: Console['error']
  readonly log: Console['log']
}

export interface SettingManager {
  get: <K extends keyof APISettings>(
    key: K,
  ) => APISettings[K] | null | undefined
  set: <K extends keyof APISettings>(key: K, value: APISettings[K]) => void
}

const LIST_URL = '/User/ListDevices'
const LOGIN_URL = '/Login/ClientLogin'

export default class {
  readonly #settingManager?: SettingManager

  public readonly language: Language

  #contextKey = ''

  #expiry = ''

  #holdAPIListUntil = DateTime.now()

  #password = ''

  #retry = true

  #retryTimeout!: NodeJS.Timeout

  #username = ''

  readonly #api: AxiosInstance

  readonly #logger: Logger

  public constructor(
    config: {
      language?: string
      logger?: Logger
      settingManager?: SettingManager
      shouldVerifySSL?: boolean
    } = {},
  ) {
    const {
      language = 'en',
      logger = console,
      settingManager,
      shouldVerifySSL = true,
    } = config
    this.language =
      language in Language ?
        Language[language as keyof typeof Language]
      : Language.en
    this.#logger = logger
    this.#settingManager = settingManager
    this.#api = createAxiosInstance({
      baseURL: 'https://app.melcloud.com/Mitsubishi.Wifi.Client',
      httpsAgent: new https.Agent({ rejectUnauthorized: shouldVerifySSL }),
    })
    this.#setupAxiosInterceptors()
  }

  private get contextKey(): string {
    return this.#settingManager?.get('contextKey') ?? this.#contextKey
  }

  private set contextKey(value: string) {
    this.#contextKey = value
    this.#settingManager?.set('contextKey', this.#contextKey)
  }

  private get expiry(): string {
    return this.#settingManager?.get('expiry') ?? this.#expiry
  }

  private set expiry(value: string) {
    this.#expiry = value
    this.#settingManager?.set('expiry', this.#expiry)
  }

  private get password(): string {
    return this.#settingManager?.get('password') ?? this.#password
  }

  private set password(value: string) {
    this.#password = value
    this.#settingManager?.set('password', this.#password)
  }

  private get username(): string {
    return this.#settingManager?.get('username') ?? this.#username
  }

  private set username(value: string) {
    this.#username = value
    this.#settingManager?.set('username', this.#username)
  }

  public async applyLogin(
    data?: LoginCredentials,
    onSuccess?: () => Promise<void>,
  ): Promise<boolean> {
    const { username = this.username, password = this.password } = data ?? {}
    if (username && password) {
      try {
        const { LoginData: loginData } = (
          await this.login({
            AppVersion: '1.32.0.0',
            Email: username,
            Language: this.language,
            Password: password,
            Persist: true,
          })
        ).data
        if (loginData) {
          await onSuccess?.()
        }
        return loginData !== null
      } catch (error) {
        if (typeof data !== 'undefined') {
          throw error
        }
      }
    }
    return false
  }

  public async errors(
    postData: ErrorLogPostData,
  ): Promise<{ data: ErrorLogData[] | FailureData }> {
    return this.#api.post<ErrorLogData[] | FailureData>(
      '/Report/GetUnitErrorLog2',
      postData satisfies ErrorLogPostData,
    )
  }

  public async get<T extends keyof typeof DeviceType>(
    id: number,
    buildingId: number,
  ): Promise<{ data: DeviceDataFromGet[T] }> {
    return this.#api.get<DeviceDataFromGet[T]>('/Device/Get', {
      params: { buildingId, id } satisfies DeviceDataParams,
    })
  }

  public async getFrostProtection(
    id: number,
  ): Promise<{ data: FrostProtectionData }> {
    return this.#api.get<FrostProtectionData>('/FrostProtection/GetSettings', {
      params: { id, tableName: 'DeviceLocation' } satisfies BuildingDataParams,
    })
  }

  public async getHolidayMode(id: number): Promise<{ data: HolidayModeData }> {
    return this.#api.get<HolidayModeData>('/HolidayMode/GetSettings', {
      params: { id, tableName: 'DeviceLocation' } satisfies BuildingDataParams,
    })
  }

  public async list(): Promise<{ data: Building[] }> {
    return this.#api.get<Building[]>(LIST_URL)
  }

  public async login({
    Email: username,
    Password: password,
    ...rest
  }: LoginPostData): Promise<{ data: LoginData }> {
    const response = await this.#api.post<LoginData>(LOGIN_URL, {
      Email: username,
      Password: password,
      ...rest,
    } satisfies LoginPostData)
    if (response.data.LoginData) {
      this.username = username
      this.password = password
      this.contextKey = response.data.LoginData.ContextKey
      this.expiry = response.data.LoginData.Expiry
    }
    return response
  }

  public async report<T extends keyof typeof DeviceType>(
    postData: ReportPostData,
  ): Promise<{ data: ReportData[T] }> {
    return this.#api.post<ReportData[T]>(
      '/EnergyCost/Report',
      postData satisfies ReportPostData,
    )
  }

  public async set<T extends keyof typeof DeviceType>(
    heatPumpType: T,
    postData: PostData[T],
  ): Promise<{ data: DeviceData[T] }> {
    return this.#api.post<DeviceData[T]>(
      `/Device/Set${heatPumpType}`,
      postData satisfies PostData[T],
    )
  }

  public async tiles<T extends number | null>(
    postData: TilesPostData<T>,
  ): Promise<{ data: TilesData<T> }> {
    return this.#api.post<TilesData<T>>(
      '/Tile/Get2',
      postData satisfies TilesPostData<T>,
    )
  }

  public async updateFrostProtection(
    postData: FrostProtectionPostData,
  ): Promise<{ data: FailureData | SuccessData }> {
    return this.#api.post<FailureData | SuccessData>(
      '/FrostProtection/Update',
      postData satisfies FrostProtectionPostData,
    )
  }

  public async updateHolidayMode(
    postData: HolidayModePostData,
  ): Promise<{ data: FailureData | SuccessData }> {
    return this.#api.post<FailureData | SuccessData>(
      '/HolidayMode/Update',
      postData satisfies HolidayModePostData,
    )
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
