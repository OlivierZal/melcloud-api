import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'

import { APICallLogData } from './context.ts'

/** Structured log data for an API response. */
export class APICallResponseData extends APICallLogData {
  public override readonly dataType = 'API response'

  public readonly headers?: AxiosResponse['headers']

  public readonly requestData: InternalAxiosRequestConfig['data']

  public readonly responseData: AxiosResponse['data']

  public readonly status?: AxiosResponse['status']

  public constructor(response?: AxiosResponse) {
    super(response?.config)
    this.headers = response?.headers
    this.status = response?.status
    this.requestData = response?.config.data as unknown
    this.responseData = response?.data as unknown
  }
}
