// Thin binding over @olivierzal/api-core's transport: same client, the
// MELCloud redaction vocabulary seated in the constructor so every
// thrown HttpError snapshot — including one thrown from a
// host-prebuilt transport — carries it automatically.
import {
  type HttpClientConfig as CoreHttpClientConfig,
  HttpClient as CoreHttpClient,
} from '@olivierzal/api-core'

import { redaction } from '../observability/context.ts'

export type { HttpRequestConfig, HttpResponse } from '@olivierzal/api-core'

export { readHeaders } from '@olivierzal/api-core'

/**
 * Construction options for {@link HttpClient}. The redaction engine is
 * not configurable here: this SDK's vocabulary is seated by the
 * subclass, so a transport cannot be built without it.
 * @category HTTP
 */
export type HttpClientConfig = Omit<CoreHttpClientConfig, 'redaction'>

/**
 * Thin fetch-based HTTP client used internally by the SDK — the core
 * transport with the MELCloud redaction vocabulary pre-seated.
 * @category HTTP
 */
export class HttpClient extends CoreHttpClient {
  /**
   * Builds an HTTP client pinned to a base URL, request-timeout budget,
   * and optional default headers / undici dispatcher.
   * @param config - Client configuration.
   */
  public constructor(config: HttpClientConfig) {
    super({ ...config, redaction })
  }
}
