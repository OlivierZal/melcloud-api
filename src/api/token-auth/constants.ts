/*
 * Endpoints and protocol constants for the MELCloud Home OIDC flow.
 *
 * The base URLs are fixed by the MELCloud backend and the
 * melcloudhome-mobile client registration — do not change without
 * verifying the redirect chain still lands on `melcloudhome://`.
 */
export const CLIENT_ID = 'homemobile'
export const REDIRECT_URI = 'melcloudhome://'
export const SCOPES = 'openid profile email offline_access IdentityServerApi'
export const AUTH_BASIC = 'Basic aG9tZW1vYmlsZTo='
export const AUTH_BASE_URL = 'https://auth.melcloudhome.com'
export const COGNITO_AUTHORITY =
  'https://live-melcloudhome.auth.eu-west-1.amazoncognito.com'
export const PAR_PATH = '/connect/par'
export const TOKEN_PATH = '/connect/token'

export const MAX_REDIRECTS = 20
export const PKCE_RANDOM_BYTES = 32
export const STATE_RANDOM_BYTES = 16
export const REDIRECT_STATUS_MIN = 300
export const REDIRECT_STATUS_MAX = 400
