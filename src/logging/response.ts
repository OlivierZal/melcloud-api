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
    /*
     * Defensive `?.data` lookup on `config`: AxiosResponse types declare
     * `config` as non-optional, but an AxiosError captured before the
     * request fully materialized can carry a `response` object whose
     * `config` field is undefined at runtime. The error logger must never
     * throw — doing so would turn a recoverable failure into a silent crash.
     */
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime can violate the type contract
    this.requestData = response?.config?.data as unknown
    this.responseData = response?.data as unknown
  }
}
