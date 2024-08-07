import type { InternalAxiosRequestConfig } from 'axios'

const ORDER = [
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

export default abstract class {
  public readonly method: InternalAxiosRequestConfig['method']

  public readonly params: InternalAxiosRequestConfig['params']

  public readonly url: InternalAxiosRequestConfig['url']

  protected constructor(config?: InternalAxiosRequestConfig) {
    this.method = config?.method?.toUpperCase()
    this.url = config?.url
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.params = config?.params
  }

  public toString(): string {
    return ORDER.map((key) => {
      if (key in this) {
        const value = this[key as keyof this]
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
