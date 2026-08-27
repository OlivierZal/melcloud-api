// Thin binding over @olivierzal/api-core: same class, the MELCloud
// vocabulary seated once so no call site can forget it.
import {
  type HttpResponse,
  type LoggableRequestConfig,
  APICallResponseData as CoreAPICallResponseData,
} from '@olivierzal/api-core'

import { redaction } from './context.ts'

/**
 * Structured log data for an API response, redacted through the
 * MELCloud vocabulary.
 */
export class APICallResponseData extends CoreAPICallResponseData {
  /**
   * Captures a response (and the request that produced it) into a
   * loggable snapshot.
   * @param response - Normalized response to snapshot.
   * @param requestConfig - Request configuration the response answered.
   */
  public constructor(
    response?: HttpResponse,
    requestConfig?: LoggableRequestConfig,
  ) {
    super(response, requestConfig, redaction)
  }
}
