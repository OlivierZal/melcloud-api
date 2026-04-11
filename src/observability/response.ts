import type { AxiosResponse } from 'axios'

import { type LoggableRequestConfig, APICallLogData } from './context.ts'

/** Structured log data for an ClassicAPI response. */
export class APICallResponseData extends APICallLogData {
  public override readonly dataType = 'ClassicAPI response'

  public readonly headers: unknown

  public readonly requestData: unknown

  public readonly responseData: unknown

  public readonly status: number | undefined

  public constructor(response?: AxiosResponse) {
    /*
     * `response.config` is typed as non-optional by axios, but an
     * AxiosError captured before the request fully materialized can carry
     * a `response` whose `config` is undefined at runtime. The cast to the
     * structurally-wider LoggableRequestConfig (which marks every field
     * optional) lets the constructor handle the missing-config case
     * without throwing — the error logger must never crash, otherwise a
     * recoverable failure becomes a silent crash.
     */
    const config = response?.config as LoggableRequestConfig | undefined
    super(config)
    this.headers = response?.headers
    this.status = response?.status
    this.requestData = config?.data
    this.responseData = response?.data
  }
}
