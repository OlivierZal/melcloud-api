// Byte-identical twin shared by melcloud-api and heatzy-api. The
// deferred `api-core` extraction leaves no mechanism to link them:
// the two repos have no dependency, so edit both or neither.
import { type LoggableRequestConfig, APICallLogData } from './context.ts'

/**
 * Structured log data for an outgoing API request.
 */
export class APICallRequestData extends APICallLogData {
  public override readonly dataType = 'API request'

  public readonly headers: unknown

  public readonly requestData: unknown

  public constructor(config?: LoggableRequestConfig) {
    super(config)
    this.headers = config?.headers
    this.requestData = config?.data
  }
}
