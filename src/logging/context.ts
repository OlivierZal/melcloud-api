import type { InternalAxiosRequestConfig } from 'axios'

const SPACE = 2

export abstract class APICallContextData {
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
          const { [key as keyof this]: value } = this
          if (value !== undefined) {
            return `${key}: ${
              typeof value === 'object' ?
                JSON.stringify(value, null, SPACE)
              : String(value)
            }`
          }
        }
        return undefined
      })
      .filter((line) => line !== undefined)
      .join('\n')
  }
}
