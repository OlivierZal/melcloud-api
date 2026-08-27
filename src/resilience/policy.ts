// Thin re-export of @olivierzal/api-core (the mechanism formerly
// duplicated here as heatzy-api's twin; `CompositePolicy` is this
// SDK's composition style — heatzy nests `run` calls directly).
export type { ResiliencePolicy } from '@olivierzal/api-core'

export { CompositePolicy } from '@olivierzal/api-core'
