import APICallRequestData from './request'
import APICallResponseData from './response'

import type {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'

import type APICallContextData from './context'

interface APICallContextDataWithErrorMessage extends APICallContextData {
  readonly errorMessage: string
}

const getMessage = (error: AxiosError): string => error.message

const withErrorMessage = <T extends AxiosResponse | InternalAxiosRequestConfig>(
  base: new (arg?: T) => APICallContextData,
  error: AxiosError,
): new (arg?: T) => APICallContextDataWithErrorMessage =>
  class extends base {
    public readonly errorMessage = getMessage(error)
  }

export default (error: AxiosError): APICallContextDataWithErrorMessage =>
  error.response ?
    new (withErrorMessage(APICallResponseData, error))(error.response)
  : new (withErrorMessage(APICallRequestData, error))(error.config)
