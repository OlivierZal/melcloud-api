import type { HttpResponse } from '../http/index.ts'
import { type LoggableRequestConfig, APICallLogData } from './context.ts'

/** Structured log data for an API response. */
export class APICallResponseData extends APICallLogData {
  public override readonly dataType = 'API response'

  public readonly headers: unknown

  public readonly requestData: unknown

  public readonly responseData: unknown

  public readonly status: number | undefined

  public constructor(
    response?: HttpResponse,
    requestConfig?: LoggableRequestConfig,
  ) {
    super(requestConfig)
    this.headers = response?.headers
    this.status = response?.status
    this.requestData = requestConfig?.data
    this.responseData = response?.data
  }
}
