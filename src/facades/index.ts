export type {
  DeviceFacade,
  DeviceFacadeAny,
  Facade,
  FrostProtectionQuery,
  HolidayModeQuery,
  ReportChartLineOptions,
  ReportChartPieOptions,
  ReportQuery,
  ZoneFacade,
} from './interfaces.ts'

export { AreaFacade } from './classic-area.ts'
export { BuildingFacade } from './classic-building.ts'
export { ClassicDeviceAtaFacade } from './classic-device-ata.ts'
export { ClassicDeviceAtwHasZone2Facade } from './classic-device-atw-has-zone2.ts'
export { ClassicDeviceAtwFacade } from './classic-device-atw.ts'
export { ClassicDeviceErvFacade } from './classic-device-erv.ts'
export { createFacade } from './classic-factory.ts'
export { FloorFacade } from './classic-floor.ts'
export { ClassicFacadeManager } from './classic-manager.ts'
export { HomeDeviceAtaFacade } from './home-device-ata.ts'
export { HomeFacadeManager } from './home-manager.ts'
export {
  hasZone2,
  isAtaFacade,
  isAtwFacade,
  isErvFacade,
} from './interfaces.ts'
