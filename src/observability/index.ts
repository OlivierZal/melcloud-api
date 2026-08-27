// Thin vocabulary layer over @olivierzal/api-core (which now owns the
// mechanism this directory used to carry as heatzy-api's byte-identical
// twin): the MELCloud sensitive-key set lives in `context.ts`, and the
// shells re-exported here arrive pre-bound to it.
export type { LoggableRequestConfig } from './context.ts'

export { createAPICallErrorData } from './error.ts'
export { LifecycleEmitter } from './events-emitter.ts'
export { APICallRequestData } from './request.ts'
export { APICallResponseData } from './response.ts'
