import type APICallContextData from './context'
import APICallRequestData from './request'
import APICallResponseData from './response'
import type { AxiosError } from 'axios'

interface APICallContextDataWithErrorMessage extends APICallContextData {
  readonly errorMessage: string
}

const getMessage = (error: AxiosError): string => error.message

const withErrorMessage = <T extends new (...args: any[]) => APICallContextData>(
  base: T,
  error: AxiosError,
): new (...args: unknown[]) => APICallContextDataWithErrorMessage =>
  class extends base {
    public readonly errorMessage = getMessage(error)
  }

export default (error: AxiosError): APICallContextDataWithErrorMessage =>
  typeof error.response === 'undefined' ?
    new (withErrorMessage(APICallRequestData, error))(error.config)
  : new (withErrorMessage(APICallResponseData, error))(error.response)
