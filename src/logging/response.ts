import { APICallContextData } from './context.js'

import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'

export class APICallResponseData extends APICallContextData {
  public readonly dataType = 'API response'

  public readonly requestData: InternalAxiosRequestConfig['data']

  public readonly responseData: AxiosResponse['data']

  public readonly headers?: AxiosResponse['headers']

  public readonly status?: AxiosResponse['status']

  public constructor(response?: AxiosResponse) {
    super(response?.config)
    this.headers = response?.headers
    this.status = response?.status
    this.requestData = response?.config.data as unknown
    this.responseData = response?.data as unknown
  }
}
