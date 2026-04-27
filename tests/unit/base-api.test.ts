import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  BaseAPIConfig,
  LifecycleEvents,
  RequestCompleteEvent,
  RequestErrorEvent,
  RequestRetryEvent,
  RequestStartEvent,
} from '../../src/api/types.ts'
import { BaseAPI, normalizeUnauthorized } from '../../src/api/base.ts'
import { AuthenticationError, RateLimitError } from '../../src/errors/index.ts'
import { type HttpResponse, HttpError } from '../../src/http/index.ts'
import {
  cast,
  createHttpError,
  createLogger,
  createMockHttpClient,
  createServerError,
  createSettingStore,
  createUnauthorizedError,
  mock,
} from '../helpers.ts'

const { client: mockHttpClient, requestSpy: mockRequest } =
  createMockHttpClient('https://test.api')

/**
 * Minimal concrete subclass of BaseAPI used to test the shared
 * request pipeline without any Classic/Home-specific logic.
 */
class TestAPI extends BaseAPI {
  public readonly doAuthenticateMock = vi.fn<() => Promise<void>>()

  public readonly getAuthHeadersMock = vi.fn<() => Record<string, string>>()

  public readonly isAuthenticatedMock = vi.fn<() => boolean>()

  public readonly needsSessionRefreshMock = vi.fn<() => boolean>()

  public readonly performSessionRefreshMock = vi.fn<() => Promise<void>>()

  public readonly reauthenticateMock = vi.fn<() => Promise<boolean>>()

  public readonly syncRegistryMock = vi.fn<() => Promise<void>>()

  public readonly tryReuseSessionMock = vi.fn<() => Promise<boolean>>()

  public constructor(
    config: BaseAPIConfig = {},
    {
      shouldUseDefaultTransport = false,
    }: { shouldUseDefaultTransport?: boolean } = {},
  ) {
    super(
      shouldUseDefaultTransport ? config : (
        { transport: mockHttpClient, ...config }
      ),
      {
        defaultSyncIntervalMinutes: false,
        httpConfig: { baseURL: 'https://test.api' },
        rateLimitHours: 2,
        syncCallback: async () => {
          // stub: sync is exercised by tests that drive it explicitly
        },
      },
    )
    this.getAuthHeadersMock.mockReturnValue({})
    this.isAuthenticatedMock.mockReturnValue(true)
    this.needsSessionRefreshMock.mockReturnValue(false)
    this.performSessionRefreshMock.mockResolvedValue()
    this.reauthenticateMock.mockResolvedValue(false)
    this.doAuthenticateMock.mockResolvedValue()
    this.syncRegistryMock.mockResolvedValue()
    this.tryReuseSessionMock.mockResolvedValue(false)
  }

  /** Expose the protected dispatch for direct testing. */
  public async callDispatch<T = unknown>(
    method: string,
    url: string,
    config: Record<string, unknown> = {},
  ): Promise<HttpResponse<T>> {
    return this.dispatch<T>(method, url, config)
  }

  /** Expose the protected ensureSession for direct testing. */
  public async callEnsureSession(): Promise<void> {
    return this.ensureSession()
  }

  /** Expose the protected request for testing. */
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

  protected override async doAuthenticate(): Promise<void> {
    return this.doAuthenticateMock()
  }

  protected override getAuthHeaders(): Record<string, string> {
    return this.getAuthHeadersMock()
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

  protected override async syncRegistry(): Promise<void> {
    return this.syncRegistryMock()
  }

  protected override async tryReuseSession(): Promise<boolean> {
    return this.tryReuseSessionMock()
  }
}

/**
 * Build a {@link TestAPI} instance wired to an in-memory
 * SettingManager holding `{ username, password }`. Used by the
 * `authenticate() vs resumeSession() contract` tests that need a
 * persisted-credentials scenario.
 */
const apiWithPersistedCredentials = (
  overrides: Partial<BaseAPIConfig> = {},
): TestAPI =>
  new TestAPI({
    settingManager: createSettingStore({ password: 'p', username: 'u' })
      .settingManager,
    ...overrides,
  })

describe('baseAPI shared request pipeline', () => {
  let api: TestAPI = cast(null)

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockRequest.mockResolvedValue({
      data: {},
      headers: {},
      status: 200,
    })
    api = new TestAPI()
  })

  afterEach(() => {
    api[Symbol.dispose]()
    vi.useRealTimers()
  })

  describe('hTTP transport defaults', () => {
    it('defaults to a fetch-backed HttpClient when no transport is injected', () => {
      const instance = new TestAPI({}, { shouldUseDefaultTransport: true })

      expect(instance).toBeDefined()

      instance[Symbol.dispose]()
    })
  })

  describe('abortSignal wiring', () => {
    it('passes an AbortSignal into outgoing requests', async () => {
      const controller = new AbortController()
      api = new TestAPI({ abortSignal: controller.signal })
      await api.callRequest('get', '/data')

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ signal: controller.signal }),
      )
    })

    it('does not set a signal when no abortSignal is provided', async () => {
      await api.callRequest('get', '/data')

      expect(mockRequest.mock.lastCall?.[0]).not.toHaveProperty('signal')
    })
  })

  describe('401 retry', () => {
    it('retries on 401 via shouldRetryAuth + retryAuth', async () => {
      const retryResponse = mock<HttpResponse>({
        data: { retried: true },
        headers: {},
        status: 200,
      })
      mockRequest.mockRejectedValueOnce(createUnauthorizedError('/data'))
      api.reauthenticateMock.mockResolvedValueOnce(true)
      mockRequest.mockResolvedValueOnce(retryResponse)

      const result = await api.callRequest('get', '/data')

      expect(result.data).toStrictEqual({ retried: true })
      expect(api.reauthenticateMock).toHaveBeenCalledTimes(1)
    })

    it('consumes the retry guard so a second 401 is not retried', async () => {
      const retryResponse = mock<HttpResponse>({
        data: {},
        headers: {},
        status: 200,
      })
      mockRequest.mockRejectedValueOnce(createUnauthorizedError('/data'))
      api.reauthenticateMock.mockResolvedValueOnce(true)
      mockRequest.mockResolvedValueOnce(retryResponse)
      await api.callRequest('get', '/data')

      // Second 401 within the retry delay window
      mockRequest.mockRejectedValueOnce(createUnauthorizedError('/data'))

      await expect(api.callRequest('get', '/data')).rejects.toThrow(
        'Unauthorized',
      )

      // RetryAuth should NOT have been called a second time
      expect(api.reauthenticateMock).toHaveBeenCalledTimes(1)
    })

    it('refills the retry guard after the delay', async () => {
      const retryResponse = mock<HttpResponse>({
        data: {},
        headers: {},
        status: 200,
      })
      mockRequest.mockRejectedValueOnce(createUnauthorizedError('/data'))
      api.reauthenticateMock.mockResolvedValueOnce(true)
      mockRequest.mockResolvedValueOnce(retryResponse)
      await api.callRequest('get', '/data')

      // Advance past the retry delay (1000ms)
      vi.advanceTimersByTime(1500)

      // Now a second 401 should trigger retry again
      mockRequest.mockRejectedValueOnce(createUnauthorizedError('/data'))
      const retryResponse2 = mock<HttpResponse>({
        data: { second: true },
        headers: {},
        status: 200,
      })
      api.reauthenticateMock.mockResolvedValueOnce(true)
      mockRequest.mockResolvedValueOnce(retryResponse2)
      const result = await api.callRequest('get', '/data')

      expect(result.data).toStrictEqual({ second: true })
      expect(api.reauthenticateMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('429 rate limiting', () => {
    it('records rate limit on 429 and sets isRateLimited', async () => {
      expect(api.isRateLimited).toBe(false)

      mockRequest.mockRejectedValueOnce(createServerError(429, '/data'))

      await expect(api.callRequest('get', '/data')).rejects.toThrow(
        'Status 429',
      )

      expect(api.isRateLimited).toBe(true)
    })

    it('throws RateLimitError on subsequent requests when rate limited', async () => {
      mockRequest.mockRejectedValueOnce(createServerError(429, '/data'))

      await expect(api.callRequest('get', '/data')).rejects.toThrow(
        'Status 429',
      )

      await expect(api.callRequest('get', '/data')).rejects.toBeInstanceOf(
        RateLimitError,
      )
    })

    it('resets isRateLimited after the window expires', async () => {
      mockRequest.mockRejectedValueOnce(
        createHttpError({
          message: 'Status 429',
          responseHeaders: { 'retry-after': '2' },
          status: 429,
          url: '/data',
        }),
      )

      await expect(api.callRequest('get', '/data')).rejects.toThrow(
        'Status 429',
      )

      expect(api.isRateLimited).toBe(true)

      // Advance past the retry-after window
      vi.advanceTimersByTime(3000)

      expect(api.isRateLimited).toBe(false)
    })
  })

  describe('transient 5xx retry on GET', () => {
    it('retries a 503 on GET and succeeds on the next attempt', async () => {
      mockRequest
        .mockRejectedValueOnce(createServerError(503, '/data'))
        .mockResolvedValueOnce({ data: { ok: true }, headers: {}, status: 200 })

      const promise = api.callRequest('get', '/data')
      await vi.advanceTimersByTimeAsync(2000)
      const result = await promise

      expect(result.data).toStrictEqual({ ok: true })
    })

    it('gives up after exhausting the retry budget', async () => {
      mockRequest
        .mockRejectedValueOnce(createServerError(502, '/data'))
        .mockRejectedValueOnce(createServerError(503, '/data'))
        .mockRejectedValueOnce(createServerError(504, '/data'))
        .mockRejectedValueOnce(createServerError(502, '/data'))
        .mockRejectedValueOnce(createServerError(503, '/data'))

      const promise = api.callRequest('get', '/data')
      promise.catch(() => {
        // attached to suppress unhandled-rejection while timers advance
      })
      await vi.advanceTimersByTimeAsync(30_000)

      await expect(promise).rejects.toThrow('Status 503')
    })

    it('does not retry non-transient 500', async () => {
      mockRequest.mockRejectedValueOnce(createServerError(500, '/data'))

      await expect(api.callRequest('get', '/data')).rejects.toThrow(
        'Status 500',
      )

      // Only one call, no retry
      expect(mockRequest).toHaveBeenCalledTimes(1)
    })

    it('does not retry on POST', async () => {
      mockRequest.mockRejectedValueOnce(createServerError(503, '/data'))

      await expect(api.callRequest('post', '/data')).rejects.toThrow(
        'Status 503',
      )

      expect(mockRequest).toHaveBeenCalledTimes(1)
    })
  })

  describe('event emission', () => {
    it('emits onRequestStart and onRequestComplete pair', async () => {
      const onRequestStart = vi.fn<(event: RequestStartEvent) => void>()
      const onRequestComplete = vi.fn<(event: RequestCompleteEvent) => void>()
      const events: LifecycleEvents = {
        onRequestComplete,
        onRequestStart,
      }
      api = new TestAPI({ events })
      mockRequest.mockResolvedValue({
        data: {},
        headers: {},
        status: 200,
      })

      await api.callRequest('get', '/data')

      expect(onRequestStart).toHaveBeenCalledTimes(1)
      expect(onRequestComplete).toHaveBeenCalledTimes(1)

      const startEvent = onRequestStart.mock.calls[0]?.[0]
      const completeEvent = onRequestComplete.mock.calls[0]?.[0]

      expect(startEvent?.correlationId).toBeTypeOf('string')
      expect(startEvent?.method).toBe('GET')
      expect(startEvent?.url).toBe('/data')
      expect(completeEvent?.correlationId).toBe(startEvent?.correlationId)
      expect(completeEvent?.status).toBe(200)
      expect(completeEvent?.durationMs).toBeTypeOf('number')
    })

    it('emits onRequestError when a request fails', async () => {
      const onRequestError = vi.fn<(event: RequestErrorEvent) => void>()
      const events: LifecycleEvents = { onRequestError }
      api = new TestAPI({ events })
      mockRequest.mockRejectedValueOnce(createServerError(500, '/data'))

      await expect(api.callRequest('get', '/data')).rejects.toThrow(
        'Status 500',
      )

      expect(onRequestError).toHaveBeenCalledTimes(1)
    })

    it('emits onRequestRetry on transient retry', async () => {
      const onRequestStart = vi.fn<(event: RequestStartEvent) => void>()
      const onRequestComplete = vi.fn<(event: RequestCompleteEvent) => void>()
      const onRequestRetry = vi.fn<(event: RequestRetryEvent) => void>()
      const events: LifecycleEvents = {
        onRequestComplete,
        onRequestRetry,
        onRequestStart,
      }
      api = new TestAPI({ events })
      mockRequest
        .mockRejectedValueOnce(createServerError(503, '/data'))
        .mockResolvedValueOnce({ data: {}, headers: {}, status: 200 })

      const promise = api.callRequest('get', '/data')
      await vi.advanceTimersByTimeAsync(2000)
      await promise

      expect(onRequestStart).toHaveBeenCalledTimes(1)
      expect(onRequestRetry).toHaveBeenCalledTimes(1)
      expect(onRequestComplete).toHaveBeenCalledTimes(1)

      const startEvent = onRequestStart.mock.calls[0]?.[0]
      const retryEvent = onRequestRetry.mock.calls[0]?.[0]
      const completeEvent = onRequestComplete.mock.calls[0]?.[0]

      expect(retryEvent?.correlationId).toBe(startEvent?.correlationId)
      expect(completeEvent?.correlationId).toBe(startEvent?.correlationId)
      expect(retryEvent?.attempt).toBe(1)
      expect(retryEvent?.delayMs).toBeTypeOf('number')
    })
  })

  describe('error logging', () => {
    it('logs HTTP errors via logError', async () => {
      const logger = createLogger()
      api = new TestAPI({ logger })
      mockRequest.mockRejectedValueOnce(createServerError(500, '/data'))

      await expect(api.callRequest('get', '/data')).rejects.toThrow(
        'Status 500',
      )

      expect(logger.error).toHaveBeenCalledWith(expect.any(String))
    })

    it('does not log non-HTTP errors via logError', async () => {
      const logger = createLogger()
      api = new TestAPI({ logger })
      mockRequest.mockRejectedValueOnce(new Error('network failure'))

      await expect(api.callRequest('get', '/data')).rejects.toThrow(
        'network failure',
      )

      expect(logger.error).not.toHaveBeenCalled()
    })
  })

  describe('dispatch with non-object headers', () => {
    it('handles non-object headers value gracefully', async () => {
      api.getAuthHeadersMock.mockReturnValue({ 'X-Auth': 'tok' })
      mockRequest.mockResolvedValue({
        data: {},
        headers: {},
        status: 200,
      })

      // Pass a non-object headers value (e.g. a string) to cover line 160
      await api.callDispatch('get', '/data', {
        headers: cast('not-an-object'),
      })

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { 'X-Auth': 'tok' },
        }),
      )
    })

    it('merges object headers with auth headers', async () => {
      api.getAuthHeadersMock.mockReturnValue({ 'X-Auth': 'tok' })
      mockRequest.mockResolvedValue({
        data: {},
        headers: {},
        status: 200,
      })

      await api.callDispatch('get', '/data', {
        headers: { 'X-Custom': 'val' },
      })

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { 'X-Auth': 'tok', 'X-Custom': 'val' },
        }),
      )
    })
  })

  // Template contract: `initialize()` is the sole lifecycle entry
  // point that subclass `create()` factories may call. It guarantees
  // that on return, either the persisted session has been reused
  // (tryReuseSession=true and, by contract, registry populated) or
  // `resumeSession()` has run (which itself syncs the registry when
  // credentials are persisted, or is a no-op otherwise). Regression
  // guard for the #1281-class bug on the reuse-session branch that
  // the original PR didn't cover.
  describe('initialize() template', () => {
    it('exits early when tryReuseSession returns true', async () => {
      api.tryReuseSessionMock.mockResolvedValueOnce(true)

      await api.initialize()

      expect(api.tryReuseSessionMock).toHaveBeenCalledTimes(1)
      expect(api.doAuthenticateMock).not.toHaveBeenCalled()
      expect(api.syncRegistryMock).not.toHaveBeenCalled()
    })

    it('falls through to resumeSession when tryReuseSession returns false', async () => {
      api.tryReuseSessionMock.mockResolvedValueOnce(false)

      await api.initialize()

      expect(api.tryReuseSessionMock).toHaveBeenCalledTimes(1)

      // resumeSession() without persisted credentials is a silent
      // no-op — doAuthenticate is only reached when credentials are
      // persisted (see `resumeSession() returns true ...` below).
      expect(api.doAuthenticateMock).not.toHaveBeenCalled()
    })
  })

  // Contract split: `authenticate(credentials)` is the explicit
  // sign-in entry — it throws on rejection. `resumeSession()` is
  // the best-effort restore entry — it logs and swallows. This
  // describe block pins the observable difference between the two
  // so future refactors cannot collapse them back into a dual-mode
  // function. Subsumes the former `initialize() → runs doAuthenticate
  // + syncRegistry when credentials are persisted` test: the
  // persisted-credentials path is now exercised at its natural unit
  // (resumeSession) rather than through initialize's indirection.
  describe('authenticate() vs resumeSession() contract', () => {
    it('authenticate() throws when doAuthenticate rejects', async () => {
      api.doAuthenticateMock.mockRejectedValueOnce(new Error('rejected'))

      await expect(
        api.authenticate({ password: 'p', username: 'u' }),
      ).rejects.toThrow('rejected')
      expect(api.syncRegistryMock).not.toHaveBeenCalled()
    })

    it('authenticate() syncs the registry on success', async () => {
      await api.authenticate({ password: 'p', username: 'u' })

      expect(api.doAuthenticateMock).toHaveBeenCalledTimes(1)
      expect(api.syncRegistryMock).toHaveBeenCalledTimes(1)
    })

    it('resumeSession() returns false with no persisted credentials', async () => {
      const isResumed = await api.resumeSession()

      expect(isResumed).toBe(false)
      expect(api.doAuthenticateMock).not.toHaveBeenCalled()
    })

    it('resumeSession() logs + returns false when sign-in fails', async () => {
      const logger = createLogger()
      api = apiWithPersistedCredentials({ logger })
      api.doAuthenticateMock.mockRejectedValueOnce(new Error('rejected'))

      const isResumed = await api.resumeSession()

      expect(isResumed).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(
        'Session resume failed:',
        expect.any(Error),
      )
    })

    it('resumeSession() returns true and syncs registry on success', async () => {
      api = apiWithPersistedCredentials()

      const isResumed = await api.resumeSession()

      expect(isResumed).toBe(true)
      expect(api.doAuthenticateMock).toHaveBeenCalledTimes(1)
      expect(api.syncRegistryMock).toHaveBeenCalledTimes(1)
    })
  })

  // `ensureSession` is the template method that every `request()` goes
  // through. Two guarantees to pin: (1) the concurrent-refresh mutex
  // dedups callers — N parallel requests on an expired session
  // trigger exactly one `performSessionRefresh`; (2) an early-out path
  // when the session is still fresh (no hook invocation at all).
  describe('ensureSession() template', () => {
    it('is a no-op when needsSessionRefresh returns false', async () => {
      api.needsSessionRefreshMock.mockReturnValue(false)

      await api.callEnsureSession()

      expect(api.performSessionRefreshMock).not.toHaveBeenCalled()
    })

    it('dedupes concurrent refresh calls via in-flight promise', async () => {
      api.needsSessionRefreshMock.mockReturnValue(true)
      let refreshCalls = 0
      api.performSessionRefreshMock.mockImplementation(async () => {
        refreshCalls += 1
        await Promise.resolve()
      })

      await Promise.all([
        api.callEnsureSession(),
        api.callEnsureSession(),
        api.callEnsureSession(),
      ])

      expect(refreshCalls).toBe(1)
    })

    it('releases the in-flight slot after the refresh resolves', async () => {
      api.needsSessionRefreshMock.mockReturnValue(true)
      api.performSessionRefreshMock.mockResolvedValue()

      await api.callEnsureSession()
      await api.callEnsureSession()

      expect(api.performSessionRefreshMock).toHaveBeenCalledTimes(2)
    })

    it('releases the in-flight slot even if the refresh rejects', async () => {
      api.needsSessionRefreshMock.mockReturnValue(true)
      api.performSessionRefreshMock.mockRejectedValueOnce(new Error('boom'))
      api.performSessionRefreshMock.mockResolvedValueOnce()

      await expect(api.callEnsureSession()).rejects.toThrow('boom')

      await api.callEnsureSession()

      expect(api.performSessionRefreshMock).toHaveBeenCalledTimes(2)
    })
  })

  // Pins the "non-throwing observer" contract at the BaseAPI boundary.
  // A buggy `events.onSyncComplete` callback (sync throw OR async
  // rejection) must NEVER break the caller — `notifySync` resolves
  // cleanly and the error lands in the logger. This invariant is what
  // lets `@syncDevices`-decorated mutations (updatePower, updateValues,
  // etc.) succeed even when an observer crashes; without it, a single
  // misbehaving listener would silently fail every mutation that
  // touches the sync cascade.
  describe('observer error isolation', () => {
    it('swallows synchronous throws from events.onSyncComplete', async () => {
      const logger = createLogger()
      api[Symbol.dispose]()
      api = new TestAPI({
        events: {
          // `mockImplementation` lets us register a sync-throwing body
          // against a callback that's typed `() => Promise<void>` —
          // neither `(): Promise<void> => { throw … }` (triggers
          // `promise-function-async`) nor `async () => { throw … }`
          // (triggers `require-await`) is lint-clean.
          onSyncComplete: vi
            .fn<NonNullable<LifecycleEvents['onSyncComplete']>>()
            .mockImplementation(() => {
              throw new Error('observer rogue')
            }),
        },
        logger,
      })

      await expect(api.notifySync({})).resolves.toBeUndefined()
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('onSyncComplete'),
        expect.any(Error),
      )
    })

    it('swallows async rejections from events.onSyncComplete', async () => {
      const logger = createLogger()
      api[Symbol.dispose]()
      api = new TestAPI({
        events: {
          onSyncComplete: vi
            .fn<NonNullable<LifecycleEvents['onSyncComplete']>>()
            .mockRejectedValue(new Error('observer rejected')),
        },
        logger,
      })

      await api.notifySync({})
      // The emitter chains `.catch(...)` onto the rejected promise — give
      // the microtask a turn before asserting the log fired.
      await Promise.resolve()

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('onSyncComplete'),
        expect.any(Error),
      )
    })
  })
})

// Direct-unit coverage for the `normalizeUnauthorized` helper. Its
// only other exercise is through `HomeAPI.doAuthenticate`, where the
// OIDC mock stack can mask subtle branching. Pinning the contract
// here keeps the three error classes (401 HttpError, non-401
// HttpError, non-HttpError) traceable in isolation.
describe(normalizeUnauthorized, () => {
  it('wraps a 401 HttpError into AuthenticationError with original as cause', () => {
    const http = new HttpError(
      'Unauthorized',
      { data: undefined, headers: {}, status: 401 },
      { url: '/context' },
    )

    const result = normalizeUnauthorized(http)

    expect(result).toBeInstanceOf(AuthenticationError)
    expect(result).toMatchObject({ cause: http })
  })

  it('passes non-401 HttpErrors through unchanged', () => {
    const http = new HttpError(
      'Server error',
      { data: undefined, headers: {}, status: 500 },
      { url: '/context' },
    )

    expect(normalizeUnauthorized(http)).toBe(http)
  })

  it('passes non-HttpError errors through unchanged', () => {
    const native = new Error('network')

    expect(normalizeUnauthorized(native)).toBe(native)
  })
})
