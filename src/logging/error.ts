import { APICallRequestData } from './request.ts'
import { APICallResponseData } from './response.ts'

import type {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'

import type { APICallContextData } from './context.ts'

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

export const createAPICallErrorData = (
  error: AxiosError,
): APICallContextDataWithErrorMessage =>
  error.response ?
    new (withErrorMessage(APICallResponseData, error))(error.response)
  : new (withErrorMessage(APICallRequestData, error))(error.config)
