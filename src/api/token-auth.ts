import { createHash, randomBytes } from 'node:crypto'

import { CookieJar } from 'tough-cookie'
import axios, { type AxiosResponse } from 'axios'

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

export const CLIENT_ID = 'homemobile'
export const REDIRECT_URI = 'melcloudhome://'
export const SCOPES = 'openid profile email offline_access IdentityServerApi'
export const AUTH_BASIC = 'Basic aG9tZW1vYmlsZTo='
export const AUTH_BASE_URL = 'https://auth.melcloudhome.com'
export const COGNITO_AUTHORITY =
  'https://live-melcloudhome.auth.eu-west-1.amazoncognito.com'
export const PAR_PATH = '/connect/par'
export const TOKEN_PATH = '/connect/token'

const MAX_REDIRECTS = 20
const PKCE_RANDOM_BYTES = 32
const STATE_RANDOM_BYTES = 16
const REDIRECT_STATUS_MIN = 300
const REDIRECT_STATUS_MAX = 400

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface TokenResponse {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
  id_token?: string
  refresh_token?: string
}

/** Options for {@link authRequest}. */
interface AuthRequestOptions {
  config: {
    [key: string]: unknown
    headers?: Record<string, string>
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Extract the `action` attribute from the first `<form>` element in an HTML string.
 * @param html - Raw HTML string from the login page.
 * @returns The resolved form action URL, or `null` if not found.
 */
export const extractFormAction = (html: string): string | null => {
  const match = /<form[^>]+action="(?<action>[^"]+)"/iu.exec(html)
  const encoded = match?.groups?.['action']
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
export const extractHiddenFields = (html: string): Record<string, string> =>
  Object.fromEntries(
    [...html.matchAll(/<input[^>]+type="hidden"[^>]*>/giu)].flatMap(([tag]) => {
      const name = /name="(?<name>[^"]+)"/u.exec(tag)?.groups?.['name']
      const value =
        /value="(?<value>[^"]*)"/u.exec(tag)?.groups?.['value'] ?? ''
      return name === undefined ? [] : [[name, value] as const]
    }),
  )

/**
 * Generate a PKCE challenge and verifier pair.
 * @returns An object containing the `challenge` and `verifier` strings.
 */
export const generatePKCE = (): { challenge: string; verifier: string } => {
  const verifier = randomBytes(PKCE_RANDOM_BYTES).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { challenge, verifier }
}

/**
 * Resolve a potentially relative URL against a base URL.
 * @param location - The URL or relative path to resolve.
 * @param base - The base URL for resolution.
 * @returns The fully qualified URL.
 */
export const resolveUrl = (location: string, base: string): string =>
  location.startsWith('http') ? location : new URL(location, base).href

/**
 * Store any `Set-Cookie` headers from an Axios response into a CookieJar.
 * @param jar - The cookie jar to populate.
 * @param response - The Axios response containing potential Set-Cookie headers.
 * @param response.headers - The response headers.
 * @param url - The URL context for cookie storage.
 */
export const storeCookies = async (
  jar: CookieJar,
  { headers }: AxiosResponse,
  url: string,
): Promise<void> => {
  const { 'set-cookie': setCookies } = headers as { 'set-cookie'?: string[] }
  if (!Array.isArray(setCookies)) {
    return
  }
  await Promise.all(
    setCookies.map(async (raw: string) => {
      try {
        await jar.setCookie(raw, url)
      } catch {
        // Ignore invalid Set-Cookie values
      }
    }),
  )
}

/* ------------------------------------------------------------------ */
/*  Auth flow functions                                               */
/* ------------------------------------------------------------------ */

/**
 * Push Authorization Request -- returns the opaque `request_uri`.
 * @param challenge - The PKCE code challenge.
 * @param abortSignal - Optional signal to abort the request.
 * @returns The opaque PAR request URI.
 */
export const par = async (
  challenge: string,
  abortSignal?: AbortSignal,
): Promise<string> => {
  const { data } = await axios.post<{ request_uri: string }>(
    `${AUTH_BASE_URL}${PAR_PATH}`,
    new URLSearchParams({
      client_id: CLIENT_ID,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES,
      state: randomBytes(STATE_RANDOM_BYTES).toString('base64url'),
    }).toString(),
    {
      headers: {
        Authorization: AUTH_BASIC,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      ...(abortSignal === undefined ? {} : { signal: abortSignal }),
    },
  )
  return data.request_uri
}

/**
 * Low-level request for the OIDC auth flow. Uses a transient
 * CookieJar (not the API instance) since the multi-domain redirect
 * chain (IS &lt;-&gt; Cognito) requires cross-domain cookie management.
 * @param options - The auth request options.
 * @param options.method - HTTP method.
 * @param options.url - Target URL.
 * @param options.config - Axios request config with optional headers.
 * @param options.jar - CookieJar for cross-domain cookie management.
 * @param options.abortSignal - Optional abort signal.
 * @returns The Axios response.
 */
export const authRequest = async <T = unknown>({
  abortSignal,
  config,
  jar,
  method,
  url,
}: AuthRequestOptions): Promise<AxiosResponse<T>> => {
  const cookieHeader = await jar.getCookieString(url)
  const { headers: configHeaders, ...rest } = config
  const response = await axios.request<T>({
    ...rest,
    headers: {
      ...configHeaders,
      ...(cookieHeader === '' ? {} : { Cookie: cookieHeader }),
    },
    maxRedirects: 0,
    method,
    url,
    /* v8 ignore next -- callback passed to axios; never invoked in unit tests where axios.request is mocked */
    validateStatus: () => true,
    ...(abortSignal === undefined ? {} : { signal: abortSignal }),
  })
  await storeCookies(jar, response, url)
  return response
}

/**
 * Extract a JavaScript-based redirect URL from an HTML response body.
 * @param html - The HTML string to search for a JS redirect.
 * @returns The redirect URL if found, or `null`.
 */
const extractJsRedirect = (html: string): string | null => {
  const jsMatch = /window\.location\s*=\s*['"](?<url>[^'"]+)/u.exec(html)
  if (jsMatch?.groups?.['url'] === undefined) {
    return null
  }
  return jsMatch.groups['url'].split('&amp;').join('&')
}

/**
 * Extract the redirect target from an HTTP or JS redirect response.
 * @param response - The Axios response.
 * @param currentUrl - The URL that produced this response.
 * @returns The resolved redirect URL, or `null` if no redirect was detected.
 */
const extractRedirectTarget = (
  response: AxiosResponse<string>,
  currentUrl: string,
): string | null => {
  if (
    response.status >= REDIRECT_STATUS_MIN &&
    response.status < REDIRECT_STATUS_MAX
  ) {
    const location = String(response.headers['location'] ?? '')
    return resolveUrl(location, currentUrl)
  }
  const jsRedirect = extractJsRedirect(response.data)
  return jsRedirect === null ? null : resolveUrl(jsRedirect, currentUrl)
}

/**
 * Follow HTTP 302 redirects and IS JavaScript redirects until a
 * non-redirect page is reached or the URL matches the app's custom
 * scheme (`melcloudhome://`).
 * @param options - The redirect-following options.
 * @param options.url - Current URL to follow.
 * @param options.jar - CookieJar for cross-domain cookie management.
 * @param options.abortSignal - Optional abort signal.
 * @param options.remaining - Number of remaining redirects allowed.
 * @returns The final response data and URL.
 */
export const authFollowRedirects = async ({
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
  const response = await authRequest<string>({
    config: {},
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

/**
 * POST to the IdentityServer token endpoint.
 * @param params - URL-encoded form parameters for the token request.
 * @param abortSignal - Optional signal to abort the request.
 * @returns The token response.
 */
export const tokenRequest = async (
  params: Record<string, string>,
  abortSignal?: AbortSignal,
): Promise<TokenResponse> => {
  const { data } = await axios.post<TokenResponse>(
    `${AUTH_BASE_URL}${TOKEN_PATH}`,
    new URLSearchParams(params).toString(),
    {
      headers: {
        Authorization: AUTH_BASIC,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      ...(abortSignal === undefined ? {} : { signal: abortSignal }),
    },
  )
  return data
}

/** Options for {@link submitCredentials}. */
interface SubmitCredentialsOptions {
  authorizeUrl: string
  credentials: { password: string; username: string }
  jar: CookieJar
  abortSignal?: AbortSignal
}

/**
 * Navigate to the Cognito login page and submit credentials.
 * @param options - The credential submission options.
 * @param options.authorizeUrl - The OIDC authorize URL to start from.
 * @param options.credentials - The user's login credentials.
 * @param options.jar - CookieJar for the auth flow.
 * @param options.abortSignal - Optional abort signal.
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
  const callbackLocation = String(submitResponse.headers['location'] ?? '')
  if (callbackLocation === '') {
    throw new Error('No redirect after credential submission')
  }
  return resolveUrl(callbackLocation, action)
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
  const { url: finalUrl } = await authFollowRedirects({
    jar,
    url: callbackUrl,
    ...(abortSignal === undefined ? {} : { abortSignal }),
  })
  const code = new URL(finalUrl).searchParams.get('code')
  if (code === null) {
    throw new Error('No authorization code in callback')
  }
  return code
}

/**
 * Full headless OIDC login: PAR -> Cognito -> token exchange.
 * Returns the token response on success.
 * @param credentials - The user's login credentials.
 * @param credentials.password - The user's password.
 * @param credentials.username - The user's username.
 * @param abortSignal - Optional signal to abort the auth flow.
 * @returns The token response containing access and refresh tokens.
 */
export const performTokenAuth = async (
  credentials: { password: string; username: string },
  abortSignal?: AbortSignal,
): Promise<TokenResponse> => {
  const { challenge, verifier } = generatePKCE()
  const jar = new CookieJar()

  const requestUri = await par(challenge, abortSignal)
  const authorizeUrl = `${AUTH_BASE_URL}/connect/authorize?client_id=${CLIENT_ID}&request_uri=${encodeURIComponent(requestUri)}`

  const callbackUrl = await submitCredentials({
    authorizeUrl,
    credentials,
    jar,
    ...(abortSignal === undefined ? {} : { abortSignal }),
  })
  const code = await extractAuthorizationCode(callbackUrl, jar, abortSignal)

  return tokenRequest(
    {
      client_id: CLIENT_ID,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    },
    abortSignal,
  )
}

/**
 * Use the refresh token to obtain a fresh access token. Returns null on failure.
 * @param refreshToken - The refresh token to exchange.
 * @param abortSignal - Optional signal to abort the request.
 * @returns The token response, or `null` if the refresh failed.
 */
export const refreshAccessToken = async (
  refreshToken: string,
  abortSignal?: AbortSignal,
): Promise<TokenResponse | null> => {
  try {
    return await tokenRequest(
      {
        client_id: CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      abortSignal,
    )
  } catch {
    return null
  }
}
