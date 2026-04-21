/**
 * Namespaced barrel for the MELCloud Home API surface. Re-exports every
 * `Home*` symbol from the main index under shorter aliases, so consumers can
 * write `import * as home from 'melcloud-api/home'` and reach the public API
 * as `home.API`, `home.Device`, `home.DeviceType`, etc.
 */
export {
  type HomeAPIConfig as APIConfig,
  type HomeAPISettings as APISettings,
  type HomeAtaValues as AtaValues,
  type HomeBuilding as Building,
  type HomeClaim as Claim,
  type HomeContext as Context,
  type HomeDeviceCapabilities as DeviceCapabilities,
  type HomeDeviceData as DeviceData,
  type HomeDeviceSetting as DeviceSetting,
  type HomeEnergyData as EnergyData,
  type HomeEnergyMeasure as EnergyMeasure,
  type HomeEnergyPoint as EnergyPoint,
  type HomeErrorLogEntry as ErrorLogEntry,
  type HomeFanSpeed as FanSpeed,
  type HomeHorizontal as Horizontal,
  type HomeOperationMode as OperationMode,
  type HomeReportData as ReportData,
  type HomeReportDataset as ReportDataset,
  type HomeReportPoint as ReportPoint,
  type HomeUser as User,
  type HomeVertical as Vertical,
  HomeAPI as API,
  HomeDevice as Device,
  HomeDeviceAtaFacade as DeviceAtaFacade,
  HomeDeviceType as DeviceType,
  homeDeviceTypeFromClassic as deviceTypeFromClassic,
  homeDeviceTypeToClassic as deviceTypeToClassic,
  HomeFacadeManager as FacadeManager,
  HomeRegistry as Registry,
} from './index.ts'
