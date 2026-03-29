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

const REDACTED = '******'

const sensitiveKeys = new Set([
  'authorization',
  'contextkey',
  'cookie',
  'email',
  'password',
  'set-cookie',
  'username',
  'x-mitscontextkey',
])

const isSensitive = (key: string): boolean =>
  sensitiveKeys.has(key.toLowerCase())

const redactValue = (value: unknown): unknown => {
  if (typeof value !== 'object' || value === null) {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) => redactValue(item))
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, property]) => [
      key,
      isSensitive(key) ? REDACTED : property,
    ]),
  )
}

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
    const filtered = Object.fromEntries(
      logKeys
        .filter((key) => key in this)
        .map((key) => [
          key,
          redactValue(
            Object.getOwnPropertyDescriptor(this, key)?.value as unknown,
          ),
        ]),
    )
    return JSON.stringify(filtered, null, 2)
  }
}
