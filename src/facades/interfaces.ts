import type {
  BuildingSettings,
  DeviceType,
  EnergyData,
  ErrorData,
  FailureData,
  FrostProtectionData,
  GetDeviceData,
  HolidayModeData,
  ListDevice,
  SetAtaGroupPostData,
  SetDeviceData,
  SuccessData,
  TilesData,
  UpdateDeviceData,
  WifiData,
} from '../types'

export interface IBaseFacade {
  getErrors: ({
    from,
    to,
  }: {
    from?: string | null
    to?: string | null
  }) => Promise<ErrorData[] | FailureData>
  getFrostProtection: () => Promise<FrostProtectionData>
  getHolidayMode: () => Promise<HolidayModeData>
  getWifiReport: (hour: number) => Promise<WifiData>
  setFrostProtection: ({
    enable,
    max,
    min,
  }: {
    enable?: boolean
    max: number
    min: number
  }) => Promise<FailureData | SuccessData>
  setHolidayMode: (({
    enable,
    from,
    to,
  }: {
    from?: null
    to?: null
    enable: false
  }) => Promise<FailureData | SuccessData>) &
    (({
      enable,
      from,
      to,
    }: {
      enable?: true
      from?: string | null
      to: string
    }) => Promise<FailureData | SuccessData>) &
    (({
      enable,
      from,
      days,
    }: {
      enable?: true
      from?: string | null
      days: number
    }) => Promise<FailureData | SuccessData>)
  setPower: (enable?: boolean) => Promise<boolean>
}

export interface IBaseSuperDeviceFacade extends IBaseFacade {
  get: () => Promise<
    ListDevice['Ata']['Device'] &
      ListDevice['Atw']['Device'] &
      ListDevice['Erv']['Device']
  >
  getTiles: () => Promise<TilesData<null>>
  setAta: (
    postData: Omit<SetAtaGroupPostData, 'Specification'>,
  ) => Promise<FailureData | SuccessData>
}

export interface IBuildingFacade extends IBaseSuperDeviceFacade {
  fetch: () => Promise<BuildingSettings>
}

export interface IDeviceFacade<T extends keyof typeof DeviceType>
  extends IBaseFacade {
  fetch: () => Promise<ListDevice[T]['Device']>
  get: () => Promise<GetDeviceData[T]>
  getEnergyReport: ({
    from,
    to,
  }: {
    from?: string | null
    to?: string | null
  }) => Promise<EnergyData[T]>
  getTile: ((select?: false) => Promise<TilesData<null>>) &
    ((select: true) => Promise<TilesData<T>>)
  set: (postData: UpdateDeviceData[T]) => Promise<SetDeviceData[T]>
}
