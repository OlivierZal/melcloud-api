// Thin binding over @olivierzal/api-core: same factory, the MELCloud
// vocabulary seated once so no call site can forget it.
import {
  type APICallLogDataWithErrorMessage,
  createAPICallErrorData as coreCreateAPICallErrorData,
} from '@olivierzal/api-core'

import { redaction } from './context.ts'

/**
 * Create structured error log data from a failed HTTP request,
 * redacted through the MELCloud vocabulary. Uses response data when
 * the error carries one, otherwise falls back to request-only data.
 * @param error - The error thrown by the HTTP client.
 * @returns Structured log data including the error message.
 */
export const createAPICallErrorData = (
  error: Error,
): APICallLogDataWithErrorMessage =>
  coreCreateAPICallErrorData(error, redaction)
