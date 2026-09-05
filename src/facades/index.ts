export type {
  ReportChartBand,
  ReportChartLineOptions,
  ReportChartPieOptions,
  ReportQuery,
} from './report-types.ts'

export { ClassicAreaFacade } from './classic-area.ts'
export { createFacade } from './classic-factory.ts'
export { ClassicFloorFacade } from './classic-floor.ts'
export { ClassicFacadeManager } from './classic-manager.ts'
// The facade names below are the INTERFACES from classic-types.ts — the
// types the manager, factory and guards actually speak — not the
// implementation classes (whose `#`-private members would make the
// published names non-assignable to what the SDK returns).
export {
  type ClassicBuildingFacade,
  type ClassicDeviceAtaFacade,
  type ClassicDeviceAtwFacade,
  type ClassicDeviceErvFacade,
  type ClassicDeviceFacade,
  type ClassicDeviceFacadeAny,
  type ClassicEnergyReportExtract,
  type ClassicFacade,
  type ClassicZoneFacade,
  isClassicAtaFacade,
  isClassicAtwFacade,
  isClassicErvFacade,
} from './classic-types.ts'
export {
  type HomeAtaGroupSource,
  aggregateClassicAtaGroupStates,
  toClassicAtaGroupState,
  toGroupFanSpeed,
  toHomeAtaValues,
} from './home-ata-group.ts'
export {
  type HomeEnergyInterval,
  type HomeEnergyQuery,
  type HomeEnergySeriesPoint,
  type HomeEnergySeriesQuery,
  HomeBaseDeviceFacade,
} from './home-base-device.ts'
export { HomeBuildingFacade } from './home-building.ts'
export { HomeDeviceAtaFacade } from './home-device-ata.ts'
export { HomeDeviceAtwFacade } from './home-device-atw.ts'
export { HomeFacadeManager } from './home-manager.ts'
export {
  type HomeDeviceFacadeAny,
  isHomeAtaFacade,
  isHomeAtwFacade,
} from './home-types.ts'
