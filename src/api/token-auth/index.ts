import { CookieJar } from 'tough-cookie'

import { AUTH_BASE_URL, CLIENT_ID, REDIRECT_URI } from './constants.ts'
import {
  type TokenResponse,
  extractAuthorizationCode,
  generatePKCE,
  par,
  submitCredentials,
  tokenRequest,
} from './flow.ts'

export type { TokenResponse } from './flow.ts'

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
}): Promise<TokenResponse> => {
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
 * Exchange a refresh token for a fresh access token.
 * @param options - The refresh options.
 * @param options.refreshToken - The user's refresh token.
 * @param options.abortSignal - Optional signal to abort the refresh.
 * @returns The new token response, or `null` if refresh failed.
 */
export const refreshAccessToken = async ({
  abortSignal,
  refreshToken,
}: {
  refreshToken: string
  abortSignal?: AbortSignal
}): Promise<TokenResponse | null> => {
  try {
    return await tokenRequest({
      params: {
        client_id: CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      ...(abortSignal === undefined ? {} : { abortSignal }),
    })
  } catch {
    return null
  }
}
