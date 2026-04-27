import { HttpError } from './errors.ts'

// `fetch()` in Node 22+ accepts `dispatcher` (undici-specific). We import
// the type from undici-types (the copy bundled with @types/node that
// Node's `fetch()` declaration uses) so passing a dispatcher
// instantiated from the `undici` runtime package remains structurally
// compatible with what fetch expects.
type FetchBody = NonNullable<FetchInit['body']>

// `Dispatcher` is defined both in the `undici` npm package and in
// `undici-types` (the copy bundled with `@types/node` that fetch's
// declaration uses). They are structurally identical at runtime but
// TypeScript treats them as nominally distinct, so a dispatcher built
// from one cannot be assigned to the other. Accepting `object` on the
// construction side keeps the public surface agnostic; the runtime
// hand-off to fetch below spreads it into RequestInit via a tagged
// property so the compiler stays out of the way.
type FetchDispatcher = object

type FetchInit = NonNullable<Parameters<typeof fetch>[1]>

const NULL_BODY_STATUS = 204

const JSON_CONTENT_TYPE = 'application/json'

/** Construction options for {@link HttpClient}. */
export interface HttpClientConfig {
  readonly baseURL: string
  readonly timeout: number
  readonly dispatcher?: FetchDispatcher
  readonly headers?: Record<string, string>
}

/**
 * Configuration accepted by {@link HttpClient.request}.
 *
 * Intentionally mirrors the subset of the Axios request config that the
 * library relied on, so call sites migrate verbatim.
 */
export interface HttpRequestConfig {
  readonly data?: unknown
  readonly headers?: Record<string, string>
  readonly method?: string
  readonly params?: Record<string, unknown>
  readonly signal?: AbortSignal
  readonly url?: string
}

/** Minimal response shape surfaced to callers. */
export interface HttpResponse<T = unknown> {
  readonly data: T
  readonly headers: Record<string, string | string[]>
  readonly status: number
}

// Join relative `url` onto `baseURL`. `new URL(absolutePath, base)` follows
// RFC 3986 and replaces base's path entirely — which drops any prefix like
// `/Mitsubishi.Wifi.Client` from `baseURL`. Strip the leading slash so the
// URL constructor treats it as a relative segment and concatenates.
const resolveUrl = (baseURL: string, url: string | undefined): string => {
  if (url === undefined || url === '') {
    return baseURL
  }
  if (/^https?:/iu.test(url)) {
    return url
  }
  return new URL(
    url.startsWith('/') ? url.slice(1) : url,
    baseURL.endsWith('/') ? baseURL : `${baseURL}/`,
  ).href
}

const encodeParams = (params: Record<string, unknown>): string => {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      query.append(
        key,
        typeof value === 'string' ? value : JSON.stringify(value),
      )
    }
  }
  return query.toString()
}

const buildUrl = (
  baseURL: string,
  url: string | undefined,
  params: Record<string, unknown> | undefined,
): string => {
  const fullUrl = resolveUrl(baseURL, url)
  if (!params) {
    return fullUrl
  }
  const queryString = encodeParams(params)
  if (queryString === '') {
    return fullUrl
  }
  return fullUrl.includes('?') ?
      `${fullUrl}&${queryString}`
    : `${fullUrl}?${queryString}`
}

const serializeBody = (
  data: unknown,
  headers: Record<string, string>,
): FetchBody | undefined => {
  if (data === undefined || data === null) {
    return undefined
  }
  if (typeof data === 'string' || data instanceof URLSearchParams) {
    return data
  }
  headers['Content-Type'] ??= JSON_CONTENT_TYPE
  return JSON.stringify(data)
}

// Headers.entries() collapses same-name values into a single
// comma-joined string, so iterating once is enough. `set-cookie` is the
// exception: `Headers` preserves it as a distinct list exposed only via
// `getSetCookie()`, so we merge that explicitly.
const readHeaders = (headers: Headers): Record<string, string | string[]> => {
  const result: Record<string, string | string[]> = {}
  for (const [key, value] of headers.entries()) {
    result[key] = value
  }
  const setCookie = headers.getSetCookie()
  if (setCookie.length > 0) {
    result['set-cookie'] = setCookie
  }
  return result
}

// Try JSON first, fall back to text. Axios auto-parses bodies by default —
// content-type from upstream can be absent or a JSON variant the strict
// `application/json` substring misses (e.g. `text/json`, `application/problem+json`).
// Matching on parseability keeps those callers working without a content-type
// allowlist that drifts with every new server flavour.
const parseBody = async (response: Response): Promise<unknown> => {
  if (
    response.status === NULL_BODY_STATUS ||
    response.headers.get('content-length') === '0'
  ) {
    return ''
  }
  const text = await response.text()
  if (text === '') {
    return ''
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

// When callers passed an `AbortSignal` and we also need to enforce a
// timeout, combine both so whichever fires first aborts the request.
const combineSignals = (
  signals: (AbortSignal | undefined)[],
): AbortSignal | undefined => {
  const defined = signals.filter((signal) => signal !== undefined)
  if (defined.length === 0) {
    return undefined
  }
  if (defined.length === 1) {
    return defined[0]
  }
  return AbortSignal.any(defined)
}

/**
 * Thin fetch-based HTTP client used internally by the SDK.
 *
 * Returns a normalised `{ data, status, headers }` response and
 * throws {@link HttpError} on non-2xx — so retry/rate-limit/observability
 * layers stay unchanged when the transport is swapped.
 */
export class HttpClient {
  public readonly baseURL: string

  public readonly timeout: number

  readonly #defaultHeaders: Record<string, string>

  readonly #dispatcher: FetchDispatcher | undefined

  public constructor({
    baseURL,
    dispatcher,
    headers,
    timeout,
  }: HttpClientConfig) {
    this.baseURL = baseURL
    this.timeout = timeout
    this.#dispatcher = dispatcher
    this.#defaultHeaders = { ...headers }
  }

  public async request<T = unknown>(
    config: HttpRequestConfig,
  ): Promise<HttpResponse<T>> {
    const init = this.#buildInit(config)
    const response = await fetch(
      buildUrl(this.baseURL, config.url, config.params),
      init,
    )
    const parsed = await parseBody(response)
    const responseHeaders = readHeaders(response.headers)
    if (!response.ok) {
      throw new HttpError(
        `Request failed with status code ${String(response.status)}`,
        { data: parsed, headers: responseHeaders, status: response.status },
        {
          data: config.data,
          headers: {
            ...this.#defaultHeaders,
            ...config.headers,
          },
          method: config.method ?? 'GET',
          ...(config.params !== undefined && { params: config.params }),
          ...(config.url !== undefined && { url: config.url }),
        },
      )
    }
    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- parsed body is structurally `unknown`; caller provides the narrow `T`
      data: parsed as T,
      headers: responseHeaders,
      status: response.status,
    }
  }

  // `dispatcher` is declared with a nominally different (but structurally
  // identical) type by undici-types vs the undici npm package. Attach it
  // via `Object.assign` so the compiler mismatch stays scoped to the
  // fetch hand-off, not the public surface.
  #applyDispatcher(init: FetchInit): void {
    if (this.#dispatcher !== undefined) {
      Object.assign(init, { dispatcher: this.#dispatcher })
    }
  }

  #applySignal(init: FetchInit, callerSignal: AbortSignal | undefined): void {
    const timeoutSignal =
      this.timeout > 0 ? AbortSignal.timeout(this.timeout) : undefined
    const combined = combineSignals([callerSignal, timeoutSignal])
    if (combined !== undefined) {
      init.signal = combined
    }
  }

  #buildInit(config: HttpRequestConfig): FetchInit {
    const { data, headers = {}, method = 'GET', signal } = config
    const mergedHeaders: Record<string, string> = {
      ...this.#defaultHeaders,
      ...headers,
    }
    const body = serializeBody(data, mergedHeaders)
    const init: FetchInit = {
      ...(body !== undefined && { body }),
      headers: mergedHeaders,
      method: method.toUpperCase(),
    }
    this.#applySignal(init, signal)
    this.#applyDispatcher(init)
    return init
  }
}
