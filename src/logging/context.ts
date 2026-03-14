import type { InternalAxiosRequestConfig } from 'axios'

const LOG_KEYS = [
  'dataType',
  'method',
  'url',
  'params',
  'headers',
  'requestData',
  'responseData',
  'status',
  'errorMessage',
] as const

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
    return JSON.stringify(this, [...LOG_KEYS], SPACE)
  }
}
