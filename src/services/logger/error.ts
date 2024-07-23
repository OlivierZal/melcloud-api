import type { AxiosError } from 'axios'

import type APICallContextData from './context'

import APICallRequestData from './request'
import APICallResponseData from './response'

interface APICallContextDataWithErrorMessage extends APICallContextData {
  readonly errorMessage: string
}

const getMessage = (error: AxiosError): string => error.message

const withErrorMessage = (
  base: new (...args: any[]) => APICallContextData,
  error: AxiosError,
): new (...args: unknown[]) => APICallContextDataWithErrorMessage =>
  class extends base {
    public readonly errorMessage = getMessage(error)
  }

export default (error: AxiosError): APICallContextDataWithErrorMessage =>
  error.response ?
    new (withErrorMessage(APICallResponseData, error))(error.response)
  : new (withErrorMessage(APICallRequestData, error))(error.config)
