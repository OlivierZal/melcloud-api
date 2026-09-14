export type {
  HttpClientConfig,
  HttpRequestConfig,
  HttpResponse,
} from './client.ts'

export { HttpClient, readHeaders } from './client.ts'
export {
  type HttpErrorRequestConfig,
  HttpError,
  HttpStatus,
  isHttpError,
} from '@olivierzal/api-core'
