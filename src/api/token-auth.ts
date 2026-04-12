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

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface TokenResponse {
  access_token: string
  expires_in: number
  id_token?: string
  refresh_token?: string
  scope: string
  token_type: string
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

export const extractFormAction = (html: string): string | null => {
  const match = /<form[^>]+action="(?<action>[^"]+)"/iu.exec(html)
  const encoded = match?.groups?.['action']
  if (encoded === undefined) {
    return null
  }
  const action = encoded.split('&amp;').join('&')
  return action.startsWith('/') ? `${COGNITO_AUTHORITY}${action}` : action
}

export const extractHiddenFields = (html: string): Record<string, string> =>
  Object.fromEntries(
    [...html.matchAll(/<input[^>]+type="hidden"[^>]*>/giu)].flatMap(([tag]) => {
      const name = /name="(?<name>[^"]+)"/u.exec(tag)?.groups?.['name']
      const value =
        /value="(?<value>[^"]*)"/u.exec(tag)?.groups?.['value'] ?? ''
      return name === undefined ? [] : [[name, value] as const]
    }),
  )

export const generatePKCE = (): { challenge: string; verifier: string } => {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { challenge, verifier }
}

export const resolveUrl = (location: string, base: string): string =>
  location.startsWith('http') ? location : new URL(location, base).href

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

/** Push Authorization Request -> returns the opaque `request_uri`. */
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
      state: randomBytes(16).toString('base64url'),
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
 * chain (IS <-> Cognito) requires cross-domain cookie management.
 */
export const authRequest = async <T = unknown>(
  method: string,
  url: string,
  config: {
    [key: string]: unknown
    headers?: Record<string, string>
  },
  jar: CookieJar,
  abortSignal?: AbortSignal,
): Promise<AxiosResponse<T>> => {
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
    validateStatus: () => true,
    ...(abortSignal === undefined ? {} : { signal: abortSignal }),
  })
  await storeCookies(jar, response, url)
  return response
}

/**
 * Follow HTTP 302 redirects and IS JavaScript redirects until a
 * non-redirect page is reached or the URL matches the app's custom
 * scheme (`melcloudhome://`).
 */
export const authFollowRedirects = async (
  url: string,
  jar: CookieJar,
  abortSignal?: AbortSignal,
  remaining = MAX_REDIRECTS,
): Promise<{ data: string; url: string }> => {
  if (remaining <= 0) {
    throw new Error(`Too many redirects (max ${String(MAX_REDIRECTS)})`)
  }
  if (url.startsWith(REDIRECT_URI)) {
    return { data: '', url }
  }
  const response = await authRequest<string>('get', url, {}, jar, abortSignal)
  if (response.status >= 300 && response.status < 400) {
    const location = String(response.headers['location'] ?? '')
    return authFollowRedirects(
      resolveUrl(location, url),
      jar,
      abortSignal,
      remaining - 1,
    )
  }
  // IS Redirect page: 200 with JavaScript redirect
  const jsMatch = /window\.location\s*=\s*['"]([^'"]+)/u.exec(
    String(response.data),
  )
  if (jsMatch) {
    const redirectUrl = (jsMatch[1] as string).split('&amp;').join('&')
    return authFollowRedirects(
      resolveUrl(redirectUrl, url),
      jar,
      abortSignal,
      remaining - 1,
    )
  }
  return { data: String(response.data), url }
}

/** POST to the IdentityServer token endpoint. */
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

/**
 * Full headless OIDC login: PAR -> Cognito -> token exchange.
 * Returns the token response on success.
 */
export const performTokenAuth = async (
  credentials: { password: string; username: string },
  abortSignal?: AbortSignal,
): Promise<TokenResponse> => {
  const { challenge, verifier } = generatePKCE()
  const jar = new CookieJar()

  // 1. Pushed Authorization Request
  const requestUri = await par(challenge, abortSignal)

  // 2. Follow authorize -> IS login -> Cognito login page
  const { data: html } = await authFollowRedirects(
    `${AUTH_BASE_URL}/connect/authorize?client_id=${CLIENT_ID}&request_uri=${encodeURIComponent(requestUri)}`,
    jar,
    abortSignal,
  )
  const action = extractFormAction(html)
  if (action === null) {
    throw new Error('Could not find login form action')
  }

  // 3. Submit credentials to Cognito
  const submitResponse = await authRequest(
    'post',
    action,
    {
      data: new URLSearchParams({
        ...extractHiddenFields(html),
        cognitoAsfData: '',
        password: credentials.password,
        username: credentials.username,
      }).toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
    jar,
    abortSignal,
  )

  const callbackLocation = String(submitResponse.headers['location'] ?? '')
  if (callbackLocation === '') {
    throw new Error('No redirect after credential submission')
  }

  // 4. Follow IS callback chain -> melcloudhome:// with code
  const { url: callbackUrl } = await authFollowRedirects(
    resolveUrl(callbackLocation, action),
    jar,
    abortSignal,
  )
  const code = new URL(callbackUrl).searchParams.get('code')
  if (code === null) {
    throw new Error('No authorization code in callback')
  }

  // 5. Exchange code for tokens
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

/** Use the refresh token to obtain a fresh access token. Returns null on failure. */
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
