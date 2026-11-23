export type { AvailabilityAware, FaultAware, Identifiable } from './types.ts'

export { ClassicArea } from './area.ts'
export { ClassicBuilding } from './building.ts'
export {
  type ClassicCommunicationTransition,
  ClassicDevice,
} from './classic-device.ts'
export {
  type ClassicCommunicationEvent,
  ClassicRegistry,
} from './classic-registry.ts'
export {
  type ClassicBaseBuilding,
  type ClassicBaseDevice,
  type ClassicDeviceAny,
  type ClassicModel,
  type ClassicModelKind,
  isClassicDeviceOfType,
} from './classic-types.ts'
export { ClassicFloor } from './floor.ts'
export { type HomeConnectivityTransition, HomeDevice } from './home-device.ts'
export {
  type HomeBuildingDevices,
  type HomeConnectivityEvent,
  HomeRegistry,
} from './home-registry.ts'
export { hasStoppedCommunicating, STALE_COMMUNICATION_HOURS } from './types.ts'
