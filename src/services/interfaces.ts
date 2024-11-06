import type { DeviceType } from '../enums.js'
import type {
  Building,
  EnergyData,
  EnergyPostData,
  ErrorData,
  ErrorPostData,
  FailureData,
  FrostProtectionData,
  FrostProtectionPostData,
  GetDeviceData,
  GetDeviceDataParams,
  GetGroupAtaData,
  GetGroupAtaPostData,
  HolidayModeData,
  HolidayModePostData,
  LoginCredentials,
  LoginData,
  LoginPostData,
  SetDeviceData,
  SetDevicePostData,
  SetGroupAtaPostData,
  SetPowerPostData,
  SettingsParams,
  SuccessData,
  TilesData,
  TilesPostData,
  WifiData,
  WifiPostData,
} from '../types/index.js'

export interface APISettings {
  contextKey?: string | null
  expiry?: string | null
  password?: string | null
  username?: string | null
}

export const isAPISetting = (key: string): key is keyof APISettings =>
  (
    [
      'contextKey',
      'expiry',
      'password',
      'username',
    ] satisfies (keyof APISettings)[] as string[]
  ).includes(key)

export interface SettingManager {
  get: <K extends keyof APISettings>(key: K) => APISettings[K]
  set: <K extends keyof APISettings>(key: K, value: APISettings[K]) => void
}

export interface Logger {
  error: Console['error']
  log: Console['log']
}

export interface APIConfig extends Partial<LoginCredentials> {
  autoSyncInterval?: number | null
  language?: string
  logger?: Logger
  onSync?: () => Promise<void>
  settingManager?: SettingManager
  shouldVerifySSL?: boolean
  timezone?: string
}

export interface IAPI {
  authenticate: (data?: LoginCredentials) => Promise<boolean>
  clearSync: () => void
  fetch: () => Promise<Building[]>
  get: ({
    params,
  }: {
    params: GetDeviceDataParams
  }) => Promise<{ data: GetDeviceData[keyof typeof DeviceType] }>
  getAta: ({
    postData,
  }: {
    postData: GetGroupAtaPostData
  }) => Promise<{ data: GetGroupAtaData }>
  getEnergyReport: ({
    postData,
  }: {
    postData: EnergyPostData
  }) => Promise<{ data: EnergyData[keyof typeof DeviceType] }>
  getErrors: ({
    postData,
  }: {
    postData: ErrorPostData
  }) => Promise<{ data: ErrorData[] | FailureData }>
  getFrostProtection: ({
    params,
  }: {
    params: SettingsParams
  }) => Promise<{ data: FrostProtectionData }>
  getHolidayMode: ({
    params,
  }: {
    params: SettingsParams
  }) => Promise<{ data: HolidayModeData }>
  getTiles: (({
    postData,
  }: {
    postData: TilesPostData<null>
  }) => Promise<{ data: TilesData<null> }>) &
    (<T extends keyof typeof DeviceType>({
      postData,
    }: {
      postData: TilesPostData<T>
    }) => Promise<{ data: TilesData<T> }>)
  getWifiReport: ({
    postData,
  }: {
    postData: WifiPostData
  }) => Promise<{ data: WifiData }>
  list: () => Promise<{ data: Building[] }>
  login: ({
    postData,
  }: {
    postData: LoginPostData
  }) => Promise<{ data: LoginData }>
  set: <T extends keyof typeof DeviceType>({
    heatPumpType,
    postData,
  }: {
    heatPumpType: T
    postData: SetDevicePostData[T]
  }) => Promise<{ data: SetDeviceData[T] }>
  setAta: ({
    postData,
  }: {
    postData: SetGroupAtaPostData
  }) => Promise<{ data: FailureData | SuccessData }>
  setFrostProtection: ({
    postData,
  }: {
    postData: FrostProtectionPostData
  }) => Promise<{ data: FailureData | SuccessData }>
  setHolidayMode: ({
    postData,
  }: {
    postData: HolidayModePostData
  }) => Promise<{ data: FailureData | SuccessData }>
  setLanguage: (language: string) => Promise<boolean>
  setPower: ({
    postData,
  }: {
    postData: SetPowerPostData
  }) => Promise<{ data: boolean }>
}
