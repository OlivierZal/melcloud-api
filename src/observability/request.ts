import { type LoggableRequestConfig, APICallLogData } from './context.ts'

/** Structured log data for an outgoing ClassicAPI request. */
export class APICallRequestData extends APICallLogData {
  public override readonly dataType = 'ClassicAPI request'

  public readonly headers: unknown

  public readonly requestData: unknown

  public constructor(config?: LoggableRequestConfig) {
    super(config)
    this.headers = config?.headers
    this.requestData = config?.data
  }
}
