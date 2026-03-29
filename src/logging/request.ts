import type { InternalAxiosRequestConfig } from 'axios'

import { APICallLogData } from './context.ts'

/** Structured log data for an outgoing API request. */
export class APICallRequestData extends APICallLogData {
  public override readonly dataType = 'API request'

  public readonly headers?: InternalAxiosRequestConfig['headers']

  public readonly requestData: InternalAxiosRequestConfig['data']

  public constructor(config?: InternalAxiosRequestConfig) {
    super(config)
    this.headers = config?.headers
    this.requestData = config?.data as unknown
  }
}
