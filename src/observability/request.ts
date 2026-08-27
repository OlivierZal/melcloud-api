// Thin binding over @olivierzal/api-core: same class, the MELCloud
// vocabulary seated once so no call site can forget it.
import {
  type LoggableRequestConfig,
  APICallRequestData as CoreAPICallRequestData,
} from '@olivierzal/api-core'

import { redaction } from './context.ts'

/**
 * Structured log data for an outgoing API request, redacted through
 * the MELCloud vocabulary.
 */
export class APICallRequestData extends CoreAPICallRequestData {
  /**
   * Captures an outgoing request into a loggable snapshot.
   * @param config - Request configuration to snapshot.
   */
  public constructor(config?: LoggableRequestConfig) {
    super(config, redaction)
  }
}
