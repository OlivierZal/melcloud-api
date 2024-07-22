import type {
  Building,
  DeviceType,
  EnergyData,
  EnergyPostData,
  ErrorData,
  ErrorPostData,
  FailureData,
  FrostProtectionData,
  FrostProtectionPostData,
  GetDeviceData,
  GetDeviceDataParams,
  HolidayModeData,
  HolidayModePostData,
  LoginCredentials,
  LoginData,
  LoginPostData,
  SetAtaGroupPostData,
  SetDeviceData,
  SetDevicePostData,
  SetPowerPostData,
  SettingsParams,
  SuccessData,
  TilesData,
  TilesPostData,
  WifiData,
  WifiPostData,
} from '../types'

export interface APISettings {
  contextKey?: null | string
  expiry?: null | string
  password?: null | string
  username?: null | string
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

export interface APIConfig {
  autoSyncInterval?: null | number
  language?: string
  logger?: Logger
  settingManager?: SettingManager
  shouldVerifySSL?: boolean
  syncFunction?: () => Promise<void>
  timezone?: string
}

export interface IAPI {
  applyLogin: (
    data?: LoginCredentials,
    onSuccess?: () => Promise<void>,
  ) => Promise<boolean>
  clearSync: () => void
  fetch: () => Promise<{ data: Building[] }>
  get: ({
    params,
  }: {
    params: GetDeviceDataParams
  }) => Promise<{ data: GetDeviceData[keyof typeof DeviceType] }>
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
    postData: SetAtaGroupPostData
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
  setLanguage: (language: string) => Promise<{ data: boolean }>
  setPower: ({
    postData,
  }: {
    postData: SetPowerPostData
  }) => Promise<{ data: boolean }>
}
