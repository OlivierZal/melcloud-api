import type { HomeDevice } from '../entities/home-device.ts'
import { type HomeAtwZoneMode, HomeDeviceType } from '../constants.ts'
import { fetchDevices, setting, syncDevices } from '../decorators/index.ts'
import {
  type TypedHomeDeviceData,
  HomeRegistry,
} from '../entities/home-registry.ts'
import {
  AuthenticationThrottledError,
  EntityNotFoundError,
} from '../errors/index.ts'
import { HttpStatus, isHttpError } from '../http/index.ts'
import { isSessionExpired } from '../resilience/index.ts'
import { Temporal } from '../temporal.ts'
import { SESSION_REFRESH_AHEAD_MS } from '../time-units.ts'
import {
  type HomeAtaValues,
  type HomeAtwValues,
  type HomeBuilding,
  type HomeContext,
  type HomeDeviceValues,
  type HomeEnergyData,
  type HomeErrorLogEntry,
  type HomeFrostProtectionPostData,
  type HomeHolidayModePostData,
  type HomeOverheatProtectionPostData,
  type HomeReportData,
  type HomeTokenResponse,
  type HomeUser,
  type HomeUserContext,
  type LoginCredentials,
  type Result,
  err,
  ok,
} from '../types/index.ts'
import {
  HomeContextSchema,
  HomeEnergyDataSchema,
  HomeErrorLogEntryListSchema,
  HomeReportDataSchema,
  HomeResilientContextSchema,
  HomeUserContextSchema,
  parseOrThrow,
} from '../validation/index.ts'
import type { HomeAPIAdapter, HomeAPIConfig } from './home-types.ts'
import { BaseAPI, normalizeUnauthorized } from './base.ts'
import { performTokenAuth, refreshAccessToken } from './token-auth.ts'

const API_BASE_URL = 'https://mobile.bff.melcloudhome.com'
const ATA_UNIT_PATH = '/monitor/ataunit'
const ATW_UNIT_PATH = '/monitor/atwunit'
const CONTEXT_PATH = '/context'

const FROST_PROTECTION_PATH = '/monitor/protection/frost'
const HOLIDAY_MODE_PATH = '/monitor/holidaymode'
const OVERHEAT_PROTECTION_PATH = '/monitor/protection/overheat'

/**
 * Wire-facing ATW payload: zone modes lowered to the camelCase form the
 * PUT endpoint accepts.
 */
type HomeAtwWireValues = Omit<
  HomeAtwValues,
  'operationModeZone1' | 'operationModeZone2'
> & {
  readonly operationModeZone1?: string | null
  readonly operationModeZone2?: string | null
}

// The BFF reports zone modes in PascalCase but its PUT endpoint only
// accepts them in camelCase (a PascalCase value earns a bare 400) —
// live-probed against /monitor/atwunit.
const wireZoneModes: Record<HomeAtwZoneMode, string> = {
  curve: 'heatCurve',
  flow: 'heatFlowTemperature',
  flow_cool: 'coolFlowTemperature',
  room: 'heatRoomTemperature',
  room_cool: 'coolRoomTemperature',
}

// Only string values are lowered: an explicit null (clear) passes through
// untouched, and a present-but-undefined key (reachable from plain JS)
// keeps the absent-key semantics JSON serialization gives it.
// Plain-JS callers can bypass the union type; an unknown mode must fail
// loudly here rather than serialize as `undefined` and silently no-op.
const toWireZoneMode = (mode: HomeAtwZoneMode): string => {
  if (!Object.hasOwn(wireZoneModes, mode)) {
    throw new TypeError(`Unknown ATW zone mode: ${mode}`)
  }
  return wireZoneModes[mode]
}

const toAtwWireValues = (values: HomeAtwValues): HomeAtwWireValues => ({
  ...values,
  ...(typeof values.operationModeZone1 === 'string' && {
    operationModeZone1: toWireZoneMode(values.operationModeZone1),
  }),
  ...(typeof values.operationModeZone2 === 'string' && {
    operationModeZone2: toWireZoneMode(values.operationModeZone2),
  }),
})
const ATW_ENERGY_MEASURE = {
  consumed: 'interval_energy_consumed',
  produced: 'interval_energy_produced',
} as const

/**
 * Flatten a building's ATA + ATW units into typed registry entries,
 * tagging each with the caller-supplied ownership origin.
 * @param building - Source building from `/context`.
 * @param isOwner - `true` for a `buildings` entry, `false` for a guest one.
 * @returns Typed device entries ready for {@link HomeRegistry.sync}.
 */
const toTypedDevices = (
  building: HomeBuilding,
  isOwner: boolean,
): TypedHomeDeviceData[] => {
  const buildingRef = { id: building.id, name: building.name }
  return [
    ...building.airToAirUnits.map((device) => ({
      building: buildingRef,
      device,
      isOwner,
      type: HomeDeviceType.Ata,
    })),
    ...building.airToWaterUnits.map((device) => ({
      building: buildingRef,
      device,
      isOwner,
      type: HomeDeviceType.Atw,
    })),
  ]
}
const DEFAULT_RATE_LIMIT_FALLBACK_HOURS = 2
const DEFAULT_SYNC_INTERVAL_MINUTES = 1

const parseUser = (data: HomeUserContext): HomeUser => ({
  email: data.email,
  firstName: data.firstname,
  lastName: data.lastname,
  sub: data.id,
})

// Anchor on UTC so the host's local timezone cannot shift the
// formatted output: `offset: 'use'` keeps offset-bearing inputs
// (e.g. `'2026-03-01T10:00:00Z'`) at their absolute instant while
// offset-less inputs (e.g. `'2026-03-01'`) adopt UTC wall time.
const parseUTCPlainDateTime = (iso: string): Temporal.PlainDateTime =>
  Temporal.ZonedDateTime.from(`${iso}[UTC]`, {
    offset: 'use',
  }).toPlainDateTime()

// `/report/v1/trendsummary` expects .NET-style ISO with 7 subsecond zeros
// (e.g. `2026-04-19T00:00:00.0000000`). Anything shorter is silently
// truncated to an empty window by the BFF.
const toReportDate = (iso: string): string =>
  parseUTCPlainDateTime(iso)
    .round({ roundingMode: 'trunc', smallestUnit: 'second' })
    .toString({ fractionalSecondDigits: 7 })

// `/telemetry/telemetry/{energy,actual}` expect `YYYY-MM-DD HH:MM` with a
// space and no seconds. Seconds or an ISO `T` separator produce an empty
// payload rather than an error.
const toTelemetryDate = (iso: string): string =>
  parseUTCPlainDateTime(iso)
    .toString({ smallestUnit: 'minute' })
    .replace('T', ' ')

/**
 * MELCloud Home API client using the mobile BFF at
 * `mobile.bff.melcloudhome.com` with Bearer-token authentication.
 *
 * Authenticates via a headless OIDC flow:
 *   PAR → IdentityServer → AWS Cognito → token exchange.
 *
 * Access and refresh tokens are persisted through the SettingManager
 * (analogous to the Classic API's `contextKey`).
 *
 * Uses a private constructor — create instances via {@link HomeAPI.create}.
 * @category API Clients
 */
export class HomeAPI extends BaseAPI implements HomeAPIAdapter {
  /**
   * Latest `/context` payload from the BFF, or `null` before the
   * first successful call. Populated by {@link authenticate} and
   * {@link fetch}; cleared on session invalidation.
   * @returns The cached context, or `null`.
   */
  public get context(): HomeContext | null {
    return this.#context
  }

  /**
   * BCP-47 locale supplied via {@link HomeAPIConfig.locale}, or
   * `undefined` to fall back to the runtime locale. Drives chart label
   * formatting in the device facades.
   * @returns The configured BCP-47 locale tag, or `undefined`.
   */
  public get locale(): string | undefined {
    return this.#locale
  }

  /**
   * In-memory device registry populated by {@link fetch}.
   * @returns The registry instance.
   */
  public get registry(): HomeRegistry {
    return this.#registry
  }

  /**
   * IANA timezone supplied via {@link HomeAPIConfig.timezone},
   * or `undefined` to fall back to UTC. The Home wire itself speaks
   * UTC wall-clock; this timezone only anchors chart windows and
   * label rendering in the device facades.
   * @returns The configured IANA timezone identifier, or `undefined`.
   */
  public get timezone(): string | undefined {
    return this.#timezone
  }

  /**
   * Currently authenticated user, derived from the most recent
   * `/context` response. `null` when unauthenticated — and also when
   * the signed-in account has no home, which answers `404` and so
   * carries no identity to derive.
   * @returns The user, or `null`.
   */
  public get user(): HomeUser | null {
    return this.#user
  }

  #context: HomeContext | null = null

  // A `404` on `/context` is how the BFF answers an account that has no
  // MELCloud Home home: the token was accepted (a rejected one answers
  // `401`), so the session is valid and simply has nothing to describe.
  // Kept distinct from "not signed in" because the two demand opposite
  // handling — retrying a sign-in can never conjure a home, and looping
  // on it burns the login backoff and reports a session lost that never
  // was.
  #hasNoHome = false

  readonly #locale: string | undefined

  readonly #registry = new HomeRegistry()

  readonly #timezone: string | undefined

  #user: HomeUser | null = null

  @setting
  private accessor accessToken = ''

  @setting
  private accessor refreshToken = ''

  private constructor(config: HomeAPIConfig = {}) {
    const {
      baseURL = API_BASE_URL,
      locale,
      password,
      timezone,
      username,
    } = config
    super(config, {
      defaultSyncIntervalMinutes: DEFAULT_SYNC_INTERVAL_MINUTES,
      httpConfig: { baseURL },
      logLabel: '[Home]',
      rateLimitHours: DEFAULT_RATE_LIMIT_FALLBACK_HOURS,
      syncCallback: async () => this.fetch(),
    })
    this.#locale = locale
    this.#timezone = timezone
    this.applyCredentials(username, password)
  }

  /**
   * Create and initialize a MELCloud Home API instance.
   *
   * Delegates post-construction setup to {@link BaseAPI.initialize}
   * so the #1281-class invariant is enforced uniformly: the reuse
   * path, the fresh-auth path, and the "no credentials" path all go
   * through the same template and cannot leave the registry empty
   * while claiming success.
   * @param config - Optional configuration.
   * @returns The initialized HomeAPI instance.
   */
  public static async create(config?: HomeAPIConfig): Promise<HomeAPI> {
    const api = new HomeAPI(config)
    await api.start(config?.shouldResumeSessionInBackground === true)
    return api
  }

  /**
   * Fetch all buildings (owned + guest), sync the device registry,
   * and schedule the next auto-sync — the same heartbeat contract as
   * the Classic `fetch()`.
   * @returns All buildings or an empty array on failure.
   */
  @syncDevices()
  public async fetch(): Promise<HomeBuilding[]> {
    return this.runSyncCycle(async () => {
      const data = await this.#fetchContext()
      if (data === null) {
        // `#markNoHome` already emptied the registry, on whichever
        // entry point saw the 404.
        return []
      }
      this.#registry.syncDevices([
        // Guest entries first: the registry upsert is last-write-wins
        // per id, so a device duplicated across `buildings` and
        // `guestBuildings` keeps its owned tag.
        ...data.guestBuildings.flatMap((building) =>
          toTypedDevices(building, false),
        ),
        ...data.buildings.flatMap((building) => toTypedDevices(building, true)),
      ])
      return [...data.buildings, ...data.guestBuildings]
    })
  }

  /**
   * Batch frost-protection write for a set of devices (grouped by type in
   * `postData.units`), then refresh `/context`. One request scopes to a
   * single account's devices.
   * @param postData - Bounds, on/off flag, and target device ids.
   */
  @fetchDevices({ when: 'after' })
  public async updateFrostProtection(
    postData: HomeFrostProtectionPostData,
  ): Promise<void> {
    await this.requestData('post', FROST_PROTECTION_PATH, { data: postData })
  }

  /**
   * Batch holiday-mode write for a set of devices (grouped by type in
   * `postData.units`), then refresh `/context`. Mirror of
   * {@link updateFrostProtection}; only the window fields and path differ.
   * @param postData - Window bounds, on/off flag, and target device ids.
   */
  @fetchDevices({ when: 'after' })
  public async updateHolidayMode(
    postData: HomeHolidayModePostData,
  ): Promise<void> {
    await this.requestData('post', HOLIDAY_MODE_PATH, { data: postData })
  }

  /**
   * Batch overheat-protection write for a set of ATA devices, then
   * refresh `/context`. Mirror of {@link updateFrostProtection}; the
   * feature is ATA-only (live-captured 2026-07-27: the official app
   * posts `units.ATA` exclusively).
   * @param postData - Bounds, on/off flag, and target ATA device ids.
   */
  @fetchDevices({ when: 'after' })
  public async updateOverheatProtection(
    postData: HomeOverheatProtectionPostData,
  ): Promise<void> {
    await this.requestData('post', OVERHEAT_PROTECTION_PATH, { data: postData })
  }

  /**
   * Fetch the internal-temperatures report (flow/return/tank/zone)
   * for an ATW unit. Same {@link Result} contract as {@link getEnergy}.
   * @param id - Device id.
   * @param params - Query window.
   * @param params.from - ISO start timestamp (inclusive).
   * @param params.period - Aggregation period (e.g. `Daily`, `Hourly`).
   * @param params.to - ISO end timestamp (exclusive).
   * @returns Success with the report datasets, or a typed failure.
   */
  public async getAtwInternalTemperatures(
    id: string,
    params: { from: string; period: string; to: string },
  ): Promise<Result<HomeReportData[]>> {
    return this.#fetchReport('/report/v1/internaltemperatures', id, params)
  }

  /**
   * Fetch energy telemetry for a unit; the registry model's connection
   * type selects the measure family — ATA's single cumulative
   * consumption counter, or ATW's interval consumed/produced measures
   * (kWh per bucket, live-probed 2026-07-17). Returns a {@link Result}
   * so callers can branch on the failure class (`validation` for shape
   * drift, `server` for 4xx/5xx, `unauthorized` for token rejection,
   * `rate-limited`, `network`).
   * @param id - Device id.
   * @param params - Query window.
   * @param params.from - ISO start timestamp (inclusive).
   * @param params.interval - Aggregation interval (`Minute`, `Hour`, `Day`, `Week` or `Month`).
   * @param params.measure - Energy direction (`'consumed'` or
   * `'produced'`); ATW only, where it defaults to `'consumed'` — the
   * ATA counter is consumption by definition.
   * @param params.to - ISO end timestamp (exclusive).
   * A `measure` passed for an ATA id is ignored — the ATA counter is
   * consumption by definition. An id the registry does not hold folds
   * into the `not-found` Result variant (the Result contract never
   * throws for it — a cold open may query before the first fetch).
   * @returns Success with the telemetry bundle, or a typed failure.
   */
  public async getEnergy(
    id: string,
    params: {
      from: string
      interval: string
      to: string
      measure?: 'consumed' | 'produced'
    },
  ): Promise<Result<HomeEnergyData>> {
    const model = this.#modelResultFor(id)
    if (!model.ok) {
      return model
    }
    const { measure, ...window } = params
    return this.#fetchEnergy(id, {
      ...window,
      measure: model.value.isAta()
        ? 'cumulative_energy_consumed_since_last_upload'
        : ATW_ENERGY_MEASURE[measure ?? 'consumed'],
    })
  }

  /**
   * Fetch the error-log entries for a unit; the registry model's
   * connection type selects the unit path. Same {@link Result} contract
   * as {@link getEnergy}.
   * @param id - Device id.
   * An unknown id folds into the `not-found` Result variant.
   * @returns Success with the entries (possibly empty), or a typed failure.
   */
  public async getErrorLog(id: string): Promise<Result<HomeErrorLogEntry[]>> {
    const model = this.#modelResultFor(id)
    if (!model.ok) {
      return model
    }
    return this.#fetchErrorLog(
      model.value.isAta() ? ATA_UNIT_PATH : ATW_UNIT_PATH,
      id,
    )
  }

  /**
   * Fetch RSSI telemetry for a device (ATA or ATW). Same {@link Result}
   * contract as {@link getEnergy}.
   * @param id - Device id.
   * @param params - Query window.
   * @param params.from - ISO start timestamp (inclusive).
   * @param params.to - ISO end timestamp (exclusive).
   * @returns Success with the telemetry bundle, or a typed failure.
   */
  public async getSignal(
    id: string,
    params: { from: string; to: string },
  ): Promise<Result<HomeEnergyData>> {
    return this.safeRequest('get', `/telemetry/telemetry/actual/${id}`, {
      params: {
        from: toTelemetryDate(params.from),
        measure: 'rssi',
        to: toTelemetryDate(params.to),
      },
      schema: HomeEnergyDataSchema,
    })
  }

  /**
   * Fetch the temperature report for a unit; the registry model's
   * connection type selects the endpoint — ATA's trend summary or
   * ATW's comfort graph (outside / room / set temperature). Same
   * {@link Result} contract as {@link getEnergy}.
   * @param id - Device id.
   * @param params - Query window.
   * @param params.from - ISO start timestamp (inclusive).
   * @param params.period - Aggregation period (e.g. `hour`, `day`).
   * @param params.to - ISO end timestamp (exclusive).
   * An unknown id folds into the `not-found` Result variant.
   * @returns Success with the report datasets, or a typed failure.
   */
  public async getTemperatures(
    id: string,
    params: { from: string; period: string; to: string },
  ): Promise<Result<HomeReportData[]>> {
    const model = this.#modelResultFor(id)
    if (!model.ok) {
      return model
    }
    return this.#fetchReport(
      model.value.isAta()
        ? '/report/v1/trendsummary'
        : '/report/v1/comfort-graph',
      id,
      params,
    )
  }

  /**
   * Refresh the user by fetching the `/context` identity. On failure
   * the last known user is returned unchanged: transient failures and
   * device-payload drift must not read as "logged out" — the
   * reactive-401 path (`reauthenticate()`) is the single owner of
   * clearing the authentication state, so a definitive rejection has
   * already nulled the user by the time the failure surfaces here.
   * A `404` is the one answer that is neither: the account has no
   * home, so this settles the no-home state — `null` user, empty
   * registry — rather than returning the last known one.
   * @returns The user or `null`.
   */
  public async getUser(): Promise<HomeUser | null> {
    try {
      await this.#fetchContext()
    } catch {
      // Deliberately swallowed: the request pipeline logged the
      // failure and a real 401 has cleared the user state already.
      // `#markNoHome` is the other, non-401 clearer: an account with
      // no home has no identity to report, and answers `null` here
      // without the failure ever surfacing.
    }
    return this.#user
  }

  /**
   * Whether the session is usable: `true` once `/context` resolved a
   * user identity, and also for an account the BFF accepted but that
   * has no MELCloud Home home — there {@link user} and {@link context}
   * stay `null`, so an authenticated client is NOT a promise of an
   * identity.
   * @returns `true` while the session can serve requests.
   */
  public isAuthenticated(): boolean {
    return this.#user !== null || this.#hasNoHome
  }

  /**
   * Send a unit setpoint update to the BFF; the registry model's
   * connection type selects the wire path. On success, re-sync the
   * registry so it reflects the server-side effect of the write (the
   * PUT response itself does not echo device fields). On failure, the
   * typed transport error propagates and the sync is skipped — the
   * server state is presumed unchanged, so a re-fetch would be wasted
   * work. The mutation + post-sync orchestration lives in
   * `#putAtaAndSync`/`#putAtwAndSync`, where
   * `@fetchDevices({ when: 'after' })` applies the same
   * post-mutation-refresh contract as Classic facades — just resolved
   * via `syncRegistry()` instead of `api.fetch()`.
   * @param id - Target device id.
   * @param values - Partial setpoint payload matching the unit's
   * connection type — the shape is the caller's contract: the BFF
   * binder silently drops keys the routed unit does not know.
   * @throws EntityNotFoundError when the registry does not hold the id.
   */
  public async updateValues(
    id: string,
    values: HomeDeviceValues,
  ): Promise<void> {
    if (this.#modelFor(id).isAta()) {
      await this.putAtaAndSync(id, values)
      return
    }
    await this.putAtwAndSync(id, values)
  }

  protected override clearPersistedSession(): void {
    this.#user = null
    this.#hasNoHome = false
    // The context getter promises "cleared on session invalidation":
    // without this, a logged-out client keeps exposing the previous
    // account's buildings and devices.
    this.#context = null
    this.accessToken = ''
    this.refreshToken = ''
    this.expiry = ''
  }

  protected override clearRegistry(): void {
    this.#registry.syncDevices([])
  }

  protected override async doAuthenticate({
    password,
    username,
  }: LoginCredentials): Promise<void> {
    const request = {
      credentials: { password, username },
      ...(this.abortSignal !== undefined && { abortSignal: this.abortSignal }),
    }
    try {
      await this.#exchangeAndStoreTokens(request)
    } catch (error) {
      // Normalize transport-level `401 Unauthorized` from the BFF
      // into the shared {@link AuthenticationError} domain type so
      // callers of `authenticate()` get a stable error shape (mirror
      // of the Classic `LoginData: null → AuthenticationError` path).
      // Cognito refusals arrive already classified from token-auth;
      // the remaining non-401 errors (PAR failures, network timeouts)
      // propagate unchanged.
      if (
        isHttpError(error) &&
        error.response.status === HttpStatus.TooManyRequests
      ) {
        // The BFF/Cognito login throttle — the Home mirror of Classic's
        // ErrorId 6. Valid credentials, blocked endpoint: back off. The
        // 429 carries no window this layer reads, so the error announces
        // none and the caller keeps its own conservative pause.
        throw new AuthenticationThrottledError(
          'MELCloud Home is temporarily blocking sign-ins (too many attempts)',
        )
      }
      const authError = normalizeUnauthorized(error)
      if (authError !== null) {
        throw authError
      }
      throw error
    }
  }

  protected getAuthHeaders(): Record<string, string> {
    return this.accessToken === ''
      ? {}
      : { Authorization: `Bearer ${this.accessToken}` }
  }

  protected override hasPersistedSession(): boolean {
    return (
      (this.accessToken !== '' &&
        this.expiry !== '' &&
        !isSessionExpired(this.expiry)) ||
      this.refreshToken !== ''
    )
  }

  // The `/context` `404` is this account's normal answer (see
  // `#requestContext`), so the request pipeline must not file it as an
  // API failure on every poll. Any other failure, including a `404`
  // from any other endpoint, logs as before.
  protected override logError(error: unknown): void {
    if (
      isHttpError(error) &&
      error.response.status === HttpStatus.NotFound &&
      error.config?.url === CONTEXT_PATH
    ) {
      return
    }
    super.logError(error)
  }

  /**
   * Home considers a session in need of refresh when the access
   * token is within {@link SESSION_REFRESH_AHEAD_MS} of its real
   * expiry. The forward window lets the shared `BaseAPI.ensureSession`
   * template renew the token pre-emptively via
   * {@link performSessionRefresh}, keeping the OIDC round-trip off
   * the request's critical path.
   * @returns `true` when a refresh should run before the next request.
   */
  protected override needsSessionRefresh(): boolean {
    return isSessionExpired(this.expiry, SESSION_REFRESH_AHEAD_MS)
  }

  /**
   * Home session refresh = try the cheap refresh-token exchange
   * first; if the refresh token is rejected (or missing), fall
   * through to a full {@link resumeSession} (re-auth from persisted
   * username/password). `resumeSession` logs + swallows on failure;
   * the 401 retry path on the triggering request handles hard errors.
   */
  protected override async performSessionRefresh(): Promise<void> {
    if (this.refreshToken !== '' && (await this.#refreshAccessToken())) {
      return
    }
    await this.resumeSession()
  }

  /**
   * Reactive-401 refresh for Home. The access token was just
   * rejected, so we clear it before trying recovery: first the
   * cheap refresh-token exchange, then a full {@link resumeSession}
   * as fallback. The shared {@link AuthRetryPolicy} replays the
   * original request on success.
   * @returns `true` when the instance is authenticated afterwards.
   */
  protected override async reauthenticate(): Promise<boolean> {
    if (this.refreshToken !== '' && (await this.#refreshAccessToken())) {
      return true
    }
    this.clearPersistedSession()
    return this.resumeSession()
  }

  /**
   * The base probe's `syncRegistry()` runs `fetch()`, which hits
   * `/context` once and hydrates `context`/`user` AND the device
   * registry in a single request; an expired token triggers the
   * pipeline's 401-retry + refresh-token flow along the way. Success
   * requires a parsed context on top of the identity: a `true` reuse
   * promises a verified registry, so an identity-only round-trip
   * (the salvage parse failed) must fall through to the full-auth
   * path instead of claiming the reuse completed. An account with no
   * home reuses too: its session is valid, there is simply nothing to
   * verify against.
   * @returns `true` when persisted tokens verified against the BFF.
   */
  protected override reuseSucceeded(): boolean {
    return this.#hasNoHome || (this.isAuthenticated() && this.context !== null)
  }

  protected override async syncRegistry(): Promise<void> {
    await this.fetch()
  }

  /**
   * Core of {@link updateValues}: perform the PUT and, on success,
   * trigger a post-mutation registry refresh via
   * `@fetchDevices({ when: 'after' })`. Throws on PUT failure so the
   * decorator skips the sync (failed mutation → server state
   * unchanged → re-fetch wasted). Sync failures after a successful
   * PUT are logged and swallowed by the decorator itself, preserving
   * the "mutation landed" truth even when the post-refresh flakes.
   * @param id - Target device id.
   * @param values - Partial setpoint payload.
   */
  @fetchDevices({ when: 'after' })
  private async putAtaAndSync(
    id: string,
    values: HomeAtaValues,
  ): Promise<void> {
    await this.#putDeviceValues(ATA_UNIT_PATH, id, values)
  }

  /**
   * ATW counterpart to {@link putAtaAndSync}. Same post-mutation-refresh
   * contract; only the URL prefix and payload type differ.
   * @param id - Target device id.
   * @param values - Partial setpoint payload.
   */
  @fetchDevices({ when: 'after' })
  private async putAtwAndSync(
    id: string,
    values: HomeAtwValues,
  ): Promise<void> {
    await this.#putDeviceValues(ATW_UNIT_PATH, id, toAtwWireValues(values))
  }

  async #exchangeAndStoreTokens(
    request: Parameters<typeof performTokenAuth>[0],
  ): Promise<void> {
    const tokens = await performTokenAuth(request)
    // Wholesale session replacement (the `doAuthenticate` contract):
    // wipe before storing so nothing from a previous account survives —
    // the stale context/user, or a refresh token `#storeTokens` keeps
    // when the response omits one. The refresh path must NOT wipe: a
    // renewal extends the same session.
    this.clearPersistedSession()
    this.#storeTokens(tokens)
  }

  /**
   * Fetch the user context from the BFF and update local state.
   * Shared by `getUser()` and `list()`.
   *
   * Two-stage parse: the identity slice is validated first, so any
   * successful `/context` round-trip marks the session authenticated —
   * device-payload drift must degrade the registry, never the
   * authentication state (a strict-only parse used to read as
   * "unauthenticated" and re-open the settings login form). The full
   * payload is then parsed strictly; on drift the failure is logged
   * with its field paths and the salvage schema recovers everything
   * that still validates per unit.
   * @returns The fetched home context.
   */
  async #fetchContext(): Promise<HomeContext | null> {
    const raw = await this.#requestContext()
    if (raw === null) {
      return null
    }
    this.#user = parseUser(
      parseOrThrow(HomeUserContextSchema, raw, 'GET /context'),
    )
    const strict = HomeContextSchema.safeParse(raw)
    if (!strict.success) {
      this.logger.error(
        'Home context drifted from the strict schema; salvaging device entries:',
        strict.error,
      )
    }
    const data = strict.success
      ? strict.data
      : parseOrThrow(HomeResilientContextSchema, raw, 'GET /context (salvage)')
    this.#context = data
    return data
  }

  /**
   * Issue an energy-telemetry GET to the BFF. The two public energy
   * variants (ATA cumulative, ATW interval consumed/produced) only
   * differ in their `measure` query parameter; this helper centralises
   * the URL, date-format normalisation, and schema binding.
   * @param id - Device id.
   * @param params - Query window plus the resolved BFF measure name.
   * @param params.from - ISO start timestamp (inclusive).
   * @param params.interval - Aggregation interval (e.g. `Hour`, `Day`).
   * @param params.measure - Resolved BFF measure name (e.g. `interval_energy_consumed`).
   * @param params.to - ISO end timestamp (exclusive).
   * @returns Success with the telemetry bundle, or a typed failure.
   */
  async #fetchEnergy(
    id: string,
    params: { from: string; interval: string; measure: string; to: string },
  ): Promise<Result<HomeEnergyData>> {
    return this.safeRequest('get', `/telemetry/telemetry/energy/${id}`, {
      params: {
        from: toTelemetryDate(params.from),
        interval: params.interval,
        measure: params.measure,
        to: toTelemetryDate(params.to),
      },
      schema: HomeEnergyDataSchema,
    })
  }

  /**
   * Issue an error-log GET against either the ATA or ATW unit path.
   * Both endpoints share the response schema; only the URL prefix
   * differs.
   * @param unitPath - URL prefix (`/monitor/ataunit` or `/monitor/atwunit`).
   * @param id - Device id.
   * @returns Success with the entries (possibly empty), or a typed failure.
   */
  async #fetchErrorLog(
    unitPath: string,
    id: string,
  ): Promise<Result<HomeErrorLogEntry[]>> {
    return this.safeRequest('get', `${unitPath}/${id}/errorlog`, {
      schema: HomeErrorLogEntryListSchema,
    })
  }

  /**
   * Issue a report GET (`trendsummary`, `comfort-graph`, or
   * `internaltemperatures`) — all three endpoints accept the same
   * `unitId` + `from`/`period`/`to` query shape and return the same
   * dataset envelope.
   * @param path - Report endpoint URL.
   * @param id - Device id (sent as `unitId`).
   * @param params - Query window.
   * @param params.from - ISO start timestamp (inclusive).
   * @param params.period - Aggregation period (e.g. `Daily`, `Hourly`).
   * @param params.to - ISO end timestamp (exclusive).
   * @returns Success with the report datasets, or a typed failure.
   */
  async #fetchReport(
    path: string,
    id: string,
    params: { from: string; period: string; to: string },
  ): Promise<Result<HomeReportData[]>> {
    return this.safeRequest('get', path, {
      params: {
        from: toReportDate(params.from),
        period: params.period,
        to: toReportDate(params.to),
        unitId: id,
      },
      schema: HomeReportDataSchema.array(),
    })
  }

  // The state an account with no home settles into: no identity, no
  // context, and the marker up — so the session reads valid and nothing
  // ever tries to sign in again on its behalf.
  #markNoHome(): void {
    const wasKnown = this.#hasNoHome
    this.#user = null
    this.#context = null
    this.#hasNoHome = true
    // Emptied here rather than at one call site, so the state is the
    // same whichever entry point observed the `404`.
    this.#registry.syncDevices([])
    // Once per episode, not once per sync cycle: the timer keeps
    // polling so a home created later is picked up, and a settled
    // state must not read as a minute-by-minute alarm.
    if (!wasKnown) {
      this.logger.log(
        'This account has no MELCloud Home home: signed in, nothing to sync',
      )
    }
  }

  // Per-unit endpoints differ by connection type; the registry is the
  // routing truth for an id the caller addresses blindly.
  #modelFor(id: string): HomeDevice {
    const model = this.#registry.getById(id)
    if (model === undefined) {
      throw new EntityNotFoundError('Device', { entityId: id })
    }
    return model
  }

  // Non-throwing twin of `#modelFor` for the Result-returning read
  // paths: an unknown id folds into the `not-found` variant.
  #modelResultFor(id: string): Result<HomeDevice> {
    const model = this.#registry.getById(id)
    return model === undefined
      ? err({ entityId: id, kind: 'not-found' })
      : ok(model)
  }

  /**
   * Issue a device-values PUT. Centralises the URL shape (`{unitPath}/{id}`)
   * shared by the ATA and ATW mutation paths.
   * @param unitPath - URL prefix (`/monitor/ataunit` or `/monitor/atwunit`).
   * @param id - Target device id.
   * @param values - Partial setpoint payload.
   */
  async #putDeviceValues(
    unitPath: string,
    id: string,
    values: HomeAtaValues | HomeAtwWireValues,
  ): Promise<void> {
    await this.request('put', `${unitPath}/${id}`, { data: values })
  }

  /**
   * Use the refresh token to obtain a fresh access token.
   * @returns Whether the refresh succeeded.
   */
  async #refreshAccessToken(): Promise<boolean> {
    const tokens = await refreshAccessToken({
      logger: this.logger,
      refreshToken: this.refreshToken,
      ...(this.abortSignal !== undefined && { abortSignal: this.abortSignal }),
    })
    if (tokens === null) {
      return false
    }
    this.#storeTokens(tokens)
    return true
  }

  // Sole owner of the no-home marker, in both directions: a `404` raises
  // it, any answer at all clears it. Answers `null` for that one failure
  // which is not a failure — an account with no home. Every other status
  // propagates, so a real transport or authorization problem still
  // reaches the retry and sign-in paths untouched.
  async #requestContext(): Promise<unknown> {
    try {
      const raw = await this.requestData('get', CONTEXT_PATH)
      this.#hasNoHome = false
      return raw
    } catch (error) {
      if (
        !isHttpError(error) ||
        error.response.status !== HttpStatus.NotFound
      ) {
        throw error
      }
      this.#markNoHome()
      return null
    }
  }

  #storeTokens({
    access_token: accessToken,
    expires_in: expiresIn,
    refresh_token: refreshToken,
  }: HomeTokenResponse): void {
    this.accessToken = accessToken
    if (refreshToken !== undefined && refreshToken !== '') {
      this.refreshToken = refreshToken
    }
    this.expiry = Temporal.Now.instant().add({ seconds: expiresIn }).toString()
  }
}
