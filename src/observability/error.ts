import { isHttpError } from '../http/index.ts'
import type { APICallLogData } from './context.ts'
import { APICallRequestData } from './request.ts'
import { APICallResponseData } from './response.ts'

/** Log data extended with the error message from a failed API call. */
export interface APICallLogDataWithErrorMessage extends APICallLogData {
  readonly errorMessage: string
}

const withErrorMessage = (
  data: APICallLogData,
  message: string,
): APICallLogDataWithErrorMessage =>
  Object.assign(data, { errorMessage: message })

/**
 * Create structured error log data from a failed HTTP request.
 * Uses response data when the error carries one, otherwise falls back to
 * request-only data.
 * @param error - The error thrown by the HTTP client.
 * @returns Structured log data including the error message.
 */
export const createAPICallErrorData = (
  error: Error,
): APICallLogDataWithErrorMessage => {
  if (isHttpError(error)) {
    return withErrorMessage(
      new APICallResponseData(error.response, error.config),
      error.message,
    )
  }
  return withErrorMessage(new APICallRequestData(), error.message)
}
