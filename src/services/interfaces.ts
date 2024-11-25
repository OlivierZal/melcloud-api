import type { DeviceType, Language } from '../enums.js'
import type { OperationModeLogData } from '../types/common.js'
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
  GetGroupAtaData,
  GetGroupAtaPostData,
  HolidayModeData,
  HolidayModePostData,
  LoginCredentials,
  LoginData,
  LoginPostData,
  ReportData,
  ReportHourlyPostData,
  ReportPostData,
  SetDeviceData,
  SetDevicePostData,
  SetGroupAtaPostData,
  SetPowerPostData,
  SettingsParams,
  SuccessData,
  TilesData,
  TilesPostData,
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

export interface APIConfig extends Partial<LoginCredentials> {
  autoSyncInterval?: number | null
  language?: string
  logger?: Logger
  onSync?: OnSyncFunction
  settingManager?: SettingManager
  shouldVerifySSL?: boolean
  timezone?: string
}

export interface ErrorDetails {
  readonly date: string
  readonly device: string
  readonly error: string
}

export interface ErrorLog {
  readonly errors: ErrorDetails[]
  readonly fromDateHuman: string
  readonly nextFromDate: string
  readonly nextToDate: string
}

export interface ErrorLogQuery {
  readonly from?: string
  readonly limit?: string
  readonly offset?: string
  readonly to?: string
}

export interface IAPI {
  authenticate: (data?: LoginCredentials) => Promise<boolean>
  clearSync: () => void
  fetch: () => Promise<Building[]>
  getErrors: (query: ErrorLogQuery) => Promise<ErrorLog | FailureData>
  setLanguage: (language: string) => Promise<void>
  onSync?: OnSyncFunction
  // DeviceType.Ata | DeviceType.Atw | DeviceType.Erv
  get: ({
    params,
  }: {
    params: GetDeviceDataParams
  }) => Promise<{ data: GetDeviceData<DeviceType> }>
  getEnergyReport: ({
    postData,
  }: {
    postData: EnergyPostData
  }) => Promise<{ data: EnergyData<DeviceType> }>
  getErrorLog: ({
    postData,
  }: {
    postData: ErrorLogPostData
  }) => Promise<{ data: ErrorLogData[] | FailureData }>
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
  getOperationMode: ({
    postData,
  }: {
    postData: ReportPostData
  }) => Promise<{ data: OperationModeLogData }>
  getTemperatureLog: ({
    postData,
  }: {
    postData: ReportPostData
  }) => Promise<{ data: ReportData }>
  getTiles: (({
    postData,
  }: {
    postData: TilesPostData<null>
  }) => Promise<{ data: TilesData<null> }>) &
    (<T extends DeviceType>({
      postData,
    }: {
      postData: TilesPostData<T>
    }) => Promise<{ data: TilesData<T> }>)
  getWifiReport: ({
    postData,
  }: {
    postData: ReportHourlyPostData
  }) => Promise<{ data: ReportData }>
  list: () => Promise<{ data: Building[] }>
  login: ({
    postData,
  }: {
    postData: LoginPostData
  }) => Promise<{ data: LoginData }>
  set: <T extends DeviceType>({
    postData,
    type,
  }: {
    postData: SetDevicePostData<T>
    type: T
  }) => Promise<{ data: SetDeviceData<T> }>
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
  setPower: ({
    postData,
  }: {
    postData: SetPowerPostData
  }) => Promise<{ data: boolean }>
  updateLanguage: ({
    postData,
  }: {
    postData: { language: Language }
  }) => Promise<{ data: boolean }>
  // DeviceType.Ata
  getAta: ({
    postData,
  }: {
    postData: GetGroupAtaPostData
  }) => Promise<{ data: GetGroupAtaData }>
  setAta: ({
    postData,
  }: {
    postData: SetGroupAtaPostData
  }) => Promise<{ data: FailureData | SuccessData }>
  // DeviceType.Atw
  getInternalTemperatures: ({
    postData,
  }: {
    postData: ReportPostData
  }) => Promise<{ data: ReportData }>
}

export interface Logger {
  error: Console['error']
  log: Console['log']
}

export interface SettingManager {
  get: <K extends keyof APISettings>(key: K) => APISettings[K]
  set: <K extends keyof APISettings>(key: K, value: APISettings[K]) => void
}

export type OnSyncFunction = (params?: {
  ids?: number[]
  type?: DeviceType
}) => Promise<void>
