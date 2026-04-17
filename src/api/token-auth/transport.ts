import type { CookieJar } from 'tough-cookie'

/** Minimal response shape surfaced internally by the OIDC flow. */
export interface OidcResponse<T = unknown> {
  readonly data: T
  readonly headers: Record<string, string | string[]>
  readonly status: number
}

/** Options for {@link authRequest}. */
export interface AuthRequestOptions {
  config: {
    headers: Record<string, string>
    data?: string
  }
  jar: CookieJar
  method: string
  url: string
  abortSignal?: AbortSignal
}

/** Inputs for {@link fetchPostForm}. */
export interface PostFormOptions {
  body: string
  headers: Record<string, string>
  url: string
  abortSignal?: AbortSignal
}

export const readResponseHeaders = (
  headers: Headers,
): Record<string, string | string[]> => {
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

/*
 * Minimal replacement for `axios.post` used by the OIDC flow. The two
 * endpoints it targets (PAR, token exchange) are always expected to
 * return JSON; we parse unconditionally and throw on non-2xx so callers
 * get the same shape the previous axios path delivered.
 */
export const fetchPostForm = async <T>({
  abortSignal,
  body,
  headers,
  url,
}: PostFormOptions): Promise<OidcResponse<T>> => {
  const response = await fetch(url, {
    body,
    headers,
    method: 'POST',
    ...(abortSignal === undefined ? {} : { signal: abortSignal }),
  })
  const responseHeaders = readResponseHeaders(response.headers)
  const text = await response.text()
  if (!response.ok) {
    throw new Error(
      `Request to ${url} failed with status ${String(response.status)}`,
    )
  }
  return {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- caller provides the narrow response schema; JSON shape is validated downstream via Zod
    data: JSON.parse(text) as T,
    headers: responseHeaders,
    status: response.status,
  }
}

/*
 * Minimal replacement for the low-level `axios.request` call used by
 * the auth redirect chain: `redirect: 'manual'` mirrors the former
 * `maxRedirects: 0`, and non-2xx statuses do not throw (the redirect
 * handling inspects the status explicitly).
 */
export const fetchRaw = async (
  options: AuthRequestOptions,
): Promise<OidcResponse<string>> => {
  const response = await fetch(options.url, {
    headers: options.config.headers,
    method: options.method.toUpperCase(),
    redirect: 'manual',
    ...(options.config.data === undefined ? {} : { body: options.config.data }),
    ...(options.abortSignal === undefined ?
      {}
    : { signal: options.abortSignal }),
  })
  const headers = readResponseHeaders(response.headers)
  const data = await response.text()
  return { data, headers, status: response.status }
}

/**
 * Store any `Set-Cookie` headers from an OIDC response into a CookieJar.
 * @param jar - The cookie jar to populate.
 * @param response - The response containing potential Set-Cookie headers.
 * @param response.headers - The response headers.
 * @param url - The URL context for cookie storage.
 */
export const storeCookies = async (
  jar: CookieJar,
  { headers }: OidcResponse,
  url: string,
): Promise<void> => {
  const { 'set-cookie': setCookies } = headers
  if (!Array.isArray(setCookies)) {
    return
  }
  await Promise.allSettled(
    setCookies.map(async (raw: string) => jar.setCookie(raw, url)),
  )
}

/**
 * Low-level request for the OIDC auth flow. Uses a transient
 * CookieJar (not the API instance) since the multi-domain redirect
 * chain (IS <-> Cognito) requires cross-domain cookie management.
 * @param options - The auth request options.
 * @param options.abortSignal - Optional abort signal.
 * @param options.config - Request config with optional headers and body.
 * @param options.jar - CookieJar for cross-domain cookie management.
 * @param options.method - HTTP method.
 * @param options.url - Target URL.
 * @returns The raw HTTP response as an {@link OidcResponse}.
 */
export const authRequest = async ({
  abortSignal,
  config,
  jar,
  method,
  url,
}: AuthRequestOptions): Promise<OidcResponse<string>> => {
  const cookieHeader = await jar.getCookieString(url)
  const mergedHeaders: Record<string, string> = {
    ...config.headers,
    ...(cookieHeader === '' ? {} : { Cookie: cookieHeader }),
  }
  const response = await fetchRaw({
    config: {
      headers: mergedHeaders,
      ...(config.data === undefined ? {} : { data: config.data }),
    },
    jar,
    method,
    url,
    ...(abortSignal === undefined ? {} : { abortSignal }),
  })
  await storeCookies(jar, response, url)
  return response
}
