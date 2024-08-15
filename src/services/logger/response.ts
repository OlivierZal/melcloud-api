import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'

import APICallContextData from './context'

export default class extends APICallContextData {
  public readonly dataType = 'API response'

  public readonly headers?: AxiosResponse['headers']

  public readonly requestData: InternalAxiosRequestConfig['data']

  public readonly responseData: AxiosResponse['data']

  public readonly status?: AxiosResponse['status']

  public constructor(response?: AxiosResponse) {
    super(response?.config)
    this.headers = response?.headers
    this.status = response?.status
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.requestData = response?.config.data
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.responseData = response?.data
  }
}
