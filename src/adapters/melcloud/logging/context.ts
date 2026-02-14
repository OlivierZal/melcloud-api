import type { InternalAxiosRequestConfig } from 'axios'

const SPACE = 2

export abstract class APICallContextData {
  [key: string]: unknown

  public readonly method: InternalAxiosRequestConfig['method']

  public readonly params: InternalAxiosRequestConfig['params']

  public readonly url: InternalAxiosRequestConfig['url']

  protected constructor(config?: InternalAxiosRequestConfig) {
    this.method = config?.method?.toUpperCase()
    this.url = config?.url
    this.params = config?.params as unknown
  }

  public toString(): string {
    return [
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
      .map((key) => {
        if (key in this) {
          const { [key]: value } = this
          if (value !== undefined) {
            return `${key}: ${JSON.stringify(value, null, SPACE)}`
          }
        }
        return null
      })
      .filter((line) => line !== null)
      .join('\n')
  }
}
