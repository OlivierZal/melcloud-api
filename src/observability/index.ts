// Byte-identical twin shared by melcloud-api and heatzy-api. The
// deferred `api-core` extraction leaves no mechanism to link them:
// the two repos have no dependency, so edit both or neither.
export type { LoggableRequestConfig } from './context.ts'

export { createAPICallErrorData } from './error.ts'
export { LifecycleEmitter } from './events-emitter.ts'
export { APICallRequestData } from './request.ts'
export { APICallResponseData } from './response.ts'
