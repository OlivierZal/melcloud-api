export type {
  ReportChartLineOptions,
  ReportChartPieOptions,
  ReportQuery,
} from './interfaces.ts'

export { ClassicAreaFacade } from './classic-area.ts'
export { ClassicBuildingFacade } from './classic-building.ts'
export { ClassicDeviceAtaFacade } from './classic-device-ata.ts'
export { ClassicDeviceAtwHasZone2Facade } from './classic-device-atw-has-zone2.ts'
export { ClassicDeviceAtwFacade } from './classic-device-atw.ts'
export { ClassicDeviceErvFacade } from './classic-device-erv.ts'
export { createFacade } from './classic-factory.ts'
export { ClassicFloorFacade } from './classic-floor.ts'
export {
  type ClassicDeviceFacade,
  type ClassicDeviceFacadeAny,
  type ClassicFacade,
  type ClassicFrostProtectionQuery,
  type ClassicHolidayModeQuery,
  type ClassicZoneFacade,
  hasClassicZone2,
  isClassicAtaFacade,
  isClassicAtwFacade,
  isClassicErvFacade,
} from './classic-interfaces.ts'
export { ClassicFacadeManager } from './classic-manager.ts'
export { HomeDeviceAtaFacade } from './home-device-ata.ts'
export { HomeFacadeManager } from './home-manager.ts'
