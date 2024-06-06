import {
  APICallRequestData,
  APICallResponseData,
  createAPICallErrorData,
} from '../lib'
import {
  AreaModel,
  BuildingModel,
  DeviceModel,
  type DeviceModelAny,
  FloorModel,
} from '../models'
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
  type ListDeviceAny,
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
} from '../types'
import { DateTime, Duration, Settings as LuxonSettings } from 'luxon'
import type { IMELCloudAPI, Logger, SettingManager } from '.'
import https from 'https'

const LIST_URL = '/User/ListDevices'
const LOGIN_URL = '/Login/ClientLogin'

export default class API implements IMELCloudAPI {
  readonly #settingManager?: SettingManager

  public static readonly areas = new Map<number, AreaModel>()

  public static readonly buildings = new Map<number, BuildingModel>()

  public static readonly devices = new Map<number, DeviceModelAny>()

  public static readonly floors = new Map<number, FloorModel>()

  public language: Language

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
      timezone?: string
    } = {},
  ) {
    const {
      language = 'en',
      logger = console,
      settingManager,
      shouldVerifySSL = true,
      timezone,
    } = config
    if (typeof timezone !== 'undefined') {
      LuxonSettings.defaultZone = timezone
    }
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
            postData: {
              AppVersion: '1.32.0.0',
              Email: username,
              Language: this.language,
              Password: password,
              Persist: true,
            },
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

  public async fetchDevices(): Promise<{ data: Building[] }> {
    const response = await this.#api.get<Building[]>(LIST_URL)
    await Promise.all(
      response.data.map(async (building) => {
        this.#upsertDevices(building.Structure.Devices)
        building.Structure.Areas.forEach((area) => {
          AreaModel.upsert(this, area)
          this.#upsertDevices(area.Devices)
        })
        building.Structure.Floors.forEach((floor) => {
          FloorModel.upsert(this, floor)
          this.#upsertDevices(floor.Devices)
          floor.Areas.forEach((area) => {
            AreaModel.upsert(this, area)
            this.#upsertDevices(area.Devices)
          })
        })
        const [device] = building.Structure.Devices
        await this.#upsertBuilding(building, API.devices.get(device.DeviceID))
      }),
    )
    return response
  }

  public async getDevice<T extends keyof typeof DeviceType>({
    params,
  }: {
    params: GetDeviceDataParams
  }): Promise<{ data: GetDeviceData[T] }> {
    return this.#api.get<GetDeviceData[T]>('/Device/Get', {
      params: params satisfies GetDeviceDataParams,
    })
  }

  public async getEnergyReport<T extends keyof typeof DeviceType>({
    postData,
  }: {
    postData: EnergyPostData
  }): Promise<{ data: EnergyData[T] }> {
    return this.#api.post<EnergyData[T]>(
      '/EnergyCost/Report',
      postData satisfies EnergyPostData,
    )
  }

  public async getErrors({
    postData,
  }: {
    postData: ErrorPostData
  }): Promise<{ data: ErrorData[] | FailureData }> {
    return this.#api.post<ErrorData[] | FailureData>(
      '/Report/GetUnitErrorLog2',
      postData satisfies ErrorPostData,
    )
  }

  public async getFrostProtection({
    params,
  }: {
    params: SettingsParams
  }): Promise<{ data: FrostProtectionData }> {
    return this.#api.get<FrostProtectionData>('/FrostProtection/GetSettings', {
      params: params satisfies SettingsParams,
    })
  }

  public async getHolidayMode({
    params,
  }: {
    params: SettingsParams
  }): Promise<{ data: HolidayModeData }> {
    return this.#api.get<HolidayModeData>('/HolidayMode/GetSettings', {
      params: params satisfies SettingsParams,
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
    return this.#api.post<TilesData<T>>(
      '/Tile/Get2',
      postData satisfies TilesPostData<T>,
    )
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
    } satisfies LoginPostData)
    if (response.data.LoginData) {
      this.username = username
      this.password = password
      this.contextKey = response.data.LoginData.ContextKey
      this.expiry = response.data.LoginData.Expiry
    }
    return response
  }

  public async setAtaGroup({
    postData,
  }: {
    postData: SetAtaGroupPostData
  }): Promise<{ data: FailureData | SuccessData }> {
    try {
      return await this.#api.post<FailureData | SuccessData>(
        '/Group/SetAta',
        postData satisfies SetAtaGroupPostData,
      )
    } catch (_error) {
      throw new Error('No air-to-air device found')
    }
  }

  public async setDevice<T extends keyof typeof DeviceType>({
    heatPumpType,
    postData,
  }: {
    heatPumpType: T
    postData: SetDevicePostData[T]
  }): Promise<{ data: SetDeviceData[T] }> {
    return this.#api.post<SetDeviceData[T]>(
      `/Device/Set${heatPumpType}`,
      postData satisfies SetDevicePostData[T],
    )
  }

  public async setFrostProtection({
    postData,
  }: {
    postData: FrostProtectionPostData
  }): Promise<{ data: FailureData | SuccessData }> {
    return this.#api.post<FailureData | SuccessData>(
      '/FrostProtection/Update',
      postData satisfies FrostProtectionPostData,
    )
  }

  public async setHolidayMode({
    postData,
  }: {
    postData: HolidayModePostData
  }): Promise<{ data: FailureData | SuccessData }> {
    return this.#api.post<FailureData | SuccessData>(
      '/HolidayMode/Update',
      postData satisfies HolidayModePostData,
    )
  }

  public async setLanguage({
    postData: { language },
  }: {
    postData: { language: Language }
  }): Promise<{ data: boolean }> {
    const response = await this.#api.post<boolean>('/User/UpdateLanguage', {
      language,
    } satisfies { language: Language })
    if (response.data) {
      this.language = language
    }
    return response
  }

  public async setPower({
    postData,
  }: {
    postData: SetPowerPostData
  }): Promise<{ data: boolean }> {
    return this.#api.post<boolean>(
      '/Device/Power',
      postData satisfies SetPowerPostData,
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

  async #upsertBuilding(
    building: Building,
    device?: DeviceModelAny,
  ): Promise<void> {
    BuildingModel.upsert(this, {
      ...building,
      ...(device && !building.FPDefined ?
        await device.getFrostProtection()
      : {}),
      ...(device && !building.HMDefined ? await device.getHolidayMode() : {}),
    })
  }

  #upsertDevices(devices: readonly ListDeviceAny[]): void {
    devices.forEach((device) => {
      DeviceModel.upsert(this, device)
    })
  }
}
