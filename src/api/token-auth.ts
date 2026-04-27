import { createHash, randomBytes } from 'node:crypto'

import { CookieJar } from 'tough-cookie'

import type { HomeTokenResponse } from '../types/index.ts'
import {
  HomeParResponseSchema,
  HomeTokenResponseSchema,
  parseOrThrow,
} from '../validation/index.ts'

// ------------------------------------------------------------------
//  Constants
// ------------------------------------------------------------------

const CLIENT_ID = 'homemobile'
const REDIRECT_URI = 'melcloudhome://'
const SCOPES = 'openid profile email offline_access IdentityServerApi'
const AUTH_BASIC = 'Basic aG9tZW1vYmlsZTo='
const AUTH_BASE_URL = 'https://auth.melcloudhome.com'
const COGNITO_AUTHORITY =
  'https://live-melcloudhome.auth.eu-west-1.amazoncognito.com'
const PAR_PATH = '/connect/par'
const TOKEN_PATH = '/connect/token'

const MAX_REDIRECTS = 20
const PKCE_RANDOM_BYTES = 32
const STATE_RANDOM_BYTES = 16
const REDIRECT_STATUS_MIN = 300
const REDIRECT_STATUS_MAX = 400

// ------------------------------------------------------------------
//  Types
// ------------------------------------------------------------------

/** Options for {@link authRequest}. */
interface AuthRequestOptions {
  config: {
    headers: Record<string, string>
    data?: string
  }
  jar: CookieJar
  method: string
  url: string
  abortSignal?: AbortSignal
}

/** Options for {@link authFollowRedirects}. */
interface FollowRedirectsOptions {
  jar: CookieJar
  url: string
  abortSignal?: AbortSignal
  remaining?: number
}

/** Minimal response shape surfaced internally by the OIDC flow. */
interface OidcResponse<T = unknown> {
  readonly data: T
  readonly headers: Record<string, string | string[]>
  readonly status: number
}

/** Inputs for {@link fetchPostForm}. */
interface PostFormOptions {
  body: string
  headers: Record<string, string>
  url: string
  abortSignal?: AbortSignal
}

/** Options for {@link submitCredentials}. */
interface SubmitCredentialsOptions {
  authorizeUrl: string
  credentials: { password: string; username: string }
  jar: CookieJar
  abortSignal?: AbortSignal
}

// ------------------------------------------------------------------
//  HTTP transport (fetch-based)
// ------------------------------------------------------------------

const readResponseHeaders = (
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

// Small POST-form helper for the OIDC flow. The two endpoints it
// targets (PAR, token exchange) always return JSON; parse
// unconditionally and throw on non-2xx. Each caller is responsible
// for narrowing the returned `unknown` (PAR via a local guard, token
// exchange via a Zod schema).
const fetchPostForm = async ({
  abortSignal,
  body,
  headers,
  url,
}: PostFormOptions): Promise<OidcResponse> => {
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
    data: JSON.parse(text) as unknown,
    headers: responseHeaders,
    status: response.status,
  }
}

// Low-level fetch helper for the auth redirect chain. Uses
// `redirect: 'manual'` so this module can inspect each 3xx response
// explicitly and drive the OIDC flow step-by-step; non-2xx statuses
// therefore do not throw.
const fetchRaw = async (
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
const storeCookies = async (
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
const authRequest = async ({
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

// ------------------------------------------------------------------
//  Helpers
// ------------------------------------------------------------------

/**
 * Extract the `action` attribute from the first `<form>` element in an HTML string.
 * @param html - Raw HTML string from the login page.
 * @returns The resolved form action URL, or `null` if not found.
 */
const extractFormAction = (html: string): string | null => {
  const match = /<form[^>]+action="(?<action>[^"]+)"/iu.exec(html)
  const encoded = match?.groups?.action
  if (encoded === undefined) {
    return null
  }
  const action = encoded.split('&amp;').join('&')
  return action.startsWith('/') ? `${COGNITO_AUTHORITY}${action}` : action
}

/**
 * Extract all hidden form fields from an HTML string.
 * @param html - Raw HTML string containing hidden `<input>` fields.
 * @returns A record of name-value pairs for each hidden field.
 */
const extractHiddenFields = (html: string): Record<string, string> =>
  Object.fromEntries(
    [...html.matchAll(/<input[^>]+type="hidden"[^>]*>/giu)].flatMap(([tag]) => {
      const name = /name="(?<name>[^"]+)"/u.exec(tag)?.groups?.name
      const value = /value="(?<value>[^"]*)"/u.exec(tag)?.groups?.value ?? ''
      return name === undefined ? [] : [[name, value] as const]
    }),
  )

/**
 * Extract a JavaScript-based redirect URL from an HTML response body.
 * @param html - The HTML string to search for a JS redirect.
 * @returns The redirect URL if found, or `null`.
 */
const extractPageRedirect = (html: string): string | null => {
  const jsMatch = /window\.location\s*=\s*['"](?<url>[^'"]+)/u.exec(html)
  if (jsMatch?.groups?.url !== undefined) {
    return jsMatch.groups.url.split('&amp;').join('&')
  }
  const metaMatch =
    /<meta[^>]+http-equiv="refresh"[^>]+content="[^"]*url=(?<url>[^"]+)/iu.exec(
      html,
    )
  if (metaMatch?.groups?.url !== undefined) {
    return metaMatch.groups.url.split('&amp;').join('&')
  }
  return null
}

/**
 * Resolve a potentially relative URL against a base URL.
 * @param options - The resolution options.
 * @param options.base - The base URL for resolution.
 * @param options.location - The URL or relative path to resolve.
 * @returns The fully qualified URL.
 */
const resolveUrl = ({
  base,
  location,
}: {
  base: string
  location: string
}): string =>
  location.startsWith('http') ? location : new URL(location, base).href

/**
 * Generate a PKCE challenge and verifier pair.
 * @returns An object containing the `challenge` and `verifier` strings.
 */
const generatePKCE = (): { challenge: string; verifier: string } => {
  const verifier = randomBytes(PKCE_RANDOM_BYTES).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { challenge, verifier }
}

// ------------------------------------------------------------------
//  Redirect-following
// ------------------------------------------------------------------

/**
 * Extract the redirect target from an HTTP or JS redirect response.
 * @param response - The raw HTTP response.
 * @param currentUrl - The URL that produced this response.
 * @returns The resolved redirect URL, or `null` if no redirect was detected.
 */
const extractRedirectTarget = (
  response: OidcResponse<string>,
  currentUrl: string,
): string | null => {
  if (
    response.status >= REDIRECT_STATUS_MIN &&
    response.status < REDIRECT_STATUS_MAX
  ) {
    const location = String(response.headers.location ?? '')
    return resolveUrl({ base: currentUrl, location })
  }
  const jsRedirect = extractPageRedirect(response.data)
  return jsRedirect === null ? null : (
      resolveUrl({ base: currentUrl, location: jsRedirect })
    )
}

/**
 * Follow HTTP 302 redirects and IS JavaScript redirects until a
 * non-redirect page is reached or the URL matches the app's custom
 * scheme (`melcloudhome://`).
 * @param options - The redirect-following options.
 * @param options.abortSignal - Optional abort signal.
 * @param options.jar - CookieJar for cross-domain cookie management.
 * @param options.remaining - Number of remaining redirects allowed.
 * @param options.url - Current URL to follow.
 * @returns The final response data and URL.
 */
const authFollowRedirects = async ({
  abortSignal,
  jar,
  remaining = MAX_REDIRECTS,
  url,
}: FollowRedirectsOptions): Promise<{ data: string; url: string }> => {
  if (remaining <= 0) {
    throw new Error(`Too many redirects (max ${String(MAX_REDIRECTS)})`)
  }
  if (url.startsWith(REDIRECT_URI)) {
    return { data: '', url }
  }
  const response = await authRequest({
    config: { headers: {} },
    jar,
    method: 'get',
    url,
    ...(abortSignal === undefined ? {} : { abortSignal }),
  })
  const redirectTarget = extractRedirectTarget(response, url)
  if (redirectTarget !== null) {
    return authFollowRedirects({
      jar,
      remaining: remaining - 1,
      url: redirectTarget,
      ...(abortSignal === undefined ? {} : { abortSignal }),
    })
  }
  return { data: response.data, url }
}

// ------------------------------------------------------------------
//  Auth flow steps
// ------------------------------------------------------------------

/**
 * Push Authorization Request — returns the opaque `request_uri`.
 * @param options - The PAR options.
 * @param options.challenge - The PKCE code challenge.
 * @param options.abortSignal - Optional signal to abort the request.
 * @returns The opaque PAR request URI.
 */
const par = async ({
  abortSignal,
  challenge,
}: {
  challenge: string
  abortSignal?: AbortSignal
}): Promise<string> => {
  const { data } = await fetchPostForm({
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES,
      state: randomBytes(STATE_RANDOM_BYTES).toString('base64url'),
    }).toString(),
    headers: {
      Authorization: AUTH_BASIC,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    url: `${AUTH_BASE_URL}${PAR_PATH}`,
    ...(abortSignal === undefined ? {} : { abortSignal }),
  })
  return parseOrThrow(HomeParResponseSchema, data, 'OIDC PAR endpoint')
    .request_uri
}

/**
 * Navigate to the Cognito login page and submit credentials.
 * @param options - The credential submission options.
 * @param options.abortSignal - Optional abort signal.
 * @param options.authorizeUrl - The OIDC authorize URL to start from.
 * @param options.credentials - The user's login credentials.
 * @param options.jar - CookieJar for the auth flow.
 * @returns The callback location URL after credential submission.
 */
const submitCredentials = async ({
  abortSignal,
  authorizeUrl,
  credentials,
  jar,
}: SubmitCredentialsOptions): Promise<string> => {
  const { data: html } = await authFollowRedirects({
    jar,
    url: authorizeUrl,
    ...(abortSignal === undefined ? {} : { abortSignal }),
  })
  const action = extractFormAction(html)
  if (action === null) {
    throw new Error('Could not find login form action')
  }
  const submitResponse = await authRequest({
    config: {
      data: new URLSearchParams({
        ...extractHiddenFields(html),
        cognitoAsfData: '',
        password: credentials.password,
        username: credentials.username,
      }).toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
    jar,
    method: 'post',
    url: action,
    ...(abortSignal === undefined ? {} : { abortSignal }),
  })
  const callbackLocation = String(submitResponse.headers.location ?? '')
  if (callbackLocation === '') {
    throw new Error('No redirect after credential submission')
  }
  return resolveUrl({ base: action, location: callbackLocation })
}

/**
 * Follow the callback chain and extract the authorization code.
 * @param callbackUrl - The callback URL to follow.
 * @param jar - CookieJar for the auth flow.
 * @param abortSignal - Optional abort signal.
 * @returns The authorization code.
 */
const extractAuthorizationCode = async (
  callbackUrl: string,
  jar: CookieJar,
  abortSignal?: AbortSignal,
): Promise<string> => {
  const { url } = await authFollowRedirects({
    jar,
    url: callbackUrl,
    ...(abortSignal === undefined ? {} : { abortSignal }),
  })
  const code = new URL(url).searchParams.get('code')
  if (code === null) {
    throw new Error('No authorization code in callback')
  }
  return code
}

/**
 * POST to the IdentityServer token endpoint and validate the response.
 * @param options - The token request options.
 * @param options.params - URL-encoded form parameters for the token request.
 * @param options.abortSignal - Optional signal to abort the request.
 * @returns The token response, validated by the Zod schema.
 */
const tokenRequest = async ({
  abortSignal,
  params,
}: {
  params: Record<string, string>
  abortSignal?: AbortSignal
}): Promise<HomeTokenResponse> => {
  const { data: tokens } = await fetchPostForm({
    body: new URLSearchParams(params).toString(),
    headers: {
      Authorization: AUTH_BASIC,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    url: `${AUTH_BASE_URL}${TOKEN_PATH}`,
    ...(abortSignal === undefined ? {} : { abortSignal }),
  })
  return parseOrThrow(HomeTokenResponseSchema, tokens, 'OIDC token endpoint')
}

// ------------------------------------------------------------------
//  Public surface
// ------------------------------------------------------------------

/**
 * Full headless OIDC login: PAR → Cognito → token exchange.
 * @param options - The auth options.
 * @param options.credentials - The user's login credentials.
 * @param options.credentials.password - The user's password.
 * @param options.credentials.username - The user's username.
 * @param options.abortSignal - Optional signal to abort the auth flow.
 * @returns The token response containing access and refresh tokens.
 */
export const performTokenAuth = async ({
  abortSignal,
  credentials,
}: {
  credentials: { password: string; username: string }
  abortSignal?: AbortSignal
}): Promise<HomeTokenResponse> => {
  const { challenge, verifier } = generatePKCE()
  const jar = new CookieJar()

  const requestUri = await par({
    challenge,
    ...(abortSignal === undefined ? {} : { abortSignal }),
  })
  const authorizeUrl = `${AUTH_BASE_URL}/connect/authorize?client_id=${CLIENT_ID}&request_uri=${encodeURIComponent(requestUri)}`

  const callbackUrl = await submitCredentials({
    authorizeUrl,
    credentials,
    jar,
    ...(abortSignal === undefined ? {} : { abortSignal }),
  })
  const code = await extractAuthorizationCode(callbackUrl, jar, abortSignal)

  return tokenRequest({
    params: {
      client_id: CLIENT_ID,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    },
    ...(abortSignal === undefined ? {} : { abortSignal }),
  })
}

/**
 * Exchange a refresh token for a fresh access token. Returns `null`
 * on **any** failure so the caller can fall through to a full re-auth
 * without threading an exception up the stack — but logs the error
 * reason via the optional logger so the failure mode (expired refresh
 * token vs. transient network flake vs. 5xx) stays observable. Prior
 * behaviour silently discarded all diagnostic context.
 * @param options - The refresh options.
 * @param options.refreshToken - The user's refresh token.
 * @param options.abortSignal - Optional signal to abort the refresh.
 * @param options.logger - Optional logger; defaults to no-op.
 * @param options.logger.error - Error-level sink used for the diagnostic.
 * @returns The new token response, or `null` if refresh failed.
 */
export const refreshAccessToken = async ({
  abortSignal,
  logger,
  refreshToken,
}: {
  refreshToken: string
  abortSignal?: AbortSignal
  logger?: { readonly error: (...args: unknown[]) => void }
}): Promise<HomeTokenResponse | null> => {
  try {
    return await tokenRequest({
      params: {
        client_id: CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      ...(abortSignal === undefined ? {} : { abortSignal }),
    })
  } catch (error) {
    logger?.error('Refresh token exchange failed:', error)
    return null
  }
}
