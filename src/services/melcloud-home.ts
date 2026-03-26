import axios, { type AxiosInstance, type AxiosResponse } from 'axios'

import { CookieJar } from 'tough-cookie'

import type { LoginCredentials } from '../types/index.ts'
import type {
  MELCloudHomeClaim,
  MELCloudHomeUser,
} from '../types/melcloud-home.ts'

import type {
  Logger,
  MELCloudHomeAuthService,
  MELCloudHomeConfig,
} from './interfaces.ts'

const COGNITO_AUTHORITY =
  'https://live-melcloudhome.auth.eu-west-1.amazoncognito.com'

const LOGIN_PATH = '/bff/login'
const USER_PATH = '/bff/user'

const HTTP_REDIRECT_MIN = 300
const HTTP_REDIRECT_MAX = 400

/* v8 ignore next */
const acceptAnyStatus = (): boolean => true

const isRedirect = (status: number): boolean =>
  status >= HTTP_REDIRECT_MIN && status < HTTP_REDIRECT_MAX

const extractFormAction = (html: string): string | null => {
  const match = /<form[^>]+action="(?<action>[^"]+)"/iu.exec(html)
  const encoded = match?.groups?.['action']
  if (encoded === undefined) {
    return null
  }
  /*
   * The form action contains HTML-encoded ampersands (&amp;) as query
   * parameter separators. Parse via a temporary textarea-like approach:
   * split on &amp; and rejoin with &, which is safe because form action
   * attributes only ever encode ampersands in this context.
   */
  const action = encoded.split('&amp;').join('&')
  return action.startsWith('/') ? `${COGNITO_AUTHORITY}${action}` : action
}

const extractHiddenFields = (html: string): Record<string, string> =>
  Object.fromEntries(
    [...html.matchAll(/<input[^>]+type="hidden"[^>]*>/giu)]
      .map((match) => {
        const [tag] = match
        const name = /name="(?<name>[^"]+)"/u.exec(tag)?.groups?.['name']
        const value =
          /value="(?<value>[^"]*)"/u.exec(tag)?.groups?.['value'] ?? ''
        return name === undefined ? undefined : ([name, value] as const)
      })
      .filter((entry) => entry !== undefined),
  )

const parseClaims = (
  claims: readonly MELCloudHomeClaim[],
): MELCloudHomeUser => {
  const get = (type: string): string =>
    claims.find((claim) => claim.type === type)?.value ?? ''
  return {
    email: get('email'),
    firstName: get('given_name'),
    lastName: get('family_name'),
    sub: get('sub'),
  }
}

const resolveUrl = (location: string, base: string): string =>
  location.startsWith('http') ? location : new URL(location, base).href

const storeCookies = async (
  jar: CookieJar,
  { headers }: AxiosResponse,
  url: string,
): Promise<void> => {
  const { 'set-cookie': setCookies } = headers as { 'set-cookie'?: string[] }
  if (Array.isArray(setCookies)) {
    await Promise.all(
      setCookies.map(async (raw: string) => {
        try {
          await jar.setCookie(raw, url)
        } catch {
          /* Ignore invalid Set-Cookie values */
        }
      }),
    )
  }
}

/**
 * MELCloud Home API client. Authenticates via headless OIDC login through
 * a double-federated flow: BFF → IdentityServer → AWS Cognito.
 *
 * Cookies are managed manually (not via axios-cookiejar-support) because the
 * cross-domain redirect chain requires Set-Cookie headers to be captured at
 * each intermediate 302 response.
 *
 * Uses a private constructor — create instances via {@link MELCloudHomeAPI.create}.
 */
export class MELCloudHomeAPI implements MELCloudHomeAuthService {
  readonly #api: AxiosInstance

  readonly #jar = new CookieJar()

  readonly #logger: Logger

  #password = ''

  #user: MELCloudHomeUser | null = null

  #username = ''

  private constructor(config: MELCloudHomeConfig = {}) {
    const { baseURL, logger = console, password, username } = config
    this.#logger = logger
    if (username !== undefined) {
      this.#username = username
    }
    if (password !== undefined) {
      this.#password = password
    }
    this.#api = axios.create({ baseURL, headers: { 'x-csrf': '1' } })
  }

  public get user(): MELCloudHomeUser | null {
    return this.#user
  }

  /**
   * Create and initialize a MELCloud Home API instance.
   * Authenticates and fetches the current user if credentials are provided.
   * @param config - Optional configuration.
   * @returns The initialized API instance.
   */
  public static async create(
    config?: MELCloudHomeConfig,
  ): Promise<MELCloudHomeAPI> {
    const api = new MELCloudHomeAPI(config)
    await api.authenticate()
    return api
  }

  public async authenticate(data?: LoginCredentials): Promise<boolean> {
    const { password = this.#password, username = this.#username } = data ?? {}
    if (!username || !password) {
      return false
    }
    try {
      return await this.#authenticate({ password, username })
    } catch (error) {
      if (data !== undefined) {
        throw error
      }
      this.#logger.error('Authentication failed:', error)
      return false
    }
  }

  public async getUser(): Promise<MELCloudHomeUser | null> {
    try {
      const { data } = await this.#request<MELCloudHomeClaim[]>(
        'get',
        USER_PATH,
        { params: { slide: false } },
      )
      this.#user = parseClaims(data)
      return this.#user
    } catch {
      this.#user = null
      return null
    }
  }

  public isAuthenticated(): boolean {
    return this.#user !== null
  }

  async #authenticate({
    password,
    username,
  }: LoginCredentials): Promise<boolean> {
    const { data: html } = await this.#followRedirects<string>(LOGIN_PATH)
    const action = extractFormAction(html)
    if (action === null) {
      throw new Error('Could not find login form action')
    }
    const callbackUrl = await this.#submitCredentials(action, html, {
      password,
      username,
    })
    await this.#followRedirects(callbackUrl)
    this.#username = username
    this.#password = password
    await this.getUser()
    return this.#user !== null
  }

  /*
   * Follow redirects manually, capturing Set-Cookie at each step.
   * This is required because cross-domain redirect chains drop cookies
   * when using automatic redirect following.
   */
  async #followRedirects<T = unknown>(url: string): Promise<AxiosResponse<T>> {
    const response = await this.#get<T>(url)
    if (!isRedirect(response.status)) {
      return response
    }
    /* v8 ignore next -- location is always present on redirect responses */
    const location = String(response.headers['location'] ?? '')
    return location === '' ? response : (
        this.#followRedirects<T>(resolveUrl(location, url))
      )
  }

  async #get<T = unknown>(url: string): Promise<AxiosResponse<T>> {
    const response = await this.#request<T>('get', url, {
      maxRedirects: 0,
      validateStatus: acceptAnyStatus,
    })
    this.#logger.log(`${String(response.status)} ${url}`)
    return response
  }

  async #request<T = unknown>(
    method: string,
    url: string,
    config: Record<string, unknown> = {},
  ): Promise<AxiosResponse<T>> {
    /* v8 ignore next -- baseURL is always set via constructor config */
    const baseURL = this.#api.defaults.baseURL ?? ''
    const absoluteUrl = url.startsWith('http') ? url : `${baseURL}${url}`
    const cookieHeader = await this.#jar.getCookieString(absoluteUrl)
    const { headers: configHeaders, ...configWithoutHeaders } = config
    const existingHeaders =
      typeof configHeaders === 'object' && configHeaders !== null ?
        configHeaders
      : {}
    const headers = {
      ...existingHeaders,
      ...(cookieHeader === '' ? {} : { Cookie: cookieHeader }),
    }
    const response = await this.#api.request<T>({
      ...configWithoutHeaders,
      headers,
      method,
      url,
    })
    await storeCookies(this.#jar, response, absoluteUrl)
    return response
  }

  async #submitCredentials(
    action: string,
    html: string,
    { password, username }: LoginCredentials,
  ): Promise<string> {
    const response = await this.#request('post', action, {
      data: new URLSearchParams({
        ...extractHiddenFields(html),
        password,
        username,
      }).toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      maxRedirects: 0,
      validateStatus: isRedirect,
    })
    /* v8 ignore next -- location is always present on redirect responses */
    return String(response.headers['location'] ?? '')
  }
}
