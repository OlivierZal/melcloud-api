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
  GetGroupData,
  GetGroupPostData,
  HolidayModeData,
  HolidayModePostData,
  HourlyReportPostData,
  LoginCredentials,
  LoginData,
  LoginPostData,
  ReportData,
  ReportPostData,
  SetDeviceData,
  SetDevicePostData,
  SetGroupPostData,
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
  errors: (query: ErrorLogQuery) => Promise<ErrorLog | FailureData>
  fetch: () => Promise<Building[]>
  updateLanguage: (language: string) => Promise<void>
  onSync?: OnSyncFunction
  // DeviceType.Ata | DeviceType.Atw | DeviceType.Erv
  energy: ({
    postData,
  }: {
    postData: EnergyPostData
  }) => Promise<{ data: EnergyData<DeviceType> }>
  errorLog: ({
    postData,
  }: {
    postData: ErrorLogPostData
  }) => Promise<{ data: ErrorLogData[] | FailureData }>
  frostProtection: ({
    params,
  }: {
    params: SettingsParams
  }) => Promise<{ data: FrostProtectionData }>
  holidayMode: ({
    params,
  }: {
    params: SettingsParams
  }) => Promise<{ data: HolidayModeData }>
  list: () => Promise<{ data: Building[] }>
  login: ({
    postData,
  }: {
    postData: LoginPostData
  }) => Promise<{ data: LoginData }>
  operationModeLog: ({
    postData,
  }: {
    postData: ReportPostData
  }) => Promise<{ data: OperationModeLogData }>
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
  setValues: <T extends DeviceType>({
    postData,
    type,
  }: {
    postData: SetDevicePostData<T>
    type: T
  }) => Promise<{ data: SetDeviceData<T> }>
  temperatureLog: ({
    postData,
  }: {
    postData: ReportPostData
  }) => Promise<{ data: ReportData }>
  tiles: (({
    postData,
  }: {
    postData: TilesPostData<null>
  }) => Promise<{ data: TilesData<null> }>) &
    (<T extends DeviceType>({
      postData,
    }: {
      postData: TilesPostData<T>
    }) => Promise<{ data: TilesData<T> }>)
  values: ({
    params,
  }: {
    params: GetDeviceDataParams
  }) => Promise<{ data: GetDeviceData<DeviceType> }>
  wifi: ({
    postData,
  }: {
    postData: HourlyReportPostData
  }) => Promise<{ data: ReportData }>
  // DeviceType.Ata
  group: ({
    postData,
  }: {
    postData: GetGroupPostData
  }) => Promise<{ data: GetGroupData }>
  setGroup: ({
    postData,
  }: {
    postData: SetGroupPostData
  }) => Promise<{ data: FailureData | SuccessData }>
  // DeviceType.Atw
  hourlyTemperature: ({
    postData,
  }: {
    postData: HourlyReportPostData
  }) => Promise<{ data: ReportData }>
  internalTemperatures: ({
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
