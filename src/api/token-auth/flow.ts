import { createHash, randomBytes } from 'node:crypto'

import type { CookieJar } from 'tough-cookie'

import {
  HomeTokenResponseSchema,
  parseOrThrow,
} from '../../validation/index.ts'
import {
  AUTH_BASE_URL,
  AUTH_BASIC,
  CLIENT_ID,
  PAR_PATH,
  PKCE_RANDOM_BYTES,
  REDIRECT_URI,
  SCOPES,
  STATE_RANDOM_BYTES,
  TOKEN_PATH,
} from './constants.ts'
import { extractFormAction, extractHiddenFields } from './html-parsing.ts'
import { authFollowRedirects, resolveUrl } from './redirect.ts'
import { authRequest, fetchPostForm } from './transport.ts'

/** Token response surfaced by the IdentityServer token endpoint. */
export interface TokenResponse {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
  id_token?: string
  refresh_token?: string
}

/** Options for {@link submitCredentials}. */
interface SubmitCredentialsOptions {
  authorizeUrl: string
  credentials: { password: string; username: string }
  jar: CookieJar
  abortSignal?: AbortSignal
}

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
 * Push Authorization Request — returns the opaque `request_uri`.
 * @param options - The PAR options.
 * @param options.challenge - The PKCE code challenge.
 * @param options.abortSignal - Optional signal to abort the request.
 * @returns The opaque PAR request URI.
 */
export const par = async ({
  abortSignal,
  challenge,
}: {
  challenge: string
  abortSignal?: AbortSignal
}): Promise<string> => {
  const {
    data: { request_uri: requestUri },
  } = await fetchPostForm<{ request_uri: string }>({
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
  return requestUri
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
export const submitCredentials = async ({
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
  return resolveUrl({ base: action, location: callbackLocation })
}

/**
 * Follow the callback chain and extract the authorization code.
 * @param callbackUrl - The callback URL to follow.
 * @param jar - CookieJar for the auth flow.
 * @param abortSignal - Optional abort signal.
 * @returns The authorization code.
 */
export const extractAuthorizationCode = async (
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
export const tokenRequest = async ({
  abortSignal,
  params,
}: {
  params: Record<string, string>
  abortSignal?: AbortSignal
}): Promise<TokenResponse> => {
  const { data: tokens } = await fetchPostForm<unknown>({
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
