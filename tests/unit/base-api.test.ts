import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { BaseAPIConfig } from '../../src/api/types.ts'
import { BaseAPI, normalizeUnauthorized } from '../../src/api/base.ts'
import { AuthenticationError } from '../../src/errors/index.ts'
import { type HttpResponse, HttpError } from '../../src/http/index.ts'
import { REDACTED } from '../../src/observability/context.ts'
import { Temporal } from '../../src/temporal.ts'
import {
  createLogger,
  createMockHttpClient,
  createServerError,
  mockTemporalNowInstant,
} from '../helpers.ts'

// WIRING suite, not a behavior suite: the session lifecycle and the
// request pipeline live in `@olivierzal/api-core`'s `SessionAPI`, whose
// own test suite pins the template's behavior, and
// `tests/contracts/session-lifecycle.test.ts` pins this SDK's dialects
// against it on both real legs. What this file covers is what stays
// OURS in `src/api/base.ts`: the transport resolution, the bound
// redaction vocabulary reaching the core's log lines, the
// `isRateLimited` surface, `ensureAuthenticated`'s rungs, and the
// `normalizeUnauthorized` boundary helper. Re-testing core behavior
// here would let coverage be satisfied by the wrong suite.

// Observes the auto-sync timer firing (planNext armed) — module-scoped
// because an arrow referencing `this` inside super() arguments is
// rejected before super binds it.
const syncCallbackMock = vi
  .fn<() => Promise<void>>()
  .mockResolvedValue(undefined)

const { client: mockHttpClient, requestSpy: mockRequest } =
  createMockHttpClient('https://test.api')

/**
 * Minimal concrete subclass of BaseAPI used to test THIS repo's wiring
 * without any Classic/Home-specific logic.
 */
class TestAPI extends BaseAPI {
  public readonly clearPersistedSessionMock = vi.fn<() => void>()

  public readonly clearRegistryMock = vi.fn<() => void>()

  public readonly doAuthenticateMock = vi.fn<() => Promise<void>>()

  public readonly getAuthHeadersMock = vi.fn<() => Record<string, string>>()

  public readonly hasPersistedSessionMock = vi.fn<() => boolean>()

  public readonly isAuthenticatedMock = vi.fn<() => boolean>()

  public readonly needsSessionRefreshMock = vi.fn<() => boolean>()

  public readonly performSessionRefreshMock = vi.fn<() => Promise<void>>()

  public readonly reauthenticateMock = vi.fn<() => Promise<boolean>>()

  public readonly reuseSucceededMock = vi.fn<() => boolean>()

  public readonly syncRegistryMock = vi.fn<() => Promise<void>>()

  public constructor(
    config: BaseAPIConfig = {},
    {
      shouldUseDefaultTransport = false,
    }: { shouldUseDefaultTransport?: boolean } = {},
  ) {
    super(
      shouldUseDefaultTransport
        ? config
        : { transport: mockHttpClient, ...config },
      {
        defaultSyncIntervalMinutes: false,
        httpConfig: { baseURL: 'https://test.api' },
        logLabel: '[Test]',
        rateLimitHours: 2,
        syncCallback: syncCallbackMock,
      },
    )
    this.getAuthHeadersMock.mockReturnValue({})
    this.hasPersistedSessionMock.mockReturnValue(false)
    this.isAuthenticatedMock.mockReturnValue(true)
    this.needsSessionRefreshMock.mockReturnValue(false)
    this.performSessionRefreshMock.mockResolvedValue()
    this.reauthenticateMock.mockResolvedValue(false)
    this.reuseSucceededMock.mockReturnValue(false)
    this.doAuthenticateMock.mockResolvedValue()
    this.syncRegistryMock.mockResolvedValue()
  }

  /**
   * Expose the protected dispatch for direct testing.
   */
  public async callDispatch<T = unknown>(
    method: string,
    url: string,
    config: Record<string, unknown> = {},
  ): Promise<HttpResponse<T>> {
    return this.dispatch<T>(method, url, config)
  }

  /**
   * Expose the protected request for testing.
   */
  public async callRequest<T = unknown>(
    method: string,
    url: string,
    config: Record<string, unknown> = {},
  ): Promise<HttpResponse<T>> {
    return this.request<T>(method, url, config)
  }

  public override isAuthenticated(): boolean {
    return this.isAuthenticatedMock()
  }

  protected override clearPersistedSession(): void {
    this.clearPersistedSessionMock()
  }

  protected override clearRegistry(): void {
    this.clearRegistryMock()
  }

  protected override async doAuthenticate(): Promise<void> {
    return this.doAuthenticateMock()
  }

  protected override async enforceRegistrySync(): Promise<void> {
    return this.syncRegistryMock()
  }

  protected override getAuthHeaders(): Record<string, string> {
    return this.getAuthHeadersMock()
  }

  protected override hasPersistedSession(): boolean {
    return this.hasPersistedSessionMock()
  }

  protected override needsSessionRefresh(): boolean {
    return this.needsSessionRefreshMock()
  }

  protected override async performSessionRefresh(): Promise<void> {
    return this.performSessionRefreshMock()
  }

  protected override async reauthenticate(): Promise<boolean> {
    return this.reauthenticateMock()
  }

  protected override reuseSucceeded(): boolean {
    return this.reuseSucceededMock()
  }

  // Mirrors the dialects: the probe path swallows (a boot-time blip
  // must not destroy a valid session), the enforced path propagates.
  protected override async syncRegistry(): Promise<void> {
    await this.runBestEffortSyncCycle(async () => {
      await this.syncRegistryMock()
      return []
    })
  }
}

describe('baseAPI wiring over the core session template', () => {
  let api: TestAPI

  beforeEach(() => {
    vi.useFakeTimers()
    mockTemporalNowInstant()
    mockRequest.mockResolvedValue({ data: {}, headers: {}, status: 200 })
    api = new TestAPI()
  })

  afterEach(() => {
    api[Symbol.dispose]()
    vi.mocked(Temporal.Now.instant).mockRestore()
    vi.useRealTimers()
  })

  describe('hTTP transport resolution', () => {
    it('defaults to a fetch-backed HttpClient when no transport is injected', () => {
      const instance = new TestAPI({}, { shouldUseDefaultTransport: true })

      expect(instance).toBeDefined()

      instance[Symbol.dispose]()
    })

    it('honours a timeout override when building the default client', () => {
      const instance = new TestAPI(
        { transport: { timeoutMs: 5000 } },
        { shouldUseDefaultTransport: true },
      )

      expect(instance).toBeDefined()

      instance[Symbol.dispose]()
    })
  })

  // The seam the 2026-08-21 leak taught: the core's dispatch serializes
  // the log lines, so the MELCloud vocabulary must ARRIVE there through
  // the constructor's `redaction` option — a key the BASE vocabulary
  // does not know is the discriminator, because only the bound engine
  // can mask it. Removing the option compiles and stays green
  // everywhere else; these clauses are what fail.
  describe('redaction wiring', () => {
    it('masks the MELCloud vocabulary in the logged request line', async () => {
      const logger = createLogger()
      const instance = new TestAPI({ logger })
      instance.getAuthHeadersMock.mockReturnValue({
        'X-MitsContextKey': 'raw-context-key',
      })

      await instance.callDispatch('get', '/probe')

      const [requestLine = []] = vi.mocked(logger.log).mock.calls
      const logged = requestLine.join(' ')

      expect(logged).toContain('API request')
      expect(logged).toContain(REDACTED)
      expect(logged).not.toContain('raw-context-key')

      instance[Symbol.dispose]()
    })

    it('masks the MELCloud vocabulary in the logged response line', async () => {
      const logger = createLogger()
      const instance = new TestAPI({ logger })
      mockRequest.mockResolvedValueOnce({
        data: { ContextKey: 'raw-context-key', Structure: {} },
        headers: {},
        status: 200,
      })

      await instance.callDispatch('post', '/Login/ClientLogin3')

      const [, responseLine = []] = vi.mocked(logger.log).mock.calls
      const logged = responseLine.join(' ')

      expect(logged).toContain('API response')
      expect(logged).toContain(REDACTED)
      expect(logged).not.toContain('raw-context-key')

      instance[Symbol.dispose]()
    })
  })

  describe('429 rate limiting surface', () => {
    it('records rate limit on 429 and sets isRateLimited', async () => {
      expect(api.isRateLimited).toBe(false)

      mockRequest.mockRejectedValueOnce(createServerError(429, '/data'))

      await expect(api.callRequest('get', '/data')).rejects.toThrow(
        'Status 429',
      )

      expect(api.isRateLimited).toBe(true)
    })
  })
})

// `normalizeUnauthorized` is this repo's boundary helper: its only
// other exercise is through `HomeAPI.doAuthenticate`, where the OIDC
// mock stack can mask subtle branching. Pinning the contract here
// keeps the three error classes (401 HttpError, non-401 HttpError,
// non-HttpError) traceable in isolation.
describe(normalizeUnauthorized, () => {
  it('wraps a 401 HttpError into AuthenticationError with original as cause', () => {
    const http = new HttpError('Unauthorized', {
      config: { url: '/context' },
      response: { data: undefined, headers: {}, status: 401 },
    })

    const result = normalizeUnauthorized(http)

    expect(result).toBeInstanceOf(AuthenticationError)
    expect(result).toMatchObject({ cause: http })
  })

  it('returns null for non-401 HttpErrors so callers rethrow the original', () => {
    const http = new HttpError('Server error', {
      config: { url: '/context' },
      response: { data: undefined, headers: {}, status: 500 },
    })

    expect(normalizeUnauthorized(http)).toBeNull()
  })

  it('returns null for non-HttpError errors so callers rethrow the original', () => {
    const native = new Error('network')

    expect(normalizeUnauthorized(native)).toBeNull()
  })
})

describe('ensureAuthenticated', () => {
  it('returns true from local state alone without a restore probe', async () => {
    const api = new TestAPI()
    api.isAuthenticatedMock.mockReturnValue(true)

    await expect(api.ensureAuthenticated()).resolves.toBe(true)

    expect(api.hasPersistedSessionMock).not.toHaveBeenCalled()
  })

  it('probes with a registry sync, never a destructive re-login', async () => {
    const api = new TestAPI()
    api.isAuthenticatedMock.mockReturnValueOnce(false).mockReturnValue(true)
    api.hasPersistedSessionMock.mockReturnValue(true)

    await expect(api.ensureAuthenticated()).resolves.toBe(true)

    // The decisive assertion: a full sign-in spends a real login
    // attempt and replaces the persisted session, so a session that is
    // merely unexercised must be restored by the sync alone.
    expect(api.syncRegistryMock).toHaveBeenCalledTimes(1)
    expect(api.doAuthenticateMock).not.toHaveBeenCalled()
    expect(api.clearPersistedSessionMock).not.toHaveBeenCalled()
  })

  it('tolerates a throwing probe and falls back to the restore', async () => {
    const api = new TestAPI()
    api.isAuthenticatedMock.mockReturnValue(false)
    api.hasPersistedSessionMock.mockReturnValue(true)
    api.syncRegistryMock.mockRejectedValue(new Error('offline'))

    await expect(api.ensureAuthenticated()).resolves.toBe(false)

    expect(api.syncRegistryMock).toHaveBeenCalledTimes(1)
  })

  it('skips the probe when nothing is persisted', async () => {
    const api = new TestAPI()
    api.isAuthenticatedMock.mockReturnValue(false)
    api.hasPersistedSessionMock.mockReturnValue(false)

    await expect(api.ensureAuthenticated()).resolves.toBe(false)

    expect(api.syncRegistryMock).not.toHaveBeenCalled()
  })

  it('stays false when the restore probe cannot help', async () => {
    const api = new TestAPI()
    api.isAuthenticatedMock.mockReturnValue(false)

    await expect(api.ensureAuthenticated()).resolves.toBe(false)
  })
})
