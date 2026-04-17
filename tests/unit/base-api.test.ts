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
import type { ClassicLoginCredentials } from '../../src/types/index.ts'
import { RateLimitError } from '../../src/errors/index.ts'
import {
  cast,
  createHttpError,
  createLogger,
  createServerError,
  createUnauthorizedError,
  mock,
} from '../helpers.ts'

const mockHttpClient = {
  baseURL: 'https://test.api',
  post: vi.fn(),
  request: vi.fn(),
  timeout: 30_000,
}

vi.mock(import('../../src/http/client.ts'), async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    /*
     * Vi.mock factories are hoisted; they cannot reference module-scope
     * helpers yet. Rebuild the HttpClient mock with a plain function
     * constructor that forwards every call to the shared
     * `mockHttpClient` instance so every test asserts on the same vi.fn.
     */
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- nominal mismatch with the real HttpClient's private field shape
    HttpClient: function mockHttpClientCtor(this: Record<string, unknown>) {
      Object.assign(this, mockHttpClient)
    } as unknown as typeof original.HttpClient,
  }
})

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Inferred return type of dynamic import class
const createTestAPIClass = async () => {
  const { BaseAPI } = await import('../../src/api/base.ts')

  /**
   * Minimal concrete subclass of BaseAPI used to test the shared
   * request pipeline without any Classic/Home-specific logic.
   */
  return class extends BaseAPI {
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

    public constructor(config: BaseAPIConfig = {}) {
      super(config, {
        httpConfig: { baseURL: 'https://test.api', timeout: 30_000 },
        rateLimitHours: 2,
        retryDelay: 1000,
        // eslint-disable-next-line @typescript-eslint/no-empty-function -- Stub
        syncCallback: async () => {},
      })
      this.getAuthHeadersMock.mockReturnValue({})
      this.ensureSessionMock.mockResolvedValue()
      this.retryAuthMock.mockResolvedValue(null)
    }

    // eslint-disable-next-line @typescript-eslint/class-methods-use-this, @typescript-eslint/require-await -- Abstract stub
    public override async authenticate(
      _context?: ClassicLoginCredentials,
    ): Promise<boolean> {
      return true
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
  }
}

describe('baseAPI shared request pipeline', () => {
  // eslint-disable-next-line @typescript-eslint/init-declarations -- Assigned in beforeEach
  let TestAPI: Awaited<ReturnType<typeof createTestAPIClass>>

  // eslint-disable-next-line @typescript-eslint/init-declarations -- Assigned in beforeEach
  let api: InstanceType<typeof TestAPI>

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockHttpClient.request.mockResolvedValue({
      data: {},
      headers: {},
      status: 200,
    })
    TestAPI = await createTestAPIClass()
    api = new TestAPI()
  })

  afterEach(() => {
    api[Symbol.dispose]()
    vi.useRealTimers()
  })

  describe('abortSignal wiring', () => {
    it('passes an AbortSignal into outgoing requests', async () => {
      const controller = new AbortController()
      api = new TestAPI({ abortSignal: controller.signal })
      await api.callRequest('get', '/data')

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({ signal: controller.signal }),
      )
    })

    it('does not set a signal when no abortSignal is provided', async () => {
      await api.callRequest('get', '/data')

      expect(mockHttpClient.request).toHaveBeenCalledWith(
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
      mockHttpClient.request.mockRejectedValueOnce(
        createUnauthorizedError('/data'),
      )
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
      mockHttpClient.request.mockRejectedValueOnce(
        createUnauthorizedError('/data'),
      )
      api.retryAuthMock.mockResolvedValueOnce(retryResponse)
      await api.callRequest('get', '/data')

      // Second 401 within the retry delay window
      mockHttpClient.request.mockRejectedValueOnce(
        createUnauthorizedError('/data'),
      )

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
      mockHttpClient.request.mockRejectedValueOnce(
        createUnauthorizedError('/data'),
      )
      api.retryAuthMock.mockResolvedValueOnce(retryResponse)
      await api.callRequest('get', '/data')

      // Advance past the retry delay (1000ms)
      vi.advanceTimersByTime(1500)

      // Now a second 401 should trigger retry again
      mockHttpClient.request.mockRejectedValueOnce(
        createUnauthorizedError('/data'),
      )
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

      mockHttpClient.request.mockRejectedValueOnce(
        createServerError(429, '/data'),
      )

      await expect(api.callRequest('get', '/data')).rejects.toThrow(
        'Status 429',
      )

      expect(api.isRateLimited).toBe(true)
    })

    it('throws RateLimitError on subsequent requests when rate limited', async () => {
      mockHttpClient.request.mockRejectedValueOnce(
        createServerError(429, '/data'),
      )

      await expect(api.callRequest('get', '/data')).rejects.toThrow(
        'Status 429',
      )

      await expect(api.callRequest('get', '/data')).rejects.toBeInstanceOf(
        RateLimitError,
      )
    })

    it('resets isRateLimited after the window expires', async () => {
      mockHttpClient.request.mockRejectedValueOnce(
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
      mockHttpClient.request
        .mockRejectedValueOnce(createServerError(503, '/data'))
        .mockResolvedValueOnce({ data: { ok: true }, headers: {}, status: 200 })

      const promise = api.callRequest('get', '/data')
      await vi.advanceTimersByTimeAsync(2000)
      const result = await promise

      expect(result.data).toStrictEqual({ ok: true })
    })

    it('gives up after exhausting the retry budget', async () => {
      mockHttpClient.request
        .mockRejectedValueOnce(createServerError(502, '/data'))
        .mockRejectedValueOnce(createServerError(503, '/data'))
        .mockRejectedValueOnce(createServerError(504, '/data'))
        .mockRejectedValueOnce(createServerError(502, '/data'))
        .mockRejectedValueOnce(createServerError(503, '/data'))

      const promise = api.callRequest('get', '/data')
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- Suppress unhandled rejection warning while timers advance
      promise.catch(() => {})
      await vi.advanceTimersByTimeAsync(30_000)

      await expect(promise).rejects.toThrow('Status 503')
    })

    it('does not retry non-transient 500', async () => {
      mockHttpClient.request.mockRejectedValueOnce(
        createServerError(500, '/data'),
      )

      await expect(api.callRequest('get', '/data')).rejects.toThrow(
        'Status 500',
      )

      // Only one call, no retry
      expect(mockHttpClient.request).toHaveBeenCalledTimes(1)
    })

    it('does not retry on POST', async () => {
      mockHttpClient.request.mockRejectedValueOnce(
        createServerError(503, '/data'),
      )

      await expect(api.callRequest('post', '/data')).rejects.toThrow(
        'Status 503',
      )

      expect(mockHttpClient.request).toHaveBeenCalledTimes(1)
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
      mockHttpClient.request.mockResolvedValue({
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
      mockHttpClient.request.mockRejectedValueOnce(
        createServerError(500, '/data'),
      )

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
      mockHttpClient.request
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
      mockHttpClient.request.mockRejectedValueOnce(
        createServerError(500, '/data'),
      )

      await expect(api.callRequest('get', '/data')).rejects.toThrow(
        'Status 500',
      )

      expect(logger.error).toHaveBeenCalledWith(expect.any(String))
    })

    it('does not log non-HTTP errors via logError', async () => {
      const logger = createLogger()
      api = new TestAPI({ logger })
      mockHttpClient.request.mockRejectedValueOnce(new Error('network failure'))

      await expect(api.callRequest('get', '/data')).rejects.toThrow(
        'network failure',
      )

      expect(logger.error).not.toHaveBeenCalled()
    })
  })

  describe('dispatch with non-object headers', () => {
    it('handles non-object headers value gracefully', async () => {
      api.getAuthHeadersMock.mockReturnValue({ 'X-Auth': 'tok' })
      mockHttpClient.request.mockResolvedValue({
        data: {},
        headers: {},
        status: 200,
      })

      // Pass a non-object headers value (e.g. a string) to cover line 160
      await api.callDispatch('get', '/data', {
        headers: cast('not-an-object'),
      })

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { 'X-Auth': 'tok' },
        }),
      )
    })

    it('merges object headers with auth headers', async () => {
      api.getAuthHeadersMock.mockReturnValue({ 'X-Auth': 'tok' })
      mockHttpClient.request.mockResolvedValue({
        data: {},
        headers: {},
        status: 200,
      })

      await api.callDispatch('get', '/data', {
        headers: { 'X-Custom': 'val' },
      })

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { 'X-Auth': 'tok', 'X-Custom': 'val' },
        }),
      )
    })
  })

  describe('async disposal', () => {
    it('exposes Symbol.asyncDispose for `await using` syntax', async () => {
      const disposeSpy = vi.spyOn(api, Symbol.dispose)

      await api[Symbol.asyncDispose]()

      expect(disposeSpy).toHaveBeenCalledTimes(1)
    })

    it('tolerates being called again after Symbol.dispose', async () => {
      api[Symbol.dispose]()

      await expect(api[Symbol.asyncDispose]()).resolves.toBeUndefined()
    })
  })
})
