import { HttpClient as CoreHttpClient } from '@olivierzal/api-core'
import {
  type MockInstance,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest'

import type { BaseAPI } from '../../src/api/base.ts'
import type {
  BaseAPIConfig,
  LifecycleEvents,
  SettingManager,
  SyncCallback,
} from '../../src/api/types.ts'
import type { HttpResponse } from '../../src/http/index.ts'
import { ClassicAPI } from '../../src/api/classic.ts'
import { HomeAPI } from '../../src/api/home.ts'
import { AuthenticationError } from '../../src/errors/index.ts'
import { RetryGuard } from '../../src/resilience/index.ts'
import { Temporal } from '../../src/temporal.ts'
import {
  CLASSIC_LIST_PATH,
  CLASSIC_LOGIN_PATH,
  classicBuildingWithStructure,
  classicLoginResponse,
  classicRawDevice,
  stageClassicWire,
} from '../classic-fixtures.ts'
import {
  createHttpError,
  createLogger,
  createMockHttpClient,
  createServerError,
  createSettingStore,
  createUnauthorizedError,
  mockResponse,
  mockTemporalNowInstant,
} from '../helpers.ts'
import {
  homeContextData,
  stageHomeOidcDance,
  stageHomeTokenExchange,
} from '../home-fixtures.ts'

// The session lifecycle and the request pipeline of `src/api/base.ts`,
// pinned against BOTH real dialect legs rather than a synthetic
// subclass. `base-api.test.ts` exercises the same template through a
// `TestAPI` whose hooks are `vi.fn`s — invaluable for branch coverage,
// useless as an extraction witness: it proves the template calls its
// own hooks, not that ClassicAPI and HomeAPI still behave the same
// once the template moves into `@olivierzal/api-core`. This kernel is
// that witness, so it must stay byte-identical across the move.
//
// PORTABILITY PRECONDITION — the kernel STAYS while the mechanism
// leaves, so it can only cross byte-identical while `src/api/base.ts`
// and `src/api/types.ts` SURVIVE as thin re-export shims over
// `@olivierzal/api-core` (the shape `src/http/`, `src/resilience/` and
// `src/observability/` already took). Every import above resolves
// through this repo's own paths; deleting either module in favour of a
// direct `@olivierzal/api-core` import would force an edit here, and an
// edited witness proves nothing about the move it was meant to witness.
// The one deliberate exception is the core `HttpClient` imported above:
// it is the FOREIGN class the transport-resolution clause needs, and
// naming it here is the point of that clause.
//
// Every clause is worded about THE REGISTRY CYCLE — the bulk sync
// (`/User/ListDevices` on Classic, `/context` on Home) that
// `runSyncCycle` wraps. The per-device merge (`@classicUpdateDevice`,
// `getValues`) never enters `runSyncCycle` and is out of scope here.

const CLASSIC_BASE_URL = 'https://app.melcloud.com/Mitsubishi.Wifi.Client'
const HOME_BASE_URL = 'https://melcloudhome.com'
const HOME_CONTEXT_PATH = '/context'
const HOME_PAR_PATH = '/connect/par'
const HOME_TOKEN_PATH = '/connect/token'

const OK_STATUS = 200
const THROTTLED_STATUS = 429
const UNAVAILABLE_STATUS = 503

const CONCURRENT_CALLERS = 4
const ONE_HOUR_MS = 3_600_000
const SYNC_INTERVAL_MINUTES = 1
const SYNC_TICK_MS = 90_000
const TRANSIENT_RETRY_WINDOW_MS = 30_000

// Straddling a deadline: one tick short of it, then one tick past it.
const CLOCK_EPSILON_MS = 1

// The window a 429 announces through `Retry-After`, in the header's own
// delta-seconds spelling and in milliseconds. Two minutes — far under
// either dialect's fallback window, so a gate that reopens on it read
// the header instead of falling back.
const RETRY_AFTER_SECONDS = '120'
const RETRY_AFTER_MS = 120_000

// `LOGIN_BACKOFF_THROTTLE_MS` (base.ts:126): the pause a throttled
// sign-in earns when the server announced no window — and the cap on
// the one it did announce.
const THROTTLE_FALLBACK_MS = 7_200_000

// Windows a dialect that announces one can put on the wire: one the
// backoff must honour verbatim, and one it must refuse to honour.
const ANNOUNCED_THROTTLE_MINUTES = 60
const ANNOUNCED_THROTTLE_MS = 3_600_000
const ABSURD_THROTTLE_MINUTES = 2880

// `LOGIN_THROTTLE_ERROR_ID` (classic.ts:80) — MELCloud Classic's login
// throttle, reported inside an HTTP 200 like every other Classic
// refusal.
const CLASSIC_THROTTLE_ERROR_ID = 6

// The marker a refused registry cycle carries. Deliberately an
// `AuthenticationError`: the login backoff must key off the SIGN-IN
// round-trip, never off what the post-auth cycle happened to throw.
const REGISTRY_REFUSED = 'registry cycle refused'

// A sign-in no scenario staged. Loud on purpose — a clause that signs
// in without saying so is a clause that pins the wrong thing.
const UNEXPECTED_SIGN_IN = 'unexpected sign-in'

// A host logger that throws while reporting a failure — the only crack
// through which a best-effort registry cycle can reject its caller.
const REPORTER_REFUSED = 'diagnostic sink refused'

const CREDENTIALS = { password: 'pass', username: 'user@test.com' }

// The keys `BaseAPI` itself persists; each dialect adds its own
// session material on top (see `SessionLifecycleDriver.sessionKeys`).
const BASE_PERSISTED_KEYS = [
  'expiry',
  'loginBackoffUntil',
  'password',
  'username',
]

/**
 * What the sign-in round-trip answers. `throttle` is the login-throttle
 * refusal both dialects raise as `AuthenticationThrottledError`;
 * `unreachable` is the transport blip that must NOT be read as one.
 */
type LoginOutcome = 'accept' | 'refuse' | 'throttle' | 'unreachable'

interface SessionApi extends BaseAPI {
  readonly fetch: () => Promise<unknown[]>
}

interface SessionLifecycleDriver {
  /**
   * Whether this dialect's wire can ANNOUNCE a throttle window. Classic
   * counts it down in `LoginMinutes` (classic.ts:607-616); Home's 429
   * carries none this layer reads, so its
   * `AuthenticationThrottledError` announces none by construction
   * (home.ts:586-588) and only the fallback rung is stageable there.
   */
  readonly announcesThrottleWindow: boolean
  /**
   * Prefix every log line of this dialect carries.
   */
  readonly logLabel: string
  /**
   * Payload a successful registry cycle answers. Exposed so a clause
   * can hand it to a transport of its own making.
   */
  readonly registryPayload: unknown
  /**
   * Persisted keys the dialect owns on top of {@link BASE_PERSISTED_KEYS}.
   */
  readonly sessionKeys: readonly string[]
  readonly create: (config: BaseAPIConfig) => Promise<SessionUnderTest>
  /**
   * Sign-in round-trips the transport has seen.
   */
  readonly loginCount: () => number
  /**
   * Session material a reuse probe accepts, keyed as the dialect
   * persists it. No refresh token: the probe does not need one, and
   * leaving it out keeps the reactive-401 recovery on the full-resume
   * shape both dialects share (Classic has no refresh-token shortcut).
   */
  readonly persistedSession: () => Record<string, string>
  /**
   * Registry cycles the transport has seen.
   */
  readonly registryCycleCount: () => number
  readonly reset: () => void
  readonly stage: (outcome: {
    announcedThrottleMinutes?: number | undefined
    login?: LoginOutcome | undefined
    wire?: WireOutcome | undefined
  }) => void
  /**
   * Persisted state that makes the next request refresh the session.
   * The two dialects disagree on what "stale" means and the divergence
   * is real: Classic keys the need off a missing context key, while
   * Home keys it off a real expiry — an EMPTY expiry reads as "nothing
   * recorded yet", not "expired".
   */
  readonly staleSession: () => Record<string, string>
}

interface SessionUnderTest {
  readonly api: SessionApi
  /**
   * How many devices the registry currently holds.
   */
  readonly deviceCount: () => number
  /**
   * One mutation through the request pipeline — a POST, whichever the
   * dialect's is. Only the verb matters to the clauses here.
   */
  readonly sendMutation: () => Promise<unknown>
}

/**
 * What the transport answers for every non-sign-in call — the registry
 * cycle and, where the clause needs one, a mutation.
 *
 * `drifted-registry` is the one that answers 200: a payload each
 * dialect accepts as proof of a live session and refuses as a registry
 * — the shape that separates "the session stands" from "the cycle
 * landed".
 */
type WireOutcome =
  | 'drifted-registry'
  | 'ok'
  | 'rate-limited'
  | 'refuse-registry'
  | 'unauthorized-once'
  | 'unavailable'

interface WireState {
  baseline: number
  outcome: WireOutcome
  announcedThrottleMinutes?: number | undefined
  login?: LoginOutcome | undefined
}

/**
 * The upstream 429, carrying the window it asks the caller to wait.
 * @param path - URL the refused call targeted.
 * @returns The rate-limit refusal, `Retry-After` and all.
 */
const rateLimitRefusal = (path: string): Error =>
  createHttpError({
    message: 'Too many requests',
    responseHeaders: { 'retry-after': RETRY_AFTER_SECONDS },
    status: THROTTLED_STATUS,
    url: path,
  })

/**
 * One responder shared by both legs: the transport answer a staged
 * {@link WireOutcome} produces. A refusal is thrown, which the
 * dialect's async wrapper turns into a rejected round-trip.
 * @param state - The staged outcome plus the cycle count it was staged at.
 * @param wire - Where the call landed and what a success carries.
 * @param wire.cycleCount - Registry cycles seen so far, this call included.
 * @param wire.driftedPayload - Body a `drifted-registry` cycle answers.
 * @param wire.path - URL the call targeted, for the thrown error's snapshot.
 * @param wire.payload - Body a successful cycle answers.
 * @returns The successful response, when the outcome allows one.
 */
const answerWire = (
  state: WireState,
  {
    cycleCount,
    driftedPayload,
    path,
    payload,
  }: {
    cycleCount: number
    driftedPayload: unknown
    path: string
    payload: unknown
  },
): HttpResponse => {
  if (state.outcome === 'unavailable') {
    throw createServerError(UNAVAILABLE_STATUS, path)
  }
  if (state.outcome === 'rate-limited') {
    throw rateLimitRefusal(path)
  }
  if (state.outcome === 'refuse-registry') {
    throw new AuthenticationError(REGISTRY_REFUSED)
  }
  if (
    state.outcome === 'unauthorized-once' &&
    cycleCount === state.baseline + 1
  ) {
    throw createUnauthorizedError(path)
  }
  return mockResponse(
    state.outcome === 'drifted-registry' ? driftedPayload : payload,
    {},
    OK_STATUS,
  )
}

const standingSessionKeys = (
  driver: SessionLifecycleDriver,
  settingManager: SettingManager,
): readonly string[] =>
  driver.sessionKeys.filter((key) => (settingManager.get(key) ?? '') !== '')

const byName = (left: string, right: string): number =>
  left.localeCompare(right)

const seedCredentials = (settingManager: SettingManager): void => {
  settingManager.set('password', CREDENTIALS.password)
  settingManager.set('username', CREDENTIALS.username)
}

/**
 * Read back the keys a fixture wrote, so a clause can compare the whole
 * persisted session against what it seeded in one assertion.
 * @param settingManager - Store to read.
 * @param seeded - Keys and values the fixture put there.
 * @returns The same keys, carrying whatever the store holds now.
 */
const readBack = (
  settingManager: SettingManager,
  seeded: Record<string, string>,
): Record<string, string | null | undefined> =>
  Object.fromEntries(
    Object.keys(seeded).map((key) => [key, settingManager.get(key)]),
  )

/**
 * Every key a persistence host was asked to touch, however it was
 * asked: `''` reaches `set` on a host without `unset`, and `unset` on
 * one that has it (setting.ts:34-36).
 * @param calls - Recorded calls of the store's spies, key first.
 * @returns The touched keys, deduplicated and sorted.
 */
const touchedKeys = (
  ...calls: readonly (readonly (readonly [string, ...unknown[]])[])[]
): readonly string[] =>
  [...new Set(calls.flat().map(([key]) => key))].toSorted(byName)

// A duration the SDK measured, as opposed to one it invented: the
// extraction moves this clock from `Date.now()` to `performance.now()`,
// so the SHAPE is the contract — a value a fake clock controls is not.
const isMeasuredDuration = (durationMs: number): boolean =>
  Number.isFinite(durationMs) && durationMs >= 0

/**
 * A transport this SDK does not own: the CORE client, without the
 * MELCloud redaction vocabulary its subclass seats. Answers every call
 * with the registry payload, so an adopted one would be visible in the
 * registry it populated.
 * @param payload - Body every call answers.
 * @returns The foreign client and the spy proving whether it was used.
 */
const createForeignTransport = (
  payload: unknown,
): {
  client: CoreHttpClient
  requestSpy: MockInstance<CoreHttpClient['request']>
} => {
  const client = new CoreHttpClient({
    baseURL: 'https://foreign.transport.test',
    timeout: 0,
  })
  return {
    client,
    requestSpy: vi
      .spyOn(client, 'request')
      .mockResolvedValue(mockResponse(payload, {}, OK_STATUS)),
  }
}

// ---------------------------------------------------------------------------
// Classic leg
// ---------------------------------------------------------------------------

const { client: classicClient, requestSpy: classicRequest } =
  createMockHttpClient(CLASSIC_BASE_URL)

const classicWire: WireState = { baseline: 0, outcome: 'ok' }

const classicPayload = [
  classicBuildingWithStructure({
    Structure: {
      Areas: [],
      Devices: [classicRawDevice({ DeviceID: 42, DeviceName: 'Kernel' })],
      Floors: [],
    },
  }),
]

// A 200 the Classic session survives and the Classic registry does
// not: `ClassicBuildingListSchema` requires `Structure.Areas` to be an
// array, and `#list` parses AFTER the sign-in stored the context key.
const classicDriftedPayload = [
  {
    ...classicBuildingWithStructure(),
    Structure: { Areas: 'not-an-array', Devices: [], Floors: [] },
  },
]

const classicUrlCount = (path: string): number =>
  classicRequest.mock.calls.filter(([{ url }]) => url === path).length

const answerClassicLogin = (): HttpResponse => {
  if (classicWire.login === undefined) {
    throw new Error(UNEXPECTED_SIGN_IN)
  }
  if (classicWire.login === 'unreachable') {
    throw createServerError(UNAVAILABLE_STATUS, CLASSIC_LOGIN_PATH)
  }
  if (classicWire.login === 'throttle') {
    // The login throttle, window and all: `ErrorId 6` inside a 200,
    // counting the lockout down in `LoginMinutes`. Omitting the window
    // is how the endpoint says it announces none.
    return {
      data: {
        ErrorId: CLASSIC_THROTTLE_ERROR_ID,
        LoginData: null,
        LoginMinutes: classicWire.announcedThrottleMinutes ?? null,
      },
      headers: {},
      status: OK_STATUS,
    }
  }
  // A refused Classic sign-in is an HTTP 200 carrying `LoginData: null`,
  // not a 401 — `doAuthenticate` turns that shape into the shared
  // `AuthenticationError`.
  return classicWire.login === 'accept'
    ? classicLoginResponse()
    : { data: { LoginData: null }, headers: {}, status: OK_STATUS }
}

const stageClassic = ({
  announcedThrottleMinutes,
  login,
  wire = 'ok',
}: {
  announcedThrottleMinutes?: number | undefined
  login?: LoginOutcome | undefined
  wire?: WireOutcome | undefined
}): void => {
  classicWire.announcedThrottleMinutes = announcedThrottleMinutes
  classicWire.baseline = classicUrlCount(CLASSIC_LIST_PATH)
  classicWire.login = login
  classicWire.outcome = wire
  stageClassicWire(classicRequest, {
    login: answerClassicLogin,
    rest: ({ url }) =>
      answerWire(classicWire, {
        cycleCount: classicUrlCount(CLASSIC_LIST_PATH),
        driftedPayload: classicDriftedPayload,
        path: url ?? CLASSIC_LIST_PATH,
        payload: classicPayload,
      }),
  })
}

const classicDriver: SessionLifecycleDriver = {
  announcesThrottleWindow: true,
  logLabel: '[Classic]',
  registryPayload: classicPayload,
  sessionKeys: ['contextKey'],
  stage: stageClassic,
  create: async (config) => {
    const api = await ClassicAPI.create({
      syncIntervalMinutes: false,
      transport: classicClient,
      ...config,
    })
    return {
      api,
      deviceCount: (): number => api.registry.getDevices().length,
      sendMutation: async (): Promise<void> => {
        await api.updateLanguage('fr')
      },
    }
  },
  loginCount: () => classicUrlCount(CLASSIC_LOGIN_PATH),
  persistedSession: () => ({
    contextKey: 'ctx',
    expiry: '2030-12-31T00:00:00',
  }),
  registryCycleCount: () => classicUrlCount(CLASSIC_LIST_PATH),
  reset: () => {
    classicRequest.mockReset()
    stageClassic({})
  },
  staleSession: () => ({}),
}

// ---------------------------------------------------------------------------
// Home leg
// ---------------------------------------------------------------------------

const { client: homeClient, requestSpy: homeRequest } =
  createMockHttpClient(HOME_BASE_URL)

// The OIDC module talks to the global `fetch`, not to the BFF client.
const homeFetch = vi.fn<typeof fetch>()
vi.stubGlobal('fetch', homeFetch)

const homeWire: WireState = { baseline: 0, outcome: 'ok' }

const homePayload = homeContextData()

const HOME_FROST_POST_DATA = {
  enabled: false,
  max: 12,
  min: 6,
  units: { ATA: ['device-1'] },
}

// A 200 the Home session survives and the Home registry does not.
// `#fetchContext` parses in TWO stages: the identity slice
// (`HomeUserContextSchema` — email/firstname/id/lastname) hydrates
// `#user` first, and the salvage parse throws only afterwards, because
// `HomeResilientContextSchema` still requires `buildings` to be an
// array. Hence a signed-in client with a null `context`.
const homeDriftedPayload = { ...homePayload, buildings: 'not-an-array' }

const homeContextCount = (): number =>
  homeRequest.mock.calls.filter(([{ url }]) => url === HOME_CONTEXT_PATH).length

// Every Home refusal reaches `doAuthenticate` as a rejected token
// exchange; only the status tells them apart.
const homeSignInRefusal = (login: Exclude<LoginOutcome, 'accept'>): unknown => {
  if (login === 'throttle') {
    return createHttpError({
      message: 'Too many attempts',
      status: THROTTLED_STATUS,
      url: HOME_TOKEN_PATH,
    })
  }
  if (login === 'unreachable') {
    return createServerError(UNAVAILABLE_STATUS, HOME_TOKEN_PATH)
  }
  return createUnauthorizedError(HOME_TOKEN_PATH)
}

const stageHomeSignIn = (login: LoginOutcome | undefined): void => {
  if (login === undefined) {
    return
  }
  stageHomeOidcDance(homeFetch)
  if (login === 'accept') {
    stageHomeTokenExchange(homeFetch)
    return
  }
  homeFetch.mockRejectedValueOnce(homeSignInRefusal(login))
}

const stageHome = ({
  login,
  wire = 'ok',
}: {
  announcedThrottleMinutes?: number | undefined
  login?: LoginOutcome | undefined
  wire?: WireOutcome | undefined
}): void => {
  homeWire.baseline = homeContextCount()
  homeWire.outcome = wire
  homeRequest.mockImplementation(async ({ url }) => {
    await Promise.resolve()
    return answerWire(homeWire, {
      cycleCount: homeContextCount(),
      driftedPayload: homeDriftedPayload,
      path: url ?? HOME_CONTEXT_PATH,
      payload: homePayload,
    })
  })
  stageHomeSignIn(login)
}

const homeDriver: SessionLifecycleDriver = {
  // The BFF's 429 carries no window this layer reads, so
  // `doAuthenticate` raises a throttle that announces none
  // (home.ts:586-588) — `announcedThrottleMinutes` is unrepresentable
  // here, and the staging above rightly ignores it.
  announcesThrottleWindow: false,
  logLabel: '[Home]',
  registryCycleCount: homeContextCount,
  registryPayload: homePayload,
  sessionKeys: ['accessToken', 'refreshToken'],
  stage: stageHome,
  create: async (config) => {
    const api = await HomeAPI.create({
      baseURL: HOME_BASE_URL,
      syncIntervalMinutes: false,
      transport: homeClient,
      ...config,
    })
    return {
      api,
      deviceCount: (): number => api.registry.getDevices().length,
      sendMutation: async (): Promise<void> => {
        await api.updateFrostProtection(HOME_FROST_POST_DATA)
      },
    }
  },
  // Counted at the PAR hop, the first round-trip of the OIDC dance:
  // that is where a sign-in ATTEMPT becomes observable, and an attempt
  // is what the clauses count. Counting the token exchange instead
  // would miss every attempt that never got that far.
  loginCount: () =>
    homeFetch.mock.calls.filter(
      ([url]) => typeof url === 'string' && url.includes(HOME_PAR_PATH),
    ).length,
  persistedSession: () => ({
    accessToken: 'persisted-token',
    expiry: Temporal.Now.instant().add({ hours: 1 }).toString(),
  }),
  reset: () => {
    homeRequest.mockReset()
    homeFetch.mockReset()
    stageHome({})
  },
  staleSession: () => ({
    expiry: Temporal.Now.instant().subtract({ hours: 1 }).toString(),
  }),
}

// ---------------------------------------------------------------------------
// The clause table
// ---------------------------------------------------------------------------

// The transient-retry rung is the innermost policy and is mounted for
// GET only: replaying a POST that may have landed server-side is a
// duplicate write in disguise. Both rows run against the same 503.
// `throttleBackoffMs` (base.ts:139-148) reads the window the server
// announced and holds sign-ins for it, with the two-hour constant as
// BOTH the fallback and the cap. Every rung matters in the field: a
// dropped branch turns an announced lockout into 15 minutes of
// re-hammering, and the row that made the constant a cap is a 60-minute
// lockout answered with a 120-minute pause.
const THROTTLE_CASES = [
  {
    announcedThrottleMinutes: undefined,
    heldForMs: THROTTLE_FALLBACK_MS,
    label:
      'holds sign-ins for the two-hour default when the throttle announces no window',
    requiresAnnouncedWindow: false,
  },
  {
    announcedThrottleMinutes: ANNOUNCED_THROTTLE_MINUTES,
    heldForMs: ANNOUNCED_THROTTLE_MS,
    label: 'releases sign-ins at the announced window, not at the default',
    requiresAnnouncedWindow: true,
  },
  {
    announcedThrottleMinutes: ABSURD_THROTTLE_MINUTES,
    heldForMs: THROTTLE_FALLBACK_MS,
    label: 'caps an absurd announced window at the two-hour default',
    requiresAnnouncedWindow: true,
  },
] as const

// The two persistence hosts a consumer can be: `setting.ts:34-36`
// routes a `''` write to `unset` when the host provides one, so the
// keys a session declares reach a different spy on each.
const PERSISTENCE_HOSTS = [
  { hasUnset: false, label: 'a host that stores the cleared sentinel' },
  { hasUnset: true, label: 'a host that deletes the cleared key' },
] as const

// The ladder `ensureAuthenticated` climbs (base.ts:459-475), in the
// order its doc insists on. Rung 2 — probe a persisted session before
// spending a sign-in — is the one Classic cannot reach; it has its own
// describe below, with the reason.
const ENSURE_AUTHENTICATED_RUNGS = [
  {
    expectedCycles: 0,
    expectedLogins: 0,
    label:
      'short-circuits ensureAuthenticated on a standing session, spending neither a cycle nor a sign-in',
    seed: (driver: SessionLifecycleDriver): Record<string, string> =>
      driver.persistedSession(),
  },
  {
    expectedCycles: 1,
    expectedLogins: 1,
    label:
      'reaches the sign-in rung of ensureAuthenticated only when no session is persisted',
    seed: (): Record<string, string> => ({}),
  },
] as const

const TRANSIENT_RUNG_CASES = [
  {
    label: 'retries the registry cycle, a GET',
    retriedMethods: ['GET'],
    send: async ({ api }: SessionUnderTest): Promise<void> => {
      const cycle = api.fetch()
      await vi.advanceTimersByTimeAsync(TRANSIENT_RETRY_WINDOW_MS)
      await cycle
    },
  },
  {
    label: 'never retries a mutation, a POST',
    retriedMethods: [],
    send: async ({ sendMutation }: SessionUnderTest): Promise<void> => {
      await Promise.allSettled([sendMutation()])
    },
  },
] as const

/**
 * Runs the session-lifecycle + request-pipeline contract against one
 * real dialect.
 * @param name - Implementation label used in the test titles.
 * @param driver - Stages that dialect's wire and builds its client.
 */
const describeSessionLifecycleContract = (
  name: string,
  driver: SessionLifecycleDriver,
): void => {
  describe(`sessionLifecycle — ${name}`, () => {
    beforeEach(() => {
      vi.useFakeTimers()
      mockTemporalNowInstant()
      driver.reset()
    })

    afterEach(() => {
      vi.mocked(Temporal.Now.instant).mockRestore()
      vi.useRealTimers()
    })

    it('leaves the credentials and the standing session untouched when a sign-in is refused, and arms the backoff', async () => {
      const { settingManager } = createSettingStore()
      driver.stage({ login: 'accept', wire: 'ok' })
      const { api } = await driver.create({ settingManager })
      await api.authenticate(CREDENTIALS)
      driver.stage({ login: 'refuse', wire: 'ok' })

      await expect(
        api.authenticate({ password: 'wrong', username: 'other@test.com' }),
      ).rejects.toThrow(AuthenticationError)

      expect(settingManager.get('username')).toBe(CREDENTIALS.username)
      expect(settingManager.get('password')).toBe(CREDENTIALS.password)
      expect(api.isAuthenticated()).toBe(true)
      expect(settingManager.get('loginBackoffUntil')).not.toBe('')
    })

    it('persists the credentials and clears the backoff when a sign-in is accepted', async () => {
      const { settingManager } = createSettingStore({
        loginBackoffUntil: String(Date.now() + ONE_HOUR_MS),
      })
      driver.stage({ login: 'accept', wire: 'ok' })
      const { api } = await driver.create({ settingManager })

      await api.authenticate(CREDENTIALS)

      expect(settingManager.get('username')).toBe(CREDENTIALS.username)
      expect(settingManager.get('password')).toBe(CREDENTIALS.password)
      expect(settingManager.get('loginBackoffUntil')).toBe('')
      expect(api.isAuthenticated()).toBe(true)
    })

    it('runs the enforced registry cycle on an accepted sign-in and rejects when it fails', async () => {
      const { settingManager } = createSettingStore()
      driver.stage({ login: 'accept', wire: 'refuse-registry' })
      const { api } = await driver.create({ settingManager })

      await expect(api.authenticate(CREDENTIALS)).rejects.toThrow(
        REGISTRY_REFUSED,
      )

      expect(driver.registryCycleCount()).toBe(1)
    })

    it('never arms the login backoff when only the registry cycle failed', async () => {
      const { settingManager } = createSettingStore()
      driver.stage({ login: 'accept', wire: 'refuse-registry' })
      const { api } = await driver.create({ settingManager })

      await expect(api.authenticate(CREDENTIALS)).rejects.toThrow(
        REGISTRY_REFUSED,
      )

      expect(settingManager.get('loginBackoffUntil')).toBe('')
    })

    // The gate's negative half (base.ts:837-842). A transport failure is
    // not a rejected credential: the retry paths own those, and pausing
    // sign-ins over a blip would lock a working account out for fifteen
    // minutes at a time.
    it('never arms the login backoff when the sign-in round-trip failed at transport', async () => {
      const { settingManager } = createSettingStore(CREDENTIALS)
      driver.stage({ login: 'unreachable', wire: 'ok' })
      const { api } = await driver.create({ settingManager })
      const attempted = driver.loginCount()
      driver.stage({ login: 'unreachable', wire: 'ok' })

      await expect(api.resumeSession()).resolves.toBe(false)

      expect(attempted).toBe(1)
      // The gate stayed open: the next automatic resume tried again
      // instead of being refused locally.
      expect(driver.loginCount()).toBe(2)
      expect(settingManager.get('loginBackoffUntil') ?? '').toBe('')
    })

    it('lets a racing logOut win the sign-in epoch', async () => {
      const { settingManager } = createSettingStore()
      driver.stage({ login: 'accept', wire: 'ok' })
      const { api } = await driver.create({ settingManager })

      // The sign-in is suspended on its transport round-trip when the
      // sign-out lands, so `#finishLogin` resumes on a stale epoch.
      const signIn = api.authenticate(CREDENTIALS)
      api.logOut()
      await signIn

      expect(settingManager.get('username') ?? '').toBe('')
      expect(settingManager.get('password') ?? '').toBe('')
      expect(standingSessionKeys(driver, settingManager)).toStrictEqual([])
      expect(driver.registryCycleCount()).toBe(0)
    })

    it('reports the standing session from resumeSession, not the throw', async () => {
      const logger = createLogger()
      const { settingManager } = createSettingStore(CREDENTIALS)
      driver.stage({ login: 'accept', wire: 'ok' })
      const { api } = await driver.create({ logger, settingManager })
      driver.stage({ login: 'refuse', wire: 'ok' })

      await expect(api.resumeSession()).resolves.toBe(true)

      expect(api.isAuthenticated()).toBe(true)
      expect(logger.error).toHaveBeenCalledWith(
        driver.logLabel,
        'Session resume failed:',
        expect.any(AuthenticationError),
      )
    })

    // The other reachable form of `resumeSession`'s
    // `return this.isAuthenticated()` — an ACCEPTED credential whose
    // enforced registry cycle then threw, the shape release 54.0.0 was
    // cut for. It was quarantined as Classic-only on the claim that
    // Home's `isAuthenticated()` reads `#user`, which only the failing
    // cycle hydrates. That claim was FALSE: `#fetchContext`
    // (home.ts:781-801) parses in two stages, `#user` is assigned at
    // :786-788, and the salvage `parseOrThrow` at :798 throws after it —
    // so the 200 staged below leaves Home signed in, `user` non-null and
    // `context` null (measured). Home has a second, independent
    // counterexample the harness never needed: the `/context` 404
    // (home.ts:880-896) raises `#hasNoHome`, which reads authenticated
    // with `#user === null`. What the quarantine described was a
    // limitation of what the harness could stage, never a property of
    // the dialects.
    it('returns true from resumeSession when the session was established before the enforced cycle threw', async () => {
      const { settingManager } = createSettingStore()
      driver.stage({ login: 'accept', wire: 'drifted-registry' })
      const { api } = await driver.create({ settingManager })
      seedCredentials(settingManager)

      await expect(api.resumeSession()).resolves.toBe(true)

      expect(api.isAuthenticated()).toBe(true)
      expect(driver.registryCycleCount()).toBe(1)
    })

    it('returns false from resumeSession when the sign-in is refused and no session stands', async () => {
      const { settingManager } = createSettingStore()
      driver.stage({ login: 'refuse', wire: 'ok' })
      const { api } = await driver.create({ settingManager })
      seedCredentials(settingManager)

      await expect(api.resumeSession()).resolves.toBe(false)

      expect(api.isAuthenticated()).toBe(false)
    })

    it('probes, reuses, and never signs in when the persisted session answers', async () => {
      const { settingManager } = createSettingStore({
        ...CREDENTIALS,
        ...driver.persistedSession(),
      })
      driver.stage({ wire: 'ok' })
      const { api, deviceCount } = await driver.create({ settingManager })

      expect(api.isAuthenticated()).toBe(true)
      expect(driver.loginCount()).toBe(0)
      expect(driver.registryCycleCount()).toBe(1)
      expect(deviceCount()).toBeGreaterThan(0)
    })

    // The probe is BEST-EFFORT by contract (base.ts:829-835): it runs
    // `syncRegistry`, never `enforceRegistrySync`. Nothing else pins
    // that choice, yet `initialize()` has no try/catch (:496-503) and
    // both `create()` factories await it — so the propagating hook would
    // turn a boot-time blip into a REJECTED `create()`, and a probe that
    // cleared on failure would destroy a session that was merely
    // unexercised.
    it('keeps the boot-time probe non-destructive when the wire is unavailable', async () => {
      const persisted = { ...CREDENTIALS, ...driver.persistedSession() }
      const { setSpy, settingManager } = createSettingStore(persisted)
      driver.stage({ login: 'refuse', wire: 'unavailable' })

      const booting = driver.create({ settingManager })
      await vi.advanceTimersByTimeAsync(TRANSIENT_RETRY_WINDOW_MS)
      const { deviceCount } = await booting

      expect(deviceCount()).toBe(0)
      expect(readBack(settingManager, persisted)).toStrictEqual(persisted)
      // `clearPersistedSession` writes the cleared sentinel to every key
      // it owns; not one key was cleared.
      expect(
        setSpy.mock.calls.filter(([, value]) => value === ''),
      ).toStrictEqual([])
    })

    it('signs in for real when no persisted session makes the probe worth attempting', async () => {
      const { settingManager } = createSettingStore(CREDENTIALS)
      driver.stage({ login: 'accept', wire: 'ok' })
      const { api, deviceCount } = await driver.create({ settingManager })

      expect(api.isAuthenticated()).toBe(true)
      expect(driver.loginCount()).toBe(1)
      // One cycle only — the enforced post-auth sync. A probe would
      // have spent a second one before it.
      expect(driver.registryCycleCount()).toBe(1)
      expect(deviceCount()).toBeGreaterThan(0)
    })

    it('fires onAuthenticationLost exactly once per episode', async () => {
      const onAuthenticationLost =
        vi.fn<NonNullable<LifecycleEvents['onAuthenticationLost']>>()
      const { settingManager } = createSettingStore(CREDENTIALS)
      driver.stage({ login: 'refuse', wire: 'refuse-registry' })
      const { api } = await driver.create({
        events: { onAuthenticationLost },
        settingManager,
      })

      await api.fetch()
      await api.fetch()

      expect(onAuthenticationLost).toHaveBeenCalledTimes(1)
    })

    it('alternates onAuthenticationLost and onAuthenticationRestored, never repeating either', async () => {
      const onAuthenticationLost =
        vi.fn<NonNullable<LifecycleEvents['onAuthenticationLost']>>()
      const onAuthenticationRestored =
        vi.fn<NonNullable<LifecycleEvents['onAuthenticationRestored']>>()
      const { settingManager } = createSettingStore(CREDENTIALS)
      driver.stage({ login: 'refuse', wire: 'refuse-registry' })
      const { api } = await driver.create({
        events: { onAuthenticationLost, onAuthenticationRestored },
        settingManager,
      })
      driver.stage({ login: 'accept', wire: 'ok' })

      await api.authenticate(CREDENTIALS)
      await api.fetch()

      expect(onAuthenticationLost).toHaveBeenCalledTimes(1)
      expect(onAuthenticationRestored).toHaveBeenCalledTimes(1)
    })

    it('clears the session and the registry when a cycle outlives its epoch', async () => {
      const { settingManager } = createSettingStore({
        ...CREDENTIALS,
        ...driver.persistedSession(),
      })
      driver.stage({ wire: 'ok' })
      const { api, deviceCount } = await driver.create({ settingManager })

      // The cycle repopulates what the sign-out just wiped; the
      // epilogue re-runs the wipe so the sign-out sticks.
      const cycle = api.fetch()
      api.logOut()
      await cycle

      expect(api.isAuthenticated()).toBe(false)
      expect(deviceCount()).toBe(0)
    })

    it('reschedules the next sync when a cycle ends authenticated', async () => {
      const { settingManager } = createSettingStore({
        ...CREDENTIALS,
        ...driver.persistedSession(),
      })
      driver.stage({ wire: 'ok' })
      const { api } = await driver.create({
        settingManager,
        syncIntervalMinutes: SYNC_INTERVAL_MINUTES,
      })
      const settled = driver.registryCycleCount()

      await vi.advanceTimersByTimeAsync(SYNC_TICK_MS)
      const ticked = driver.registryCycleCount()
      api[Symbol.dispose]()

      expect(ticked).toBeGreaterThan(settled)
    })

    it('disarms the timer and reports the loss when a cycle ends unauthenticated with recoverable state', async () => {
      const onAuthenticationLost =
        vi.fn<NonNullable<LifecycleEvents['onAuthenticationLost']>>()
      const { settingManager } = createSettingStore()
      driver.stage({ login: 'refuse', wire: 'refuse-registry' })
      const { api } = await driver.create({
        events: { onAuthenticationLost },
        settingManager,
        syncIntervalMinutes: SYNC_INTERVAL_MINUTES,
      })
      // Credentials arrive AFTER construction, so the boot-time restore
      // emitted nothing: the loss below is the cycle epilogue's own.
      seedCredentials(settingManager)

      await api.fetch()
      const settled = driver.registryCycleCount()
      await vi.advanceTimersByTimeAsync(SYNC_TICK_MS)
      const ticked = driver.registryCycleCount()
      api[Symbol.dispose]()

      expect(onAuthenticationLost).toHaveBeenCalledTimes(1)
      expect(ticked).toBe(settled)
    })

    it('logs the failure and answers an empty list when a best-effort cycle fails', async () => {
      const logger = createLogger()
      const { settingManager } = createSettingStore({
        ...CREDENTIALS,
        ...driver.persistedSession(),
      })
      driver.stage({ wire: 'ok' })
      const { api } = await driver.create({ logger, settingManager })
      driver.stage({ wire: 'refuse-registry' })

      await expect(api.fetch()).resolves.toStrictEqual([])

      expect(logger.error).toHaveBeenCalledWith(
        driver.logLabel,
        'Failed to fetch devices:',
        expect.any(AuthenticationError),
      )
    })

    it('emits no sync notification when the registry cycle fails', async () => {
      const onSyncComplete = vi.fn<SyncCallback>()
      const { settingManager } = createSettingStore({
        ...CREDENTIALS,
        ...driver.persistedSession(),
      })
      driver.stage({ wire: 'ok' })
      const { api } = await driver.create({
        events: { onSyncComplete },
        settingManager,
      })
      onSyncComplete.mockClear()
      driver.stage({ wire: 'refuse-registry' })

      await api.fetch()

      expect(onSyncComplete).not.toHaveBeenCalled()
    })

    it('collapses concurrent callers onto a single session refresh', async () => {
      const { settingManager } = createSettingStore(driver.staleSession())
      driver.stage({ login: 'accept', wire: 'ok' })
      const { api } = await driver.create({ settingManager })
      seedCredentials(settingManager)

      const cycles = await Promise.all([
        api.fetch(),
        api.fetch(),
        api.fetch(),
        api.fetch(),
      ])

      expect(cycles).toHaveLength(CONCURRENT_CALLERS)
      expect(driver.loginCount()).toBe(1)
    })

    it('runs one guarded reauth on a 401 and replays the request exactly once', async () => {
      const { settingManager } = createSettingStore({
        ...CREDENTIALS,
        ...driver.persistedSession(),
      })
      driver.stage({ wire: 'ok' })
      const { api, deviceCount } = await driver.create({ settingManager })
      const probed = driver.registryCycleCount()
      driver.stage({ login: 'accept', wire: 'unauthorized-once' })

      const buildings = await api.fetch()

      expect(buildings.length).toBeGreaterThan(0)
      expect(driver.loginCount()).toBe(1)
      // The rejected attempt, the enforced post-auth sync of the
      // re-login the reauth spends, and exactly one replay.
      expect(driver.registryCycleCount() - probed).toBe(3)
      expect(deviceCount()).toBeGreaterThan(0)
    })

    it.each(TRANSIENT_RUNG_CASES)(
      '$label',
      async ({ retriedMethods, send }) => {
        const onRequestRetry =
          vi.fn<NonNullable<LifecycleEvents['onRequestRetry']>>()
        const { settingManager } = createSettingStore({
          ...CREDENTIALS,
          ...driver.persistedSession(),
        })
        driver.stage({ wire: 'ok' })
        const session = await driver.create({
          events: { onRequestRetry },
          settingManager,
        })
        driver.stage({ wire: 'unavailable' })

        await send(session)

        expect([
          ...new Set(onRequestRetry.mock.calls.map(([event]) => event.method)),
        ]).toStrictEqual(retriedMethods)
      },
    )

    it('lets an explicit sign-in through the backoff gate and resets it on success', async () => {
      const { settingManager } = createSettingStore({
        ...CREDENTIALS,
        loginBackoffUntil: String(Date.now() + ONE_HOUR_MS),
      })
      driver.stage({ login: 'accept', wire: 'ok' })
      const { api } = await driver.create({ settingManager })

      const isResumed = await api.resumeSession()
      const gatedLogins = driver.loginCount()
      await api.authenticate(CREDENTIALS)

      expect(isResumed).toBe(false)
      expect(gatedLogins).toBe(0)
      expect(driver.loginCount()).toBe(1)
      expect(settingManager.get('loginBackoffUntil')).toBe('')
    })

    it.each(
      THROTTLE_CASES.filter(
        ({ requiresAnnouncedWindow }) =>
          driver.announcesThrottleWindow || !requiresAnnouncedWindow,
      ),
    )('$label', async ({ announcedThrottleMinutes, heldForMs }) => {
      const { settingManager } = createSettingStore(CREDENTIALS)
      driver.stage({ announcedThrottleMinutes, login: 'throttle' })
      const { api } = await driver.create({ settingManager })
      const throttled = driver.loginCount()
      driver.stage({ login: 'accept', wire: 'ok' })

      vi.advanceTimersByTime(heldForMs - CLOCK_EPSILON_MS)

      await expect(api.resumeSession()).resolves.toBe(false)

      const held = driver.loginCount()

      vi.advanceTimersByTime(CLOCK_EPSILON_MS * 2)

      await expect(api.resumeSession()).resolves.toBe(true)

      expect(throttled).toBe(1)
      expect(held).toBe(1)
      expect(driver.loginCount()).toBe(2)
    })

    it('reads a corrupt persisted backoff as no pause at all', async () => {
      const { settingManager } = createSettingStore({
        ...CREDENTIALS,
        loginBackoffUntil: 'not-a-deadline',
      })
      driver.stage({ login: 'accept', wire: 'ok' })
      const { api } = await driver.create({ settingManager })

      expect(api.isAuthenticated()).toBe(true)
      expect(driver.loginCount()).toBe(1)
    })

    // The rate-limit gate, the outermost rung of the request pipeline:
    // it arms itself from the `Retry-After` the 429 announced, refuses
    // the next request without spending a round-trip, and reopens on its
    // own clock. Two minutes is far under either dialect's fallback
    // window, so reopening there proves the header was read.
    it('arms the rate-limit gate on a 429 and refuses the next request until the announced window elapses', async () => {
      const { settingManager } = createSettingStore({
        ...CREDENTIALS,
        ...driver.persistedSession(),
      })
      driver.stage({ wire: 'ok' })
      const { api } = await driver.create({ settingManager })
      driver.stage({ wire: 'rate-limited' })

      await api.fetch()
      const refused = driver.registryCycleCount()
      const isPausedAfter429 = api.isRateLimited
      await api.fetch()
      const shortCircuited = driver.registryCycleCount()
      vi.advanceTimersByTime(RETRY_AFTER_MS + CLOCK_EPSILON_MS)

      expect(isPausedAfter429).toBe(true)
      // The paused gate answered locally: the transport never saw it.
      expect(shortCircuited).toBe(refused)
      expect(api.isRateLimited).toBe(false)
    })

    it.each(ENSURE_AUTHENTICATED_RUNGS)(
      '$label',
      async ({ expectedCycles, expectedLogins, seed }) => {
        const { settingManager } = createSettingStore(seed(driver))
        driver.stage({ login: 'accept', wire: 'ok' })
        const { api } = await driver.create({ settingManager })
        // Credentials arrive AFTER construction, so the boot-time
        // restore cannot spend the sign-in this clause is counting.
        seedCredentials(settingManager)
        const settled = driver.registryCycleCount()

        await expect(api.ensureAuthenticated()).resolves.toBe(true)

        expect(driver.loginCount()).toBe(expectedLogins)
        expect(driver.registryCycleCount() - settled).toBe(expectedCycles)
      },
    )

    // The per-request lifecycle (`#runWithEvents`, base.ts:962-984).
    // `durationMs` is asserted by SHAPE and never by value: the
    // extraction moves this clock from `Date.now()` to
    // `performance.now()`, which no fake timer controls — but a
    // measurement that came back `NaN` or negative is not a duration
    // under either clock.
    it('emits the request lifecycle around every round-trip, with a measured duration', async () => {
      const onRequestComplete =
        vi.fn<NonNullable<LifecycleEvents['onRequestComplete']>>()
      const onRequestError =
        vi.fn<NonNullable<LifecycleEvents['onRequestError']>>()
      const onRequestStart =
        vi.fn<NonNullable<LifecycleEvents['onRequestStart']>>()
      const { settingManager } = createSettingStore({
        ...CREDENTIALS,
        ...driver.persistedSession(),
      })
      driver.stage({ wire: 'ok' })
      const { api } = await driver.create({
        events: { onRequestComplete, onRequestError, onRequestStart },
        settingManager,
      })
      driver.stage({ wire: 'refuse-registry' })

      await api.fetch()

      const durations = [
        ...onRequestComplete.mock.calls.map(([event]) => event.durationMs),
        ...onRequestError.mock.calls.map(([event]) => event.durationMs),
      ]

      // The probe's round-trip and the refused one.
      expect(onRequestStart).toHaveBeenCalledTimes(2)
      expect(onRequestComplete).toHaveBeenCalledTimes(1)
      expect(onRequestError).toHaveBeenCalledTimes(1)
      expect(
        durations.filter((durationMs) => isMeasuredDuration(durationMs)),
      ).toStrictEqual(durations)
    })

    // The transport-resolution gate (base.ts:292-298) adopts a
    // pre-built client only when it IS this repo's `HttpClient` — the
    // subclass that seats the MELCloud redaction vocabulary. Anything
    // else, the bare core client included, is re-wrapped. The
    // distinction survives the move only if the gate keeps binding the
    // SUBCLASS: bound to the core class instead, the client below would
    // newly be adopted, and every `HttpError` it threw would carry an
    // unredacted snapshot.
    it("re-wraps a transport that is not this SDK's own HttpClient", async () => {
      const { client, requestSpy } = createForeignTransport(
        driver.registryPayload,
      )
      const { settingManager } = createSettingStore()
      driver.stage({ wire: 'ok' })
      const { api, deviceCount } = await driver.create({
        settingManager,
        transport: client,
      })

      await api.fetch()

      expect(requestSpy).not.toHaveBeenCalled()
      // Had it been adopted, this very payload would have filled the
      // registry.
      expect(deviceCount()).toBe(0)
    })

    it('emits nothing on an explicit logOut', async () => {
      const onAuthenticationLost =
        vi.fn<NonNullable<LifecycleEvents['onAuthenticationLost']>>()
      const onAuthenticationRestored =
        vi.fn<NonNullable<LifecycleEvents['onAuthenticationRestored']>>()
      const onSyncComplete = vi.fn<SyncCallback>()
      const { settingManager } = createSettingStore({
        ...CREDENTIALS,
        ...driver.persistedSession(),
      })
      driver.stage({ wire: 'ok' })
      const { api } = await driver.create({
        events: {
          onAuthenticationLost,
          onAuthenticationRestored,
          onSyncComplete,
        },
        settingManager,
      })
      onSyncComplete.mockClear()

      api.logOut()

      expect(onAuthenticationLost).not.toHaveBeenCalled()
      expect(onAuthenticationRestored).not.toHaveBeenCalled()
      expect(onSyncComplete).not.toHaveBeenCalled()
    })

    it.each(PERSISTENCE_HOSTS)(
      'writes exactly the persisted keys the session material declares, on $label',
      async ({ hasUnset }) => {
        const { setSpy, settingManager, unsetSpy } = createSettingStore(
          {},
          { hasUnset },
        )
        driver.stage({ login: 'accept', wire: 'ok' })
        const { api } = await driver.create({ settingManager })

        await api.authenticate(CREDENTIALS)

        expect(
          touchedKeys(setSpy.mock.calls, unsetSpy.mock.calls),
        ).toStrictEqual(
          [...BASE_PERSISTED_KEYS, ...driver.sessionKeys].toSorted(byName),
        )
      },
    )

    // The auto-sync timer is the one collaborator `BaseAPI` hands the
    // RAW host logger (base.ts:299-303) while everything else gets the
    // labelled one (:287), so a rejected tick reports itself without
    // saying which account it was about. That asymmetry is a LATENT BUG,
    // kept deliberately through the extraction: those strings land
    // verbatim in the diagnostic reports users paste into issues, so it
    // gets fixed on its own, not silently inside a change whose whole
    // purpose is behavioural neutrality. Pinned here as it IS, so a
    // tidy-up during the move announces itself.
    //
    // Reaching the SyncManager's logger takes some doing: the dialects'
    // `fetch()` is best-effort and never rejects on its own, so the tick
    // is made to reject through the one thing that wrapper does not
    // guard — the failure line itself, on a host logger that throws.
    it('reports a rejected auto-sync tick through the unlabelled host logger', async () => {
      const logger = createLogger()
      const { settingManager } = createSettingStore({
        ...CREDENTIALS,
        ...driver.persistedSession(),
      })
      driver.stage({ wire: 'ok' })
      const { api } = await driver.create({
        logger,
        settingManager,
        syncIntervalMinutes: SYNC_INTERVAL_MINUTES,
      })
      driver.stage({ wire: 'refuse-registry' })
      vi.mocked(logger.error).mockImplementationOnce(() => {
        throw new Error(REPORTER_REFUSED)
      })

      await vi.advanceTimersByTimeAsync(SYNC_TICK_MS)
      api[Symbol.dispose]()

      expect(logger.error).toHaveBeenLastCalledWith(
        'Auto-sync failed:',
        expect.any(Error),
      )
    })

    // The timer half is behavioural: the cycle that settled
    // authenticated armed the auto-sync, and nothing may survive the
    // dispose. The guard half cannot be: `RetryGuard` holds a monotonic
    // DEADLINE, not a timeout, so its release leaves no trace a clock
    // can read, and the one behaviour it does change — a re-opened retry
    // budget — is only visible to a caller the disposal contract
    // forbids ("the instance must not be reused after disposal"). The
    // disposal call stays the observable; the spy is restored here
    // because the vitest config clears mocks, never restores them.
    it('releases the sync timer and the retry guard on dispose', async () => {
      const releaseGuard = vi.spyOn(RetryGuard.prototype, Symbol.dispose)
      onTestFinished(() => {
        releaseGuard.mockRestore()
      })
      const { settingManager } = createSettingStore({
        ...CREDENTIALS,
        ...driver.persistedSession(),
      })
      driver.stage({ wire: 'ok' })
      const { api } = await driver.create({
        settingManager,
        syncIntervalMinutes: SYNC_INTERVAL_MINUTES,
      })
      const armed = vi.getTimerCount()
      const settled = driver.registryCycleCount()

      api[Symbol.dispose]()
      const remaining = vi.getTimerCount()
      await vi.advanceTimersByTimeAsync(SYNC_TICK_MS)

      expect(armed).toBeGreaterThan(0)
      expect(remaining).toBe(0)
      expect(releaseGuard).toHaveBeenCalledTimes(1)
      expect(driver.registryCycleCount()).toBe(settled)
    })
  })
}

describeSessionLifecycleContract('ClassicAPI', classicDriver)

describeSessionLifecycleContract('HomeAPI', homeDriver)

// A DIALECT divergence, not a harness one — and unlike the quarantine
// this replaces, it is decidable by reading two expressions. The middle
// rung of `ensureAuthenticated` (base.ts:463-472) fires when the client
// is NOT authenticated yet still holds session material worth probing.
// Classic cannot be in that state: `isAuthenticated()` (classic.ts:463-465)
// and `hasPersistedSession()` (classic.ts:639-641) are the SAME
// expression, `this.contextKey !== ''` — one cannot read false while the
// other reads true. Home's are independent (`#user`/`#hasNoHome` versus
// the token pair, home.ts:511-513 and :608-615), so a refresh token that
// no cycle has exercised yet lands exactly there. Should Classic ever
// split the two hooks, this clause belongs back in the cross-dialect
// table.
describe('sessionLifecycle — Home-only: a session no cycle has exercised', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockTemporalNowInstant()
    homeDriver.reset()
  })

  afterEach(() => {
    vi.mocked(Temporal.Now.instant).mockRestore()
    vi.useRealTimers()
  })

  it('probes the persisted session before spending a sign-in', async () => {
    const { settingManager } = createSettingStore()
    homeDriver.stage({ login: 'accept', wire: 'ok' })
    const { api } = await homeDriver.create({ settingManager })
    // Both arrive after construction, so the boot-time restore saw
    // neither: the ladder below is the only thing that can spend them.
    settingManager.set('refreshToken', 'persisted-refresh')
    seedCredentials(settingManager)

    await expect(api.ensureAuthenticated()).resolves.toBe(true)

    expect(homeDriver.loginCount()).toBe(0)
    expect(homeDriver.registryCycleCount()).toBe(1)
  })
})
