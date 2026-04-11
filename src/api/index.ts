export type {
  API,
  APIAdapter,
  APIConfig,
  APISettings,
  BaseAPIConfig,
  ErrorDetails,
  ErrorLog,
  ErrorLogQuery,
  HomeAPI,
  HomeAPIConfig,
  HomeAPISettings,
  Logger,
  OnSyncFunction,
  RequestCompleteEvent,
  RequestErrorEvent,
  RequestLifecycleContext,
  RequestLifecycleEvents,
  RequestRetryEvent,
  RequestStartEvent,
  SettingManager,
} from './interfaces.ts'

export { MELCloudAPI } from './classic.ts'
export { MELCloudHomeAPI } from './home.ts'
