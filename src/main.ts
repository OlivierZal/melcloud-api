import 'source-map-support/register.js'

export { fetchDevices } from './decorators/fetch-devices.ts'
export { syncDevices } from './decorators/sync-devices.ts'
export { updateDevice, updateDevices } from './decorators/update-devices.ts'
export {
  DeviceType,
  FanSpeed,
  Horizontal,
  Language,
  OperationMode,
  OperationModeState,
  OperationModeZone,
  VentilationMode,
  Vertical,
} from './enums.ts'
export { AreaFacade } from './facades/area.ts'
export { BaseDeviceAtwFacade as DeviceAtwFacade } from './facades/base-device-atw.ts'
export { BuildingFacade } from './facades/building.ts'
export { DeviceAtaFacade } from './facades/device-ata.ts'
export { DeviceErvFacade } from './facades/device-erv.ts'
export { FloorFacade } from './facades/floor.ts'
export { FacadeManager } from './facades/manager.ts'
export {
  AreaModel,
  BuildingModel,
  DeviceModel,
  FloorModel,
} from './models/index.ts'
export { API as MELCloudAPI } from './services/api.ts'
export type {
  FrostProtectionQuery,
  HolidayModeQuery,
  IBuildingFacade,
  IDeviceFacade,
  IDeviceFacadeAny,
  IFacade,
  IFacadeManager,
  ISuperDeviceFacade,
  ReportQuery,
} from './facades/interfaces.ts'
export type {
  IAreaModel,
  IBaseBuildingModel,
  IBaseDeviceModel,
  IBuildingModel,
  IDeviceModel,
  IDeviceModelAny,
  IFloorModel,
  IModel,
  ISubBuildingModel,
  ISubFloorModel,
  ISuperAreaModel,
  ISuperDeviceModel,
} from './models/interfaces.ts'
export type {
  APIConfig,
  APISettings,
  ErrorDetails,
  ErrorLog,
  ErrorLogQuery,
  IAPI,
  Logger,
  OnSyncFunction,
  SettingManager,
} from './services/interfaces.ts'
export type {
  EnergyDataAta,
  GetGroupData,
  GetGroupPostData,
  GroupState,
  KeyofSetDeviceDataAtaNotInList,
  ListDeviceDataAta,
  SetDeviceDataAta,
  SetDeviceDataAtaInList,
  SetGroupPostData,
  UpdateDeviceDataAta,
} from './types/ata.ts'
export type {
  EnergyDataAtw,
  ListDeviceDataAtw,
  OperationModeZoneDataAtw,
  SetDeviceDataAtw,
  TemperatureDataAtw,
  UpdateDeviceDataAtw,
  ZoneAtw,
} from './types/atw.ts'
export type {
  BaseDevicePostData,
  BaseGetDeviceData,
  BaseListDevice,
  BaseListDeviceData,
  BaseSetDeviceData,
  BaseUpdateDeviceData,
  DeviceDataNotInList,
} from './types/bases.ts'
export type {
  AreaData,
  AreaDataAny,
  Building,
  BuildingData,
  DateTimeComponents,
  EnergyData,
  EnergyPostData,
  ErrorLogData,
  ErrorLogPostData,
  FailureData,
  FloorData,
  FrostProtectionData,
  FrostProtectionLocation,
  FrostProtectionPostData,
  GetDeviceData,
  GetDeviceDataParams,
  HMTimeZone,
  HolidayModeData,
  HolidayModeLocation,
  HolidayModePostData,
  ListDevice,
  ListDeviceAny,
  ListDeviceData,
  ListDeviceDataAny,
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
  UpdateDeviceData,
  ZoneSettings,
} from './types/common.ts'
export type {
  ListDeviceDataErv,
  SetDeviceDataErv,
  UpdateDeviceDataErv,
} from './types/erv.ts'
