import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
const UNAVAILABLE_STATUS = 503

const CONCURRENT_CALLERS = 4
const ONE_HOUR_MS = 3_600_000
const SYNC_INTERVAL_MINUTES = 1
const SYNC_TICK_MS = 90_000
const TRANSIENT_RETRY_WINDOW_MS = 30_000

// The marker a refused registry cycle carries. Deliberately an
// `AuthenticationError`: the login backoff must key off the SIGN-IN
// round-trip, never off what the post-auth cycle happened to throw.
const REGISTRY_REFUSED = 'registry cycle refused'

// A sign-in no scenario staged. Loud on purpose — a clause that signs
// in without saying so is a clause that pins the wrong thing.
const UNEXPECTED_SIGN_IN = 'unexpected sign-in'

const CREDENTIALS = { password: 'pass', username: 'user@test.com' }

// The keys `BaseAPI` itself persists; each dialect adds its own
// session material on top (see `SessionLifecycleDriver.sessionKeys`).
const BASE_PERSISTED_KEYS = [
  'expiry',
  'loginBackoffUntil',
  'password',
  'username',
]

type LoginOutcome = 'accept' | 'refuse'

interface SessionApi extends BaseAPI {
  readonly fetch: () => Promise<unknown[]>
}

interface SessionLifecycleDriver {
  /**
   * Prefix every log line of this dialect carries.
   */
  readonly logLabel: string
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
 */
type WireOutcome =
  'ok' | 'refuse-registry' | 'unauthorized-once' | 'unavailable'

interface WireState {
  baseline: number
  outcome: WireOutcome
  login?: LoginOutcome | undefined
}

/**
 * One responder shared by both legs: the transport answer a staged
 * {@link WireOutcome} produces. A refusal is thrown, which the
 * dialect's async wrapper turns into a rejected round-trip.
 * @param state - The staged outcome plus the cycle count it was staged at.
 * @param wire - Where the call landed and what a success carries.
 * @param wire.cycleCount - Registry cycles seen so far, this call included.
 * @param wire.path - URL the call targeted, for the thrown error's snapshot.
 * @param wire.payload - Body a successful cycle answers.
 * @returns The successful response, when the outcome allows one.
 */
const answerWire = (
  state: WireState,
  {
    cycleCount,
    path,
    payload,
  }: { cycleCount: number; path: string; payload: unknown },
): HttpResponse => {
  if (state.outcome === 'unavailable') {
    throw createServerError(UNAVAILABLE_STATUS, path)
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
  return mockResponse(payload, {}, OK_STATUS)
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

const classicUrlCount = (path: string): number =>
  classicRequest.mock.calls.filter(([{ url }]) => url === path).length

const answerClassicLogin = (): HttpResponse => {
  if (classicWire.login === undefined) {
    throw new Error(UNEXPECTED_SIGN_IN)
  }
  // A refused Classic sign-in is an HTTP 200 carrying `LoginData: null`,
  // not a 401 — `doAuthenticate` turns that shape into the shared
  // `AuthenticationError`.
  return classicWire.login === 'accept'
    ? classicLoginResponse()
    : { data: { LoginData: null }, headers: {}, status: OK_STATUS }
}

const stageClassic = ({
  login,
  wire = 'ok',
}: {
  login?: LoginOutcome | undefined
  wire?: WireOutcome | undefined
}): void => {
  classicWire.baseline = classicUrlCount(CLASSIC_LIST_PATH)
  classicWire.login = login
  classicWire.outcome = wire
  stageClassicWire(classicRequest, {
    login: answerClassicLogin,
    rest: ({ url }) =>
      answerWire(classicWire, {
        cycleCount: classicUrlCount(CLASSIC_LIST_PATH),
        path: url ?? CLASSIC_LIST_PATH,
        payload: classicPayload,
      }),
  })
}

const classicDriver: SessionLifecycleDriver = {
  logLabel: '[Classic]',
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

const homeContextCount = (): number =>
  homeRequest.mock.calls.filter(([{ url }]) => url === HOME_CONTEXT_PATH).length

const stageHomeSignIn = (login: LoginOutcome | undefined): void => {
  if (login === undefined) {
    return
  }
  stageHomeOidcDance(homeFetch)
  if (login === 'accept') {
    stageHomeTokenExchange(homeFetch)
    return
  }
  homeFetch.mockRejectedValueOnce(createUnauthorizedError(HOME_TOKEN_PATH))
}

const stageHome = ({
  login,
  wire = 'ok',
}: {
  login?: LoginOutcome | undefined
  wire?: WireOutcome | undefined
}): void => {
  homeWire.baseline = homeContextCount()
  homeWire.outcome = wire
  homeRequest.mockImplementation(async ({ url }) => {
    await Promise.resolve()
    return answerWire(homeWire, {
      cycleCount: homeContextCount(),
      path: url ?? HOME_CONTEXT_PATH,
      payload: homePayload,
    })
  })
  stageHomeSignIn(login)
}

const homeDriver: SessionLifecycleDriver = {
  logLabel: '[Home]',
  registryCycleCount: homeContextCount,
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

    it('writes exactly the persisted keys the session material declares', async () => {
      const { setSpy, settingManager } = createSettingStore()
      driver.stage({ login: 'accept', wire: 'ok' })
      const { api } = await driver.create({ settingManager })

      await api.authenticate(CREDENTIALS)

      expect(
        [...new Set(setSpy.mock.calls.map(([key]) => key))].toSorted(byName),
      ).toStrictEqual(
        [...BASE_PERSISTED_KEYS, ...driver.sessionKeys].toSorted(byName),
      )
    })

    // The timer half is behavioural: the cycle that settled
    // authenticated armed the auto-sync, and nothing may survive the
    // dispose. The guard half cannot be: `RetryGuard` holds a monotonic
    // DEADLINE, not a timeout, so its release leaves no trace a clock
    // can read — the disposal call itself is the observable.
    it('releases the sync timer and the retry guard on dispose', async () => {
      const releaseGuard = vi.spyOn(RetryGuard.prototype, Symbol.dispose)
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

// QUARANTINED DIVERGENCE — Classic only, by construction rather than by
// omission. The clause above ("reports the standing session, not the
// throw") reaches `resumeSession`'s `return this.isAuthenticated()`
// through a REFUSED sign-in over a live session, which both dialects
// can stage. Its other reachable form — an ACCEPTED credential whose
// enforced registry cycle then threw, the shape release 54.0.0 was cut
// for — has no Home form: Home's `isAuthenticated()` reads `#user`,
// and `#user` is hydrated by the very `/context` cycle the enforced
// sync runs, so a Home sign-in whose enforced cycle threw is never
// authenticated. Classic's reads the context key the sign-in round-trip
// itself stored, so the session stands even though the cycle did not.
describe('sessionLifecycle — Classic-only: a session outliving its enforced cycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockTemporalNowInstant()
    classicDriver.reset()
  })

  afterEach(() => {
    vi.mocked(Temporal.Now.instant).mockRestore()
    vi.useRealTimers()
  })

  it('returns true when the session was established before the enforced cycle threw', async () => {
    const { settingManager } = createSettingStore()
    classicDriver.stage({ login: 'accept', wire: 'refuse-registry' })
    const { api } = await classicDriver.create({ settingManager })
    seedCredentials(settingManager)

    await expect(api.resumeSession()).resolves.toBe(true)

    expect(api.isAuthenticated()).toBe(true)
    expect(classicDriver.registryCycleCount()).toBe(1)
  })
})
