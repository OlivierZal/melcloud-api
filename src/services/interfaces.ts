import type { HourNumbers } from 'luxon'

import type { DeviceType, Language } from '../enums.ts'
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
  LoginCredentials,
  LoginData,
  LoginPostData,
  OperationModeLogData,
  ReportData,
  ReportPostData,
  SetDeviceData,
  SetDevicePostData,
  SetGroupPostData,
  SetPowerPostData,
  SettingsParams,
  SuccessData,
  TemperatureLogPostData,
  TilesData,
  TilesPostData,
} from '../types/index.ts'

const apiSettingKeys = new Set<keyof APISettings>([
  'contextKey',
  'expiry',
  'password',
  'username',
]) as Set<string>

export interface APIConfig extends Partial<LoginCredentials> {
  readonly autoSyncInterval?: number | null
  readonly language?: string
  readonly logger?: Logger
  readonly onSync?: OnSyncFunction
  readonly settingManager?: SettingManager
  readonly shouldVerifySSL?: boolean
  readonly timezone?: string
}

export interface APISettings {
  readonly contextKey?: string | null
  readonly expiry?: string | null
  readonly password?: string | null
  readonly username?: string | null
}

export interface ErrorDetails {
  readonly date: string
  readonly device: string
  readonly error: string
}

export interface ErrorLog {
  readonly errors: readonly ErrorDetails[]
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
  readonly onSync?: OnSyncFunction
  readonly authenticate: (data?: LoginCredentials) => Promise<boolean>
  readonly clearSync: () => void
  readonly errorLog: (
    query: ErrorLogQuery,
    deviceIds: number[],
  ) => Promise<ErrorLog>
  readonly fetch: () => Promise<Building[]>
  readonly updateLanguage: (language: string) => Promise<void>
  // DeviceType.Ata | DeviceType.Atw | DeviceType.Erv
  readonly errors: ({
    postData,
  }: {
    postData: ErrorLogPostData
  }) => Promise<{ data: ErrorLogData[] | FailureData }>
  readonly frostProtection: ({
    params,
  }: {
    params: SettingsParams
  }) => Promise<{ data: FrostProtectionData }>
  readonly holidayMode: ({
    params,
  }: {
    params: SettingsParams
  }) => Promise<{ data: HolidayModeData }>
  readonly list: () => Promise<{ data: Building[] }>
  readonly login: ({
    postData,
  }: {
    postData: LoginPostData
  }) => Promise<{ data: LoginData }>
  readonly operationModes: ({
    postData,
  }: {
    postData: ReportPostData
  }) => Promise<{ data: OperationModeLogData }>
  readonly setFrostProtection: ({
    postData,
  }: {
    postData: FrostProtectionPostData
  }) => Promise<{ data: FailureData | SuccessData }>
  readonly setHolidayMode: ({
    postData,
  }: {
    postData: HolidayModePostData
  }) => Promise<{ data: FailureData | SuccessData }>
  readonly setLanguage: ({
    postData,
  }: {
    postData: { language: Language }
  }) => Promise<{ data: boolean }>
  readonly setPower: ({
    postData,
  }: {
    postData: SetPowerPostData
  }) => Promise<{ data: boolean }>
  readonly setValues: <T extends DeviceType>({
    postData,
    type,
  }: {
    postData: SetDevicePostData<T>
    type: T
  }) => Promise<{ data: SetDeviceData<T> }>
  readonly signal: ({
    postData,
  }: {
    postData: { devices: number | number[]; hour: HourNumbers }
  }) => Promise<{ data: ReportData }>
  readonly temperatures: ({
    postData,
  }: {
    postData: TemperatureLogPostData
  }) => Promise<{ data: ReportData }>
  readonly tiles: (({
    postData,
  }: {
    postData: TilesPostData<null>
  }) => Promise<{ data: TilesData<null> }>) &
    (<T extends DeviceType>({
      postData,
    }: {
      postData: TilesPostData<T>
    }) => Promise<{ data: TilesData<T> }>)
  readonly values: ({
    params,
  }: {
    params: GetDeviceDataParams
  }) => Promise<{ data: GetDeviceData<DeviceType> }>
  // DeviceType.Ata | DeviceType.Atw
  readonly energy: ({
    postData,
  }: {
    postData: EnergyPostData
  }) => Promise<{ data: EnergyData<DeviceType> }>
  // DeviceType.Ata
  readonly group: ({
    postData,
  }: {
    postData: GetGroupPostData
  }) => Promise<{ data: GetGroupData }>
  readonly setGroup: ({
    postData,
  }: {
    postData: SetGroupPostData
  }) => Promise<{ data: FailureData | SuccessData }>
  // DeviceType.Atw
  readonly hourlyTemperatures: ({
    postData,
  }: {
    postData: { device: number; hour: HourNumbers }
  }) => Promise<{ data: ReportData }>
  readonly internalTemperatures: ({
    postData,
  }: {
    postData: ReportPostData
  }) => Promise<{ data: ReportData }>
}

export interface Logger {
  readonly error: Console['error']
  readonly log: Console['log']
}

export interface SettingManager {
  readonly get: <T extends keyof APISettings>(key: T) => APISettings[T]
  readonly set: <T extends keyof APISettings>(
    key: T,
    value: APISettings[T],
  ) => void
}

export type OnSyncFunction = (params?: {
  ids?: number[]
  type?: DeviceType
}) => Promise<void>

export const isAPISetting = (value: string): value is keyof APISettings =>
  apiSettingKeys.has(value)
