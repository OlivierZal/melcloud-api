import type {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'

import type { APICallContextData } from './context.ts'

import { APICallRequestData } from './request.ts'
import { APICallResponseData } from './response.ts'

/** Log data extended with the error message from a failed API call. */
export interface APICallContextDataWithErrorMessage extends APICallContextData {
  readonly errorMessage: string
}

const getMessage = (error: Error): string => error.message

const withErrorMessage = <T extends AxiosResponse | InternalAxiosRequestConfig>(
  base: new (arg?: T) => APICallContextData,
  error: Error,
): new (arg?: T) => APICallContextDataWithErrorMessage =>
  class extends base {
    public readonly errorMessage = getMessage(error)
  }

/**
 * Create structured error log data from an Axios error.
 * Uses response data if available, otherwise falls back to request data.
 */
export const createAPICallErrorData = (
  error: AxiosError,
): APICallContextDataWithErrorMessage =>
  error.response ?
    new (withErrorMessage(APICallResponseData, error))(error.response)
  : new (withErrorMessage(APICallRequestData, error))(error.config)
