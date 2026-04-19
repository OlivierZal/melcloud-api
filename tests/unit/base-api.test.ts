import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  BaseAPIConfig,
  RequestCompleteEvent,
  RequestErrorEvent,
  RequestLifecycleEvents,
  RequestRetryEvent,
  RequestStartEvent,
} from '../../src/api/interfaces.ts'
import type { HttpResponse } from '../../src/http/index.ts'
import { BaseAPI } from '../../src/api/base.ts'
import { RateLimitError } from '../../src/errors/index.ts'
import { HttpClient } from '../../src/http/client.ts'
import {
  cast,
  createHttpError,
  createLogger,
  createServerError,
  createSettingStore,
  createUnauthorizedError,
  mock,
} from '../helpers.ts'

const mockHttpClient = new HttpClient({
  baseURL: 'https://test.api',
  timeout: 30_000,
})
const mockRequest = vi.spyOn(mockHttpClient, 'request')

/**
 * Minimal concrete subclass of BaseAPI used to test the shared
 * request pipeline without any Classic/Home-specific logic.
 */
class TestAPI extends BaseAPI {
  public readonly doAuthenticateMock = vi.fn<() => Promise<void>>()

  public readonly ensureSessionMock = vi.fn<() => Promise<void>>()

  public readonly getAuthHeadersMock = vi.fn<() => Record<string, string>>()

  public readonly retryAuthMock =
    vi.fn<
      (
        method: string,
        url: string,
        config: Record<string, unknown>,
      ) => Promise<HttpResponse | null>
    >()

  public readonly syncRegistryMock = vi.fn<() => Promise<void>>()

  public readonly tryReuseSessionMock = vi.fn<() => Promise<boolean>>()

  public constructor(
    config: BaseAPIConfig = {},
    {
      shouldUseDefaultTransport = false,
    }: { shouldUseDefaultTransport?: boolean } = {},
  ) {
    super(config, {
      ...(shouldUseDefaultTransport ? {} : { httpClient: mockHttpClient }),
      httpConfig: { baseURL: 'https://test.api', timeout: 30_000 },
      rateLimitHours: 2,
      retryDelay: 1000,
      syncCallback: async () => {
        // stub: sync is exercised by tests that drive it explicitly
      },
    })
    this.getAuthHeadersMock.mockReturnValue({})
    this.ensureSessionMock.mockResolvedValue()
    this.retryAuthMock.mockResolvedValue(null)
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

  /** Expose the protected request for testing. */
  public async callRequest<T = unknown>(
    method: string,
    url: string,
    config: Record<string, unknown> = {},
  ): Promise<HttpResponse<T>> {
    return this.request<T>(method, url, config)
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this -- Abstract stub
  public override isAuthenticated(): boolean {
    return true
  }

  protected override async doAuthenticate(): Promise<void> {
    return this.doAuthenticateMock()
  }

  protected override async ensureSession(): Promise<void> {
    return this.ensureSessionMock()
  }

  protected override getAuthHeaders(): Record<string, string> {
    return this.getAuthHeadersMock()
  }

  protected override async retryAuth<T>(
    method: string,
    url: string,
    config: Record<string, unknown>,
  ): Promise<HttpResponse<T> | null> {
    return cast(await this.retryAuthMock(method, url, config))
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
  // eslint-disable-next-line @typescript-eslint/init-declarations -- Assigned in beforeEach
  let api: TestAPI

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

      expect(mockRequest).toHaveBeenCalledWith(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest matcher returns `any`
        expect.not.objectContaining({ signal: expect.anything() }),
      )
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
      api.retryAuthMock.mockResolvedValueOnce(retryResponse)

      const result = await api.callRequest('get', '/data')

      expect(result.data).toStrictEqual({ retried: true })
      expect(api.retryAuthMock).toHaveBeenCalledTimes(1)
    })

    it('consumes the retry guard so a second 401 is not retried', async () => {
      const retryResponse = mock<HttpResponse>({
        data: {},
        headers: {},
        status: 200,
      })
      mockRequest.mockRejectedValueOnce(createUnauthorizedError('/data'))
      api.retryAuthMock.mockResolvedValueOnce(retryResponse)
      await api.callRequest('get', '/data')

      // Second 401 within the retry delay window
      mockRequest.mockRejectedValueOnce(createUnauthorizedError('/data'))

      await expect(api.callRequest('get', '/data')).rejects.toThrow(
        'Unauthorized',
      )

      // RetryAuth should NOT have been called a second time
      expect(api.retryAuthMock).toHaveBeenCalledTimes(1)
    })

    it('refills the retry guard after the delay', async () => {
      const retryResponse = mock<HttpResponse>({
        data: {},
        headers: {},
        status: 200,
      })
      mockRequest.mockRejectedValueOnce(createUnauthorizedError('/data'))
      api.retryAuthMock.mockResolvedValueOnce(retryResponse)
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
      api.retryAuthMock.mockResolvedValueOnce(retryResponse2)
      const result = await api.callRequest('get', '/data')

      expect(result.data).toStrictEqual({ second: true })
      expect(api.retryAuthMock).toHaveBeenCalledTimes(2)
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
      const events: RequestLifecycleEvents = {
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
      const events: RequestLifecycleEvents = { onRequestError }
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
      const events: RequestLifecycleEvents = {
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

  /*
   * Template contract: `initialize()` is the sole lifecycle entry
   * point that subclass `create()` factories may call. It guarantees
   * that on return, either the persisted session has been reused
   * (tryReuseSession=true and, by contract, registry populated) or
   * `resumeSession()` has run (which itself syncs the registry when
   * credentials are persisted, or is a no-op otherwise). Regression
   * guard for the #1281-class bug on the reuse-session branch that
   * the original PR didn't cover.
   */
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

  /*
   * Contract split: `authenticate(credentials)` is the explicit
   * sign-in entry — it throws on rejection. `resumeSession()` is
   * the best-effort restore entry — it logs and swallows. This
   * describe block pins the observable difference between the two
   * so future refactors cannot collapse them back into a dual-mode
   * function. Subsumes the former `initialize() → runs doAuthenticate
   * + syncRegistry when credentials are persisted` test: the
   * persisted-credentials path is now exercised at its natural unit
   * (resumeSession) rather than through initialize's indirection.
   */
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
})
