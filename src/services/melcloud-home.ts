import { CookieJar } from 'tough-cookie'
import axios, { type AxiosInstance, type AxiosResponse } from 'axios'

import type {
  LoginCredentials,
  MELCloudHomeClaim,
  MELCloudHomeUser,
} from '../types/index.ts'
import { setting } from '../decorators/index.ts'
import type {
  Logger,
  MELCloudHomeAuthService,
  MELCloudHomeConfig,
  SettingManager,
} from './interfaces.ts'

const COGNITO_AUTHORITY =
  'https://live-melcloudhome.auth.eu-west-1.amazoncognito.com'

const LOGIN_PATH = '/bff/login'
const MAX_REDIRECTS = 20
const USER_PATH = '/bff/user'

const HTTP_REDIRECT_MIN = 300
const HTTP_REDIRECT_MAX = 400

/* v8 ignore next -- callback executed inside axios, not directly traceable by v8 */
const acceptAnyStatus = (): boolean => true

const isRedirect = (status: number): boolean =>
  status >= HTTP_REDIRECT_MIN && status < HTTP_REDIRECT_MAX

const extractFormAction = (html: string): string | null => {
  const match = /<form[^>]+action="(?<action>[^"]+)"/iu.exec(html)
  const encoded = match?.groups?.['action']
  if (encoded === undefined) {
    return null
  }
  const action = encoded.split('&amp;').join('&')
  return action.startsWith('/') ? `${COGNITO_AUTHORITY}${action}` : action
}

const extractHiddenFields = (html: string): Record<string, string> =>
  Object.fromEntries(
    [...html.matchAll(/<input[^>]+type="hidden"[^>]*>/giu)].flatMap(
      ([tag]) => {
        const name = /name="(?<name>[^"]+)"/u.exec(tag)?.groups?.['name']
        const value =
          /value="(?<value>[^"]*)"/u.exec(tag)?.groups?.['value'] ?? ''
        return name === undefined ? [] : [[name, value] as const]
      },
    ),
  )

const getClaimValue = (
  claims: MELCloudHomeClaim[],
  type: string,
): string => claims.find((claim) => claim.type === type)?.value ?? ''

const parseClaims = (
  claims: MELCloudHomeClaim[],
): MELCloudHomeUser => ({
  email: getClaimValue(claims, 'email'),
  firstName: getClaimValue(claims, 'given_name'),
  lastName: getClaimValue(claims, 'family_name'),
  sub: getClaimValue(claims, 'sub'),
})

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
          // Ignore invalid Set-Cookie values
        }
      }),
    )
  }
}

/* v8 ignore next -- `path` is always defined from split but TS requires the fallback */
const stripQueryParams = (url: string): string => {
  const [path] =
    url.startsWith('http') ? [new URL(url).pathname] : url.split('?')
  return path ?? url
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

  #user: MELCloudHomeUser | null = null

  public readonly settingManager?: SettingManager

  @setting
  private accessor password = ''

  @setting
  private accessor username = ''

  public get user(): MELCloudHomeUser | null {
    return this.#user
  }

  private constructor(config: MELCloudHomeConfig = {}) {
    const {
      baseURL,
      logger = console,
      password,
      settingManager,
      username,
    } = config
    this.#logger = logger
    this.settingManager = settingManager
    if (username !== undefined) {
      this.username = username
    }
    if (password !== undefined) {
      this.password = password
    }
    this.#api = axios.create({ baseURL, headers: { 'x-csrf': '1' } })
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
    const { password = this.password, username = this.username } = data ?? {}
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

  /**
   * Fetch the current user's claims from the BFF.
   * Returns `null` if the request fails (401, network error, etc.)
   * and clears the stored user state.
   * @returns The user or `null`.
   */
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

  async #authenticate(credentials: LoginCredentials): Promise<boolean> {
    this.#user = null
    await this.#performOidcLogin(credentials)
    ;({ password: this.password, username: this.username } = credentials)
    return (await this.getUser()) !== null
  }

  async #performOidcLogin(credentials: LoginCredentials): Promise<void> {
    const { data: html } = await this.#followRedirects<string>(LOGIN_PATH)
    const action = extractFormAction(html)
    if (action === null) {
      throw new Error('Could not find login form action')
    }
    const callbackUrl = await this.#submitCredentials(action, html, credentials)
    await this.#followRedirects(callbackUrl)
  }

  /*
   * Follow redirects manually, capturing Set-Cookie at each step.
   * This is required because cross-domain redirect chains drop cookies
   * when using automatic redirect following.
   */
  async #followRedirects<T = unknown>(
    url: string,
    remaining = MAX_REDIRECTS,
  ): Promise<AxiosResponse<T>> {
    if (remaining <= 0) {
      throw new Error(`Too many redirects (max ${String(MAX_REDIRECTS)})`)
    }
    const response = await this.#get<T>(url)
    if (!isRedirect(response.status)) {
      return response
    }
    const location = String(response.headers['location'] ?? '')
    return location === '' ? response : (
        this.#followRedirects<T>(resolveUrl(location, url), remaining - 1)
      )
  }

  async #get<T = unknown>(url: string): Promise<AxiosResponse<T>> {
    const response = await this.#request<T>('get', url, {
      maxRedirects: 0,
      validateStatus: acceptAnyStatus,
    })
    this.#logger.log(`${String(response.status)} ${stripQueryParams(url)}`)
    return response
  }

  async #request<T = unknown>(
    method: string,
    url: string,
    { headers: configHeaders, ...config }: {
      [key: string]: unknown
      headers?: Record<string, string>
    } = {},
  ): Promise<AxiosResponse<T>> {
    /* v8 ignore next -- baseURL is always set via constructor config */
    const baseURL = this.#api.defaults.baseURL ?? ''
    const absoluteUrl = url.startsWith('http') ? url : `${baseURL}${url}`
    const cookieHeader = await this.#jar.getCookieString(absoluteUrl)
    const response = await this.#api.request<T>({
      ...config,
      headers: {
        ...configHeaders,
        ...(cookieHeader === '' ? {} : { Cookie: cookieHeader }),
      },
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
    return String(response.headers['location'] ?? '')
  }
}
