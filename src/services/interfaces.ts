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
  contextKey?: string | null
  expiry?: string | null
  password?: string | null
  username?: string | null
}

export interface SettingManager {
  get: <K extends keyof APISettings>(
    key: K,
  ) => APISettings[K] | null | undefined
  set: <K extends keyof APISettings>(key: K, value: APISettings[K]) => void
}

export interface Logger {
  error: Console['error']
  log: Console['log']
}

export interface IMELCloudAPI {
  applyLogin: (
    data?: LoginCredentials,
    onSuccess?: () => Promise<void>,
  ) => Promise<boolean>
  fetch: () => Promise<{ data: Building[] }>
  getDevice: <T extends keyof typeof DeviceType>({
    params,
  }: {
    params: GetDeviceDataParams
  }) => Promise<{ data: GetDeviceData[T] }>
  getEnergyReport: <T extends keyof typeof DeviceType>({
    postData,
  }: {
    postData: EnergyPostData
  }) => Promise<{ data: EnergyData[T] }>
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
  setAtaGroup: ({
    postData,
  }: {
    postData: SetAtaGroupPostData
  }) => Promise<{ data: FailureData | SuccessData }>
  setDevice: <T extends keyof typeof DeviceType>({
    heatPumpType,
    postData,
  }: {
    heatPumpType: T
    postData: SetDevicePostData<T>
  }) => Promise<{ data: SetDeviceData[T] }>
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
