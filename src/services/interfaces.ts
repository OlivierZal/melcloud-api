import type { HourNumbers } from 'luxon'

import type { DeviceType, Language } from '../enums.ts'
import type {
  GetGroupData,
  GetGroupPostData,
  SetGroupPostData,
} from '../types/ata.ts'
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
  HolidayModeData,
  HolidayModePostData,
  LoginCredentials,
  LoginData,
  LoginPostData,
  OperationModeLogData,
  ReportData,
  ReportPostData,
  SetDeviceData,
  SetDevicePostData,
  SetPowerPostData,
  SettingsParams,
  SuccessData,
  TemperatureLogPostData,
  TilesData,
  TilesPostData,
} from '../types/common.ts'

export interface APISettings {
  contextKey?: string | null
  expiry?: string | null
  password?: string | null
  username?: string | null
}

export const isAPISetting = (value: string): value is keyof APISettings =>
  (
    [
      'contextKey',
      'expiry',
      'password',
      'username',
    ] satisfies (keyof APISettings)[] as string[]
  ).includes(value)

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
  from?: string
  limit?: string
  offset?: string
  to?: string
}

export interface IAPI {
  onSync?: OnSyncFunction
  authenticate: (data?: LoginCredentials) => Promise<boolean>
  clearSync: () => void
  errorLog: (query: ErrorLogQuery, deviceIds: number[]) => Promise<ErrorLog>
  fetch: () => Promise<Building[]>
  updateLanguage: (language: string) => Promise<void>
  // DeviceType.Ata | DeviceType.Atw | DeviceType.Erv
  errors: ({
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
  operationModes: ({
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
  signal: ({
    postData,
  }: {
    postData: { devices: number | number[]; hour: HourNumbers }
  }) => Promise<{ data: ReportData }>
  temperatures: ({
    postData,
  }: {
    postData: TemperatureLogPostData
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
  // DeviceType.Ata | DeviceType.Atw
  energy: ({
    postData,
  }: {
    postData: EnergyPostData
  }) => Promise<{ data: EnergyData<DeviceType> }>
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
  hourlyTemperatures: ({
    postData,
  }: {
    postData: { device: number; hour: HourNumbers }
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
  get: <T extends keyof APISettings>(key: T) => APISettings[T]
  set: <T extends keyof APISettings>(key: T, value: APISettings[T]) => void
}

export type OnSyncFunction = (params?: {
  ids?: number[]
  type?: DeviceType
}) => Promise<void>
