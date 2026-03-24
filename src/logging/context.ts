import type { InternalAxiosRequestConfig } from 'axios'

// Fixed key order for consistent, readable JSON log output
const logKeys = [
  'dataType',
  'method',
  'url',
  'params',
  'headers',
  'requestData',
  'responseData',
  'status',
  'errorMessage',
]

/** Abstract base for API call logging data, serializable to JSON with a fixed set of log keys. */
export abstract class APICallLogData {
  declare public readonly dataType: string

  public readonly method: InternalAxiosRequestConfig['method']

  public readonly params: InternalAxiosRequestConfig['params']

  public readonly url: InternalAxiosRequestConfig['url']

  protected constructor(config?: InternalAxiosRequestConfig) {
    this.method = config?.method?.toUpperCase()
    this.url = config?.url
    this.params = config?.params as unknown
  }

  public toString(): string {
    return JSON.stringify(this, [...logKeys], 2)
  }
}
