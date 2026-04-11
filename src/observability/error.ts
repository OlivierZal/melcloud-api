import type {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'

import type { APICallLogData } from './context.ts'
import { APICallRequestData } from './request.ts'
import { APICallResponseData } from './response.ts'

/** Log data extended with the error message from a failed ClassicAPI call. */
export interface APICallLogDataWithErrorMessage extends APICallLogData {
  readonly errorMessage: string
}

const getMessage = (error: Error): string => error.message

// Mixin that extends a log data class with the error message from the failure
const withErrorMessage = <T extends AxiosResponse | InternalAxiosRequestConfig>(
  base: new (arg?: T) => APICallLogData,
  error: Error,
): new (arg?: T) => APICallLogDataWithErrorMessage =>
  class extends base {
    public readonly errorMessage = getMessage(error)
  }

/**
 * Create structured error log data from an Axios error.
 * Uses response data if available, otherwise falls back to request data.
 * @param error - The Axios error to extract log data from.
 * @returns Structured log data including the error message.
 */
export const createAPICallErrorData = (
  error: AxiosError,
): APICallLogDataWithErrorMessage =>
  error.response ?
    new (withErrorMessage(APICallResponseData, error))(error.response)
  : new (withErrorMessage(APICallRequestData, error))(error.config)
