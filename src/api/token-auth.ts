import { createHash, randomBytes } from 'node:crypto'

import { CookieJar } from 'tough-cookie'

import type { HomeTokenResponse } from '../types/index.ts'
import { AuthenticationError } from '../errors/index.ts'
import { HttpError } from '../http/index.ts'
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

/**
 * Minimal response shape surfaced internally by the OIDC flow.
 * @template T - Type of the body exposed as `data`; the flow reads bodies as
 * text, so steps that consume the body instantiate it with `string`.
 */
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
  const result: Record<string, string | string[]> = Object.fromEntries(
    headers.entries(),
  )
  const cookies = headers.getSetCookie()
  if (cookies.length > 0) {
    result['set-cookie'] = cookies
  }
  return result
}

// Small POST-form helper for the OIDC flow. The two endpoints it
// targets (PAR, token exchange) always return JSON; parse
// unconditionally and throw on non-2xx. Each caller is responsible
// for narrowing the returned `unknown` (PAR via a local guard, token
// exchange via a Zod schema). Non-2xx throws HttpError — not a plain
// Error — so doAuthenticate's status classification (429 throttle,
// 401 normalization) sees real server refusals from these endpoints.
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
    ...(abortSignal !== undefined && { signal: abortSignal }),
  })
  const responseHeaders = readResponseHeaders(response.headers)
  const text = await response.text()
  if (!response.ok) {
    throw new HttpError(
      `Request to ${url} failed with status ${String(response.status)}`,
      {
        config: { method: 'POST', url },
        response: {
          data: text,
          headers: responseHeaders,
          status: response.status,
        },
      },
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
    ...(options.config.data !== undefined && { body: options.config.data }),
    ...(options.abortSignal !== undefined && { signal: options.abortSignal }),
  })
  const headers = readResponseHeaders(response.headers)
  const data = await response.text()
  return { data, headers, status: response.status }
}

/**
 * Store any `Set-Cookie` headers from an OIDC response into a CookieJar.
 * @param jar - The cookie jar to populate.
 * @param response - The response containing potential Set-Cookie headers.
 * @param response.headers - Headers whose `set-cookie` entries get persisted.
 * @param url - Request URL the cookies were received from; scopes them in the jar.
 */
const storeCookies = async (
  jar: CookieJar,
  { headers }: OidcResponse,
  url: string,
): Promise<void> => {
  const cookies = headers['set-cookie']
  if (!Array.isArray(cookies)) {
    return
  }
  await Promise.allSettled(
    cookies.map(async (raw: string) => jar.setCookie(raw, url)),
  )
}

/**
 * Low-level request for the OIDC auth flow. Uses a transient
 * CookieJar (not the API instance) since the multi-domain redirect
 * chain (IS <-> Cognito) requires cross-domain cookie management.
 * @param options - Request target plus cookie-jar and abort plumbing.
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
    ...(cookieHeader !== '' && { Cookie: cookieHeader }),
  }
  const response = await fetchRaw({
    config: {
      headers: mergedHeaders,
      ...(config.data !== undefined && { data: config.data }),
    },
    jar,
    method,
    url,
    ...(abortSignal !== undefined && { abortSignal }),
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
  const match = /<form[^>]+action="(?<action>[^"]+)"/iv.exec(html)
  const encoded = match?.groups?.action
  if (encoded === undefined) {
    return null
  }
  const action = encoded.replaceAll('&amp;', '&')
  return action.startsWith('/') ? `${COGNITO_AUTHORITY}${action}` : action
}

/**
 * Extract all hidden form fields from an HTML string.
 * @param html - Raw HTML string containing hidden `<input>` fields.
 * @returns A record of name-value pairs for each hidden field.
 */
const extractHiddenFields = (html: string): Record<string, string> =>
  Object.fromEntries(
    html.matchAll(/<input[^>]+type="hidden"[^>]*>/giv).flatMap(([tag]) => {
      const name = /name="(?<name>[^"]+)"/v.exec(tag)?.groups?.name
      const value = /value="(?<value>[^"]*)"/v.exec(tag)?.groups?.value ?? ''
      return name === undefined ? [] : [[name, value] as const]
    }),
  )

/**
 * Extract a redirect URL from an HTML response body via the given
 * regex, which must capture the URL in a named group `url`. HTML
 * entity `&amp;` is unescaped so the returned URL is directly usable
 * as a fetch target.
 * @param html - The HTML string to search.
 * @param regex - A RegExp with a named capture group `url`.
 * @returns The redirect URL if matched, or `null`.
 */
const extractRedirectUrl = (html: string, regex: RegExp): string | null => {
  const url = regex.exec(html)?.groups?.url
  return url === undefined ? null : url.replaceAll('&amp;', '&')
}

/**
 * Extract a redirect URL from an HTML response body. Tries a
 * JavaScript `window.location = "…"` assignment first, then falls
 * back to a `<meta http-equiv="refresh">` tag.
 * @param html - The HTML string to search for a redirect.
 * @returns The redirect URL if found, or `null`.
 */
const extractPageRedirect = (html: string): string | null =>
  extractRedirectUrl(html, /window\.location\s*=\s*['"](?<url>[^'"]+)/v) ??
  extractRedirectUrl(
    html,
    /<meta[^>]+http-equiv="refresh"[^>]+content="[^"]*url=(?<url>[^"]+)/iv,
  )

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
}): string => {
  if (location.startsWith('http')) {
    return location
  }
  const url = new URL(location, base)
  return url.href
}

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
    ...(abortSignal !== undefined && { abortSignal }),
  })
  const redirectTarget = extractRedirectTarget(response, url)
  if (redirectTarget !== null) {
    return authFollowRedirects({
      jar,
      remaining: remaining - 1,
      url: redirectTarget,
      ...(abortSignal !== undefined && { abortSignal }),
    })
  }
  return { data: response.data, url }
}

// ------------------------------------------------------------------
//  Auth flow steps
// ------------------------------------------------------------------

/**
 * Push Authorization Request — returns the opaque `request_uri`.
 * @param options - PKCE challenge plus abort plumbing for the PAR call.
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
  const parameters = new URLSearchParams({
    client_id: CLIENT_ID,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    state: randomBytes(STATE_RANDOM_BYTES).toString('base64url'),
  })
  const { data } = await fetchPostForm({
    body: parameters.toString(),
    headers: {
      Authorization: AUTH_BASIC,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    url: `${AUTH_BASE_URL}${PAR_PATH}`,
    ...(abortSignal !== undefined && { abortSignal }),
  })
  return parseOrThrow(HomeParResponseSchema, data, 'OIDC PAR endpoint')
    .request_uri
}

// The Cognito hosted UI re-renders the login page with its reason in an
// `errorMessage` element when it refuses a submission.
const refusedSubmissionMessage = (html: string): string => {
  const match =
    /(?:id|class)="errorMessage[^"]*"[^>]*>(?<message>[^<]*)</v.exec(html)
  const reason = match?.groups?.message?.trim() ?? ''
  return reason === '' ?
      'Credential submission was not redirected'
    : `MELCloud Home rejected the sign-in: ${reason}`
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
    ...(abortSignal !== undefined && { abortSignal }),
  })
  const action = extractFormAction(html)
  if (action === null) {
    throw new Error('Could not find login form action')
  }
  const form = new URLSearchParams({
    ...extractHiddenFields(html),
    cognitoAsfData: '',
    password: credentials.password,
    username: credentials.username,
  })
  const submitResponse = await authRequest({
    config: {
      data: form.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
    jar,
    method: 'post',
    url: action,
    ...(abortSignal !== undefined && { abortSignal }),
  })
  const callbackLocation = String(submitResponse.headers.location ?? '')
  if (callbackLocation === '') {
    // A re-rendered login page instead of a redirect is Cognito refusing
    // the credentials: classified so the login backoff engages instead of
    // hammering doomed sign-ins on every sync.
    throw new AuthenticationError(refusedSubmissionMessage(submitResponse.data))
  }
  return resolveUrl({ base: action, location: callbackLocation })
}

/**
 * Follow the callback chain and extract the authorization code.
 * @param callbackUrl - Cognito-issued URL that starts the redirect hops.
 * @param jar - Carries the session cookies across the redirect hops.
 * @param abortSignal - Cancels the redirect chain mid-flight when triggered.
 * @returns The one-time `code` query value from the final IdentityServer redirect.
 */
const extractAuthorizationCode = async (
  callbackUrl: string,
  jar: CookieJar,
  abortSignal?: AbortSignal,
): Promise<string> => {
  const { url } = await authFollowRedirects({
    jar,
    url: callbackUrl,
    ...(abortSignal !== undefined && { abortSignal }),
  })
  const { host, pathname, protocol, searchParams } = new URL(url)
  const code = searchParams.get('code')
  if (code === null) {
    // The IdP concluded the flow without granting a code — a refusal, not
    // a transport failure. The landing spot and the OIDC error params
    // carry the actual reason (query values other than these never leak).
    const oidcError = searchParams.get('error')
    const description = searchParams.get('error_description')
    const details = [
      `landed on ${protocol}//${host}${pathname}`,
      ...(oidcError === null ? [] : [`error=${oidcError}`]),
      ...(description === null ? [] : [description]),
    ].join('; ')
    throw new AuthenticationError(
      `No authorization code in callback (${details})`,
    )
  }
  return code
}

/**
 * POST to the IdentityServer token endpoint and validate the response.
 * @param options - Form parameters plus abort plumbing for the token call.
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
  const form = new URLSearchParams(params)
  const { data: tokens } = await fetchPostForm({
    body: form.toString(),
    headers: {
      Authorization: AUTH_BASIC,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    url: `${AUTH_BASE_URL}${TOKEN_PATH}`,
    ...(abortSignal !== undefined && { abortSignal }),
  })
  return parseOrThrow(HomeTokenResponseSchema, tokens, 'OIDC token endpoint')
}

// ------------------------------------------------------------------
//  Public surface
// ------------------------------------------------------------------

/**
 * Full headless OIDC login: PAR → Cognito → token exchange.
 * @param options - Credentials plus abort plumbing for the full login flow.
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
    ...(abortSignal !== undefined && { abortSignal }),
  })
  const authorizeUrl = `${AUTH_BASE_URL}/connect/authorize?client_id=${CLIENT_ID}&request_uri=${encodeURIComponent(requestUri)}`

  const callbackUrl = await submitCredentials({
    authorizeUrl,
    credentials,
    jar,
    ...(abortSignal !== undefined && { abortSignal }),
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
    ...(abortSignal !== undefined && { abortSignal }),
  })
}

/**
 * Exchange a refresh token for a fresh access token. Returns `null`
 * on **any** failure so the caller can fall through to a full re-auth
 * without threading an exception up the stack — but logs the error
 * reason via the optional logger so the failure mode (expired refresh
 * token vs. transient network flake vs. 5xx) stays observable. Prior
 * behaviour silently discarded all diagnostic context.
 * @param options - Refresh token plus logging and abort plumbing.
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
  const request = {
    params: {
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    },
    ...(abortSignal !== undefined && { abortSignal }),
  }
  try {
    return await tokenRequest(request)
  } catch (error) {
    logger?.error('Refresh token exchange failed:', error)
    return null
  }
}
