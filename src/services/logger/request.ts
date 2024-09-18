import type { InternalAxiosRequestConfig } from 'axios'

import APICallContextData from './context'

export default class extends APICallContextData {
  public readonly headers?: InternalAxiosRequestConfig['headers']

  public readonly dataType = 'API request'

  public readonly requestData: InternalAxiosRequestConfig['data']

  public constructor(config?: InternalAxiosRequestConfig) {
    super(config)
    this.headers = config?.headers
    this.requestData = config?.data as unknown
  }
}
