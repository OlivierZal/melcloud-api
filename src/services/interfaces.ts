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
  Language,
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
} from '../types'

export interface IMELCloudAPI {
  applyLogin: (
    data?: LoginCredentials,
    onSuccess?: () => Promise<void>,
  ) => Promise<boolean>
  fetchDevices: () => Promise<{ data: Building[] }>
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
  setLanguage: ({
    postData,
  }: {
    postData: { language: Language }
  }) => Promise<{ data: boolean }>
  setPower: ({
    postData,
  }: {
    postData: SetPowerPostData
  }) => Promise<{ data: boolean }>
  readonly language: Language
}

export interface APISettings {
  readonly contextKey?: string | null
  readonly expiry?: string | null
  readonly password?: string | null
  readonly username?: string | null
}

export interface SettingManager {
  get: <K extends keyof APISettings>(
    key: K,
  ) => APISettings[K] | null | undefined
  set: <K extends keyof APISettings>(key: K, value: APISettings[K]) => void
}

export interface Logger {
  readonly error: Console['error']
  readonly log: Console['log']
}
