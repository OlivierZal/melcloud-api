import { CookieJar } from 'tough-cookie'
import axios, { type AxiosInstance, type AxiosResponse } from 'axios'

import type {
  HomeAtaValues,
  HomeBuilding,
  HomeClaim,
  HomeContext,
  HomeEnergyData,
  HomeErrorLogEntry,
  HomeReportData,
  HomeUser,
  LoginCredentials,
} from '../types/index.ts'
import { authenticate, setting, syncDevices } from '../decorators/index.ts'
import {
  APICallResponseData,
  createAPICallErrorData,
} from '../logging/index.ts'
import type {
  HomeAPIConfig,
  Logger,
  OnSyncFunction,
  SettingManager,
} from './interfaces.ts'
import { HomeDeviceRegistry } from './home-device-registry.ts'
import { SyncManager } from './sync-manager.ts'

/** MELCloud Home API contract. */
export interface HomeAPI {
  /** Device registry with stable model references across syncs. */
  readonly registry: HomeDeviceRegistry

  /** The currently authenticated user, or `null`. */
  readonly user: HomeUser | null

  /** Authenticate with MELCloud Home using the provided or stored credentials. */
  readonly authenticate: (data?: LoginCredentials) => Promise<boolean>

  /** Cancel any pending automatic sync. */
  readonly clearSync: () => void

  /** Fetch energy consumption data for a device. */
  readonly getEnergy: (
    id: string,
    params: { from: string; interval: string; to: string },
  ) => Promise<HomeEnergyData | null>

  /** Fetch the error log for a device. */
  readonly getErrorLog: (id: string) => Promise<HomeErrorLogEntry[]>

  /** Fetch WiFi signal strength (RSSI) telemetry for a device. */
  readonly getSignal: (
    id: string,
    params: { from: string; to: string },
  ) => Promise<HomeEnergyData | null>

  /** Fetch temperature trend summary for a device. */
  readonly getTemperatures: (
    id: string,
    params: { from: string; period: string; to: string },
  ) => Promise<HomeReportData[] | null>

  /** Fetch the current user's claims from the BFF. Returns `null` on failure. */
  readonly getUser: () => Promise<HomeUser | null>

  /** Whether a user is currently authenticated (session cookie valid). */
  readonly isAuthenticated: () => boolean

  /** Fetch all buildings and sync the device registry. */
  readonly list: () => Promise<HomeBuilding[]>

  /** Update the automatic sync interval and reschedule. Set to `0` or `null` to disable. */
  readonly setSyncInterval: (minutes: number | null) => void

  /** Update device values and refresh device data via list(). */
  readonly setValues: (id: string, values: HomeAtaValues) => Promise<boolean>
}

const COGNITO_AUTHORITY =
  'https://live-melcloudhome.auth.eu-west-1.amazoncognito.com'

const API_BASE_URL = 'https://melcloudhome.com'
const ATA_UNIT_PATH = '/api/ataunit'
const CONTEXT_PATH = '/api/user/context'
const ENERGY_PATH = '/api/telemetry/energy'
const LOGIN_PATH = '/bff/login'
const MILLISECONDS_IN_SECOND = 1000
const REPORT_PATH = '/api/v1/report/trendsummary'
const SIGNAL_PATH = '/api/telemetry/actual'
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
    [...html.matchAll(/<input[^>]+type="hidden"[^>]*>/giu)].flatMap(([tag]) => {
      const name = /name="(?<name>[^"]+)"/u.exec(tag)?.groups?.['name']
      const value =
        /value="(?<value>[^"]*)"/u.exec(tag)?.groups?.['value'] ?? ''
      return name === undefined ? [] : [[name, value] as const]
    }),
  )

const getClaimValue = (claims: HomeClaim[], type: string): string =>
  claims.find((claim) => claim.type === type)?.value ?? ''

const parseClaims = (claims: HomeClaim[]): HomeUser => ({
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
export class MELCloudHomeAPI implements Disposable, HomeAPI {
  readonly #api: AxiosInstance

  #context: HomeContext | null = null

  readonly #jar = new CookieJar()

  readonly #registry = new HomeDeviceRegistry()

  readonly #syncManager: SyncManager

  #user: HomeUser | null = null

  public readonly logger: Logger

  public readonly onSync?: OnSyncFunction

  public readonly settingManager?: SettingManager

  @setting
  private accessor expiry = ''

  @setting
  private accessor password = ''

  @setting
  private accessor username = ''

  public get context(): HomeContext | null {
    return this.#context
  }

  public get registry(): HomeDeviceRegistry {
    return this.#registry
  }

  public get user(): HomeUser | null {
    return this.#user
  }

  private constructor(config: HomeAPIConfig = {}) {
    const {
      autoSyncInterval = 1,
      baseURL = API_BASE_URL,
      logger = console,
      onSync,
      password,
      settingManager,
      username,
    } = config
    this.logger = logger
    this.onSync = onSync
    this.settingManager = settingManager
    if (username !== undefined) {
      this.username = username
    }
    if (password !== undefined) {
      this.password = password
    }
    this.#api = axios.create({ baseURL, headers: { 'x-csrf': '1' } })
    this.#syncManager = new SyncManager(
      async () => this.list(),
      logger,
      autoSyncInterval,
    )
  }

  /**
   * Create and initialize a MELCloud Home API instance.
   * Authenticates and fetches the current user if credentials are provided.
   * @param config - Optional configuration.
   * @returns The initialized API instance.
   */
  public static async create(config?: HomeAPIConfig): Promise<MELCloudHomeAPI> {
    const api = new MELCloudHomeAPI(config)
    await api.authenticate()
    return api
  }

  @authenticate
  public async authenticate(data?: LoginCredentials): Promise<boolean> {
    /* v8 ignore next -- @authenticate guarantees data is always provided */
    const { password, username } = data ?? { password: '', username: '' }
    this.#user = null
    this.expiry = ''
    await this.#performOidcLogin({ password, username })
    ;({ password: this.password, username: this.username } = {
      password,
      username,
    })
    return (await this.getUser()) !== null
  }

  public async getEnergy(
    id: string,
    params: { from: string; interval: string; to: string },
  ): Promise<HomeEnergyData | null> {
    try {
      const { data } = await this.#request<HomeEnergyData>(
        'get',
        `${ENERGY_PATH}/${id}`,
        {
          params: {
            ...params,
            measure: 'cumulative_energy_consumed_since_last_upload',
          },
        },
      )
      return data
    } catch {
      return null
    }
  }

  public async getErrorLog(id: string): Promise<HomeErrorLogEntry[]> {
    try {
      const { data } = await this.#request<HomeErrorLogEntry[]>(
        'get',
        `${ATA_UNIT_PATH}/${id}/errorlog`,
      )
      return data
    } catch {
      return []
    }
  }

  public async getSignal(
    id: string,
    params: { from: string; to: string },
  ): Promise<HomeEnergyData | null> {
    try {
      const { data } = await this.#request<HomeEnergyData>(
        'get',
        `${SIGNAL_PATH}/${id}`,
        { params: { ...params, measure: 'rssi' } },
      )
      return data
    } catch {
      return null
    }
  }

  public async getTemperatures(
    id: string,
    params: { from: string; period: string; to: string },
  ): Promise<HomeReportData[] | null> {
    try {
      const { data } = await this.#request<HomeReportData[]>(
        'get',
        REPORT_PATH,
        { params: { ...params, unitId: id } },
      )
      return data
    } catch {
      return null
    }
  }

  /**
   * Fetch the current user's claims from the BFF.
   * Returns `null` if the request fails (401, network error, etc.)
   * and clears the stored user state.
   * @returns The user or `null`.
   */
  public async getUser(): Promise<HomeUser | null> {
    try {
      const { data } = await this.#request<HomeClaim[]>('get', USER_PATH, {
        params: { slide: false },
      })
      this.#user = parseClaims(data)
      const expiresIn = Number(getClaimValue(data, 'bff:session_expires_in'))
      if (expiresIn > 0) {
        this.expiry = new Date(
          Date.now() + expiresIn * MILLISECONDS_IN_SECOND,
        ).toISOString()
      }
      return this.#user
    } catch {
      this.#user = null
      return null
    }
  }

  public isAuthenticated(): boolean {
    return this.#user !== null
  }

  /**
   * Fetch all buildings (owned + guest), sync the device registry,
   * and schedule the next auto-sync.
   * @returns All buildings or an empty array on failure.
   */
  @syncDevices()
  public async list(): Promise<HomeBuilding[]> {
    this.#syncManager.clear()
    try {
      const { data } = await this.#request<HomeContext>('get', CONTEXT_PATH)
      this.#context = data
      const buildings = [...data.buildings, ...data.guestBuildings]
      this.#registry.sync(
        buildings.flatMap(({ airToAirUnits, airToWaterUnits }) => [
          ...airToAirUnits,
          ...airToWaterUnits,
        ]),
      )
      return buildings
    } catch {
      return []
    } finally {
      this.#syncManager.planNext()
    }
  }

  public clearSync(): void {
    this.#syncManager.clear()
  }

  public [Symbol.dispose](): void {
    this.#syncManager[Symbol.dispose]()
  }

  public setSyncInterval(minutes: number | null): void {
    this.#syncManager.setInterval(minutes)
  }

  public async setValues(id: string, values: HomeAtaValues): Promise<boolean> {
    try {
      await this.#request('put', `${ATA_UNIT_PATH}/${id}`, { data: values })
      await this.list()
      return true
    } catch {
      return false
    }
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
    return this.#request<T>('get', url, {
      maxRedirects: 0,
      validateStatus: acceptAnyStatus,
    })
  }

  async #handleResponse(response: AxiosResponse, url: string): Promise<void> {
    await storeCookies(this.#jar, response, url)
    this.logger.log(String(new APICallResponseData(response)))
  }

  #logError(error: unknown): void {
    if (axios.isAxiosError(error)) {
      this.logger.error(String(createAPICallErrorData(error)))
    }
  }

  /*
   * Re-authenticate if session expired. Skips absolute URLs (used in
   * the OIDC redirect chain) to avoid infinite re-auth loops, analogous
   * to the classic API skipping LOGIN_PATH in its request interceptor.
   */
  async #ensureSession(url: string): Promise<void> {
    if (
      !url.startsWith('http') &&
      this.expiry &&
      new Date(this.expiry) < new Date()
    ) {
      await this.authenticate()
    }
  }

  async #request<T = unknown>(
    method: string,
    url: string,
    {
      headers: configHeaders,
      ...config
    }: {
      [key: string]: unknown
      headers?: Record<string, string>
    } = {},
  ): Promise<AxiosResponse<T>> {
    await this.#ensureSession(url)
    /* v8 ignore next -- baseURL is always set via constructor config */
    const baseURL = this.#api.defaults.baseURL ?? ''
    const absoluteUrl = url.startsWith('http') ? url : `${baseURL}${url}`
    const cookieHeader = await this.#jar.getCookieString(absoluteUrl)
    try {
      const response = await this.#api.request<T>({
        ...config,
        headers: {
          ...configHeaders,
          ...(cookieHeader === '' ? {} : { Cookie: cookieHeader }),
        },
        method,
        url,
      })
      await this.#handleResponse(response, absoluteUrl)
      return response
    } catch (error) {
      this.#logError(error)
      throw error
    }
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
    const location = String(response.headers['location'] ?? '')
    return location === '' ? '' : resolveUrl(location, action)
  }
}
