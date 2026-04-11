import { randomUUID } from 'node:crypto'

import { CookieJar } from 'tough-cookie'
import axios, {
  type AxiosInstance,
  type AxiosResponse,
  HttpStatusCode,
} from 'axios'

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
import { HomeDeviceType } from '../constants.ts'
import { authenticate, setting, syncDevices } from '../decorators/index.ts'
import { HomeRegistry } from '../models/home-registry.ts'
import {
  APICallRequestData,
  APICallResponseData,
  createAPICallErrorData,
  RequestLifecycleEmitter,
} from '../observability/index.ts'
import {
  DEFAULT_TRANSIENT_RETRY_OPTIONS,
  isSessionExpired,
  isTransientServerError,
  RateLimitError,
  RateLimitGate,
  RetryGuard,
  withRetryBackoff,
} from '../resilience/index.ts'
import type {
  HomeAPIConfig,
  HomeAPI as HomeAPIContract,
  Logger,
  OnSyncFunction,
  SettingManager,
} from './interfaces.ts'
import { SyncManager } from './sync-manager.ts'

const COGNITO_AUTHORITY =
  'https://live-melcloudhome.auth.eu-west-1.amazoncognito.com'

const API_BASE_URL = 'https://melcloudhome.com'
const ATA_UNIT_PATH = '/api/ataunit'
const CONTEXT_PATH = '/api/user/context'
const DEFAULT_RATE_LIMIT_FALLBACK_HOURS = 2
const DEFAULT_TIMEOUT_MS = 30_000
const ENERGY_PATH = '/api/telemetry/energy'
const LOGIN_PATH = '/bff/login'
const MILLISECONDS_IN_SECOND = 1000
const REPORT_PATH = '/api/v1/report/trendsummary'
const RETRY_DELAY = 1000
const SIGNAL_PATH = '/api/telemetry/actual'
const MAX_REDIRECTS = 20
const USER_PATH = '/bff/user'

const HTTP_REDIRECT_MIN = 300
const HTTP_REDIRECT_MAX = 400

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

/*
 * Auth-related endpoints that must bypass both proactive reauth
 * (#ensureSession) and reactive 401 retry (#shouldRetryAuth):
 *  - LOGIN_PATH and USER_PATH are the entry points of the OIDC flow
 *    themselves and what refreshes `expiry` — triggering reauth on
 *    them would recurse infinitely.
 *  - Absolute URLs belong to the cross-domain redirect chain and
 *    are only reachable from within `#performOidcLogin`.
 */
const isAuthExempt = (url: string): boolean =>
  url.startsWith('http') || url === LOGIN_PATH || url === USER_PATH

const storeCookies = async (
  jar: CookieJar,
  { headers }: AxiosResponse,
  url: string,
): Promise<boolean> => {
  const { 'set-cookie': setCookies } = headers as { 'set-cookie'?: string[] }
  if (!Array.isArray(setCookies)) {
    return false
  }
  let hasStored = false
  await Promise.all(
    setCookies.map(async (raw: string) => {
      try {
        await jar.setCookie(raw, url)
        hasStored = true
      } catch {
        // Ignore invalid Set-Cookie values
      }
    }),
  )
  return hasStored
}

/**
 * MELCloud Home API client. Authenticates via headless OIDC login through
 * a double-federated flow: BFF → IdentityServer → AWS Cognito.
 *
 * Cookies are managed manually (not via axios-cookiejar-support) because the
 * cross-domain redirect chain requires Set-Cookie headers to be captured at
 * each intermediate 302 response.
 *
 * Uses a private constructor — create instances via {@link HomeAPI.create}.
 */
export class HomeAPI implements Disposable, HomeAPIContract {
  public readonly logger: Logger

  public readonly onSync?: OnSyncFunction

  public readonly settingManager?: SettingManager

  public get context(): HomeContext | null {
    return this.#context
  }

  public get registry(): HomeRegistry {
    return this.#registry
  }

  public get user(): HomeUser | null {
    return this.#user
  }

  readonly #api: AxiosInstance

  readonly #baseURL: string

  #context: HomeContext | null = null

  readonly #events: RequestLifecycleEmitter

  readonly #jar: CookieJar

  readonly #rateLimitGate = new RateLimitGate({
    hours: DEFAULT_RATE_LIMIT_FALLBACK_HOURS,
  })

  readonly #registry = new HomeRegistry()

  readonly #retryGuard = new RetryGuard(RETRY_DELAY)

  readonly #syncManager: SyncManager

  #user: HomeUser | null = null

  @setting
  private accessor cookies = ''

  @setting
  private accessor expiry = ''

  @setting
  private accessor password = ''

  @setting
  private accessor username = ''

  private constructor(config: HomeAPIConfig = {}) {
    const {
      autoSyncInterval = 1,
      baseURL = API_BASE_URL,
      events,
      logger = console,
      onSync,
      password,
      requestTimeout = DEFAULT_TIMEOUT_MS,
      settingManager,
      username,
    } = config
    this.logger = logger
    this.onSync = onSync
    this.settingManager = settingManager
    this.#events = new RequestLifecycleEmitter(events, logger)
    this.#jar = this.#loadJar()
    this.#applyCredentials(username, password)
    this.#baseURL = baseURL
    this.#api = axios.create({
      baseURL,
      headers: { 'x-csrf': '1' },
      timeout: requestTimeout,
    })
    this.#syncManager = new SyncManager(
      async () => this.list(),
      logger,
      autoSyncInterval,
    )
  }

  /**
   * Create and initialize a MELCloud Home API instance.
   *
   * If the SettingManager holds a persisted session (cookies + unexpired
   * expiry), the instance reuses it via `getUser()` and skips the OIDC
   * re-login entirely. Otherwise, or if the persisted session is rejected
   * by the server, falls back to a full `authenticate()` flow.
   * @param config - Optional configuration.
   * @returns The initialized HomeAPI instance.
   */
  public static async create(config?: HomeAPIConfig): Promise<HomeAPI> {
    const api = new HomeAPI(config)
    if (api.#hasPersistedSession()) {
      if ((await api.getUser()) !== null) {
        return api
      }
      /*
       * Persisted session was rejected (401, network error, stale cookies):
       * wipe it before falling back to a full OIDC login so a subsequent
       * authenticate() short-circuit (missing credentials) doesn't leave
       * the dead session in the SettingManager and loop forever on reboots.
       */
      api.#clearPersistedSession()
    }
    await api.authenticate()
    return api
  }

  @authenticate
  public async authenticate(data?: LoginCredentials): Promise<boolean> {
    /* v8 ignore next -- @authenticate guarantees data is always provided */
    const { password, username } = data ?? { password: '', username: '' }
    this.#clearPersistedSession()
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
    return this.#safeRequest<HomeEnergyData>(`${ENERGY_PATH}/${id}`, {
      params: {
        ...params,
        measure: 'cumulative_energy_consumed_since_last_upload',
      },
    })
  }

  public async getErrorLog(id: string): Promise<HomeErrorLogEntry[]> {
    return (
      (await this.#safeRequest<HomeErrorLogEntry[]>(
        `${ATA_UNIT_PATH}/${id}/errorlog`,
      )) ?? []
    )
  }

  public async getSignal(
    id: string,
    params: { from: string; to: string },
  ): Promise<HomeEnergyData | null> {
    return this.#safeRequest<HomeEnergyData>(`${SIGNAL_PATH}/${id}`, {
      params: { ...params, measure: 'rssi' },
    })
  }

  public async getTemperatures(
    id: string,
    params: { from: string; period: string; to: string },
  ): Promise<HomeReportData[] | null> {
    return this.#safeRequest<HomeReportData[]>(REPORT_PATH, {
      params: { ...params, unitId: id },
    })
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
   * Whether the upstream rate-limit gate is currently closed.
   *
   * A `true` value means the SDK recently observed a 429 Too Many
   * Requests response and is intentionally failing subsequent requests
   * fast to honor the upstream `Retry-After` window. Consumers can
   * poll this to display a "throttled, please wait" indicator without
   * catching {@link RateLimitError} through the full call stack.
   * @returns `true` while the gate is holding a pause window.
   */
  public get isRateLimited(): boolean {
    return this.#rateLimitGate.isPaused
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
          ...airToAirUnits.map((device) => ({
            device,
            type: HomeDeviceType.Ata,
          })),
          ...airToWaterUnits.map((device) => ({
            device,
            type: HomeDeviceType.Atw,
          })),
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
    this.#retryGuard[Symbol.dispose]()
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

  #applyCredentials(username?: string, password?: string): void {
    if (username !== undefined) {
      this.username = username
    }
    if (password !== undefined) {
      this.password = password
    }
  }

  #clearPersistedSession(): void {
    this.#user = null
    this.expiry = ''
    this.cookies = ''
    this.#jar.removeAllCookiesSync()
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
      /* v8 ignore next -- callback executed inside axios, not traceable */
      validateStatus: () => true,
    })
  }

  #hasPersistedSession(): boolean {
    return (
      this.cookies !== '' &&
      this.expiry !== '' &&
      !isSessionExpired(this.expiry)
    )
  }

  #loadJar(): CookieJar {
    if (!this.cookies) {
      return new CookieJar()
    }
    try {
      return CookieJar.deserializeSync(this.cookies)
    } catch {
      /*
       * Self-heal: drop the corrupted value so we don't retry parsing it on
       * every subsequent boot. The jar is currently being constructed, so
       * clearing via the @setting accessors (not #clearPersistedSession())
       * is required — we must not touch this.#jar from here.
       */
      this.cookies = ''
      this.expiry = ''
      return new CookieJar()
    }
  }

  #logError(error: unknown): void {
    if (axios.isAxiosError(error)) {
      this.logger.error(String(createAPICallErrorData(error)))
    }
  }

  async #onResponse(response: AxiosResponse, url: string): Promise<void> {
    if (await storeCookies(this.#jar, response, url)) {
      this.#persistJar()
    }
    this.logger.log(String(new APICallResponseData(response)))
  }

  #persistJar(): void {
    const serialized = this.#jar.serializeSync()
    /* v8 ignore next -- default MemoryCookieStore always returns a value */
    this.cookies = serialized ? JSON.stringify(serialized) : ''
  }

  /*
   * Send a single request through the shared axios instance, injecting any
   * cookies applicable to the target URL and passing the response through
   * `#onResponse()` for cookie capture and logging. Each request is logged
   * symmetrically with `#onResponse` so a full request → response trace
   * is available in the logger output, matching Classic's interceptor pattern.
   */
  async #dispatch<T = unknown>(
    method: string,
    url: string,
    {
      headers: configHeaders,
      ...config
    }: {
      [key: string]: unknown
      headers?: Record<string, string>
    },
  ): Promise<AxiosResponse<T>> {
    const absoluteUrl = url.startsWith('http') ? url : `${this.#baseURL}${url}`
    const cookieHeader = await this.#jar.getCookieString(absoluteUrl)
    const requestConfig = {
      ...config,
      headers: {
        ...configHeaders,
        ...(cookieHeader === '' ? {} : { Cookie: cookieHeader }),
      },
      method,
      url,
    }
    this.logger.log(String(new APICallRequestData(requestConfig)))
    const response = await this.#api.request<T>(requestConfig)
    await this.#onResponse(response, absoluteUrl)
    return response
  }

  /*
   * Re-authenticate if the session is expired or the persisted expiry
   * value is malformed. Skips auth-exempt URLs (OIDC chain, LOGIN_PATH,
   * USER_PATH) to avoid infinite re-auth loops, analogous to the Classic
   * API skipping LOGIN_PATH in its request interceptor.
   */
  async #ensureSession(url: string): Promise<void> {
    if (!isAuthExempt(url) && isSessionExpired(this.expiry)) {
      await this.authenticate()
    }
  }

  #makeRequestAttempt<T>(
    method: string,
    url: string,
    config: { [key: string]: unknown; headers?: Record<string, string> },
  ): () => Promise<AxiosResponse<T>> {
    return async () => {
      try {
        return await this.#dispatch<T>(method, url, config)
      } catch (error) {
        this.#logError(error)
        this.#recordRateLimitIfApplicable(error)
        if (this.#shouldRetryAuth(error, url)) {
          this.#clearPersistedSession()
          if (await this.authenticate()) {
            return this.#dispatch<T>(method, url, config)
          }
        }
        throw error
      }
    }
  }

  #recordRateLimitIfApplicable(error: unknown): void {
    if (!axios.isAxiosError(error)) {
      return
    }
    if (error.response?.status !== HttpStatusCode.TooManyRequests) {
      return
    }
    this.#rateLimitGate.recordAndLog(
      this.logger,
      (error.response.headers as Record<string, unknown>)['retry-after'],
    )
  }

  async #request<T = unknown>(
    method: string,
    url: string,
    config: {
      [key: string]: unknown
      headers?: Record<string, string>
    } = {},
  ): Promise<AxiosResponse<T>> {
    await this.#ensureSession(url)
    this.#throwIfRateLimited(url)
    const context = {
      correlationId: randomUUID(),
      method: method.toUpperCase(),
      url,
    }
    const attempt = this.#makeRequestAttempt<T>(method, url, config)
    /*
     * 5xx retry with exponential backoff, applied only to idempotent
     * GET requests. POST is intentionally excluded: replaying a failed
     * credential submit or state mutation is not safe. OIDC GET steps
     * (cross-domain, LOGIN_PATH, USER_PATH) ARE retried — the original
     * user-reported outage was a 503 on /bff/login.
     */
    const runner =
      method.toUpperCase() === 'GET' ?
        async (): Promise<AxiosResponse<T>> =>
          withRetryBackoff(attempt, {
            ...DEFAULT_TRANSIENT_RETRY_OPTIONS,
            isRetryable: isTransientServerError,
            onRetry: (retryAttempt, error, delayMs) => {
              this.logger.log(
                `Transient server error on ${url}: retry ${String(retryAttempt)} in ${String(delayMs)} ms`,
              )
              this.#events.emitRetry({
                ...context,
                attempt: retryAttempt,
                delayMs,
                error,
              })
            },
          })
      : attempt
    return this.#runWithEvents(context, runner)
  }

  async #runWithEvents<T>(
    context: { correlationId: string; method: string; url: string },
    runner: () => Promise<AxiosResponse<T>>,
  ): Promise<AxiosResponse<T>> {
    const startedAt = Date.now()
    this.#events.emitStart(context)
    try {
      const response = await runner()
      this.#events.emitComplete({
        ...context,
        durationMs: Date.now() - startedAt,
        status: response.status,
      })
      return response
    } catch (error) {
      this.#events.emitError({
        ...context,
        durationMs: Date.now() - startedAt,
        error,
      })
      throw error
    }
  }

  async #safeRequest<T>(
    url: string,
    config?: Record<string, unknown>,
  ): Promise<T | null> {
    try {
      const { data } = await this.#request<T>('get', url, config)
      return data
    } catch {
      return null
    }
  }

  #shouldRetryAuth(error: unknown, url: string): boolean {
    if (!axios.isAxiosError(error)) {
      return false
    }
    if (error.response?.status !== HttpStatusCode.Unauthorized) {
      return false
    }
    if (isAuthExempt(url)) {
      return false
    }
    return this.#retryGuard.tryConsume()
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

  #throwIfRateLimited(url: string): void {
    if (isAuthExempt(url) || !this.#rateLimitGate.isPaused) {
      return
    }
    throw new RateLimitError(
      `API requests are on hold for ${this.#rateLimitGate.formatRemaining()} (upstream rate-limited)`,
      { retryAfter: this.#rateLimitGate.remaining },
    )
  }
}
