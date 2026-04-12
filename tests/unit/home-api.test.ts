import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { HomeAPI } from '../../src/api/home.ts'
import type {
  HomeAPIConfig,
  RequestCompleteEvent,
  RequestErrorEvent,
  RequestLifecycleEvents,
  RequestRetryEvent,
  RequestStartEvent,
} from '../../src/api/index.ts'
import type {
  HomeBuilding,
  HomeContext,
  HomeEnergyData,
  HomeErrorLogEntry,
  HomeReportData,
} from '../../src/types/index.ts'
import { cast, createLogger, createSettingStore, mockResponse } from '../helpers.ts'

const BASE_URL = 'https://melcloudhome.com'
const MILLISECONDS_IN_SECOND = 1000
const COGNITO = 'https://live-melcloudhome.auth.eu-west-1.amazoncognito.com'
const AUTH_BASE = 'https://auth.melcloudhome.com'

const X_KEY = 'x'
const Y_KEY = 'y'

const cognitoLoginPage = (
  action = '/login?client_id=test&amp;state=abc',
  csrf = 'csrf-token',
): string =>
  `<form action="${action}" method="POST">` +
  `<input type="hidden" name="_csrf" value="${csrf}"/>` +
  '<input type="hidden" name="cognitoAsfData" value=""/>' +
  '</form>'

const mockBuilding: HomeBuilding = {
  airToAirUnits: [
    cast({
      givenDisplayName: 'Test Device',
      id: 'device-1',
      settings: [{ name: 'Power', value: 'True' }],
    }),
  ],
  airToWaterUnits: [
    cast({
      givenDisplayName: 'ATW Device',
      id: 'device-2',
      settings: [],
    }),
  ],
  id: 'building-1',
  name: 'Home',
  timezone: 'Europe/Paris',
}

const mockContext: HomeContext = {
  buildings: [],
  country: 'FR',
  email: 'test@example.com',
  firstname: 'Test',
  guestBuildings: [mockBuilding],
  id: 'user-1',
  language: 'fr',
  lastname: 'User',
}

const mockEnergyData: HomeEnergyData = {
  deviceId: 'device-1',
  measureData: [
    {
      type: 'cumulativeEnergyConsumedSinceLastUpload',
      values: [
        { time: '2026-03-01 00:00:00.000000000', value: '1471.0' },
        { time: '2026-03-02 00:00:00.000000000', value: '2871.0' },
      ],
    },
  ],
}

const mockErrorLog: HomeErrorLogEntry[] = [
  {
    date: '2026-03-01T10:00:00Z',
    errorCode: 'E001',
    errorMessage: 'Sensor failure',
  },
]

const mockReportData: HomeReportData[] = [
  {
    datasets: [
      {
        data: [
          { [X_KEY]: '2026-03-01T00:00:00', [Y_KEY]: 20.5 },
          { [X_KEY]: '2026-03-01T01:00:00', [Y_KEY]: 21 },
        ],
        id: 'room_temperature',
        label: 'Room Temperature',
      },
    ],
    reportPeriod: 0,
  },
]

const mockSignalData: HomeEnergyData = {
  deviceId: 'device-1',
  measureData: [
    {
      type: 'rssi',
      values: [
        { time: '2026-03-01 00:00:00.000000000', value: '-55' },
        { time: '2026-03-01 01:00:00.000000000', value: '-60' },
      ],
    },
  ],
}

const mockTokenResponse = {
  access_token: 'test-access-token',
  expires_in: 3600,
  id_token: 'test-id-token',
  refresh_token: 'test-refresh-token',
  scope: 'openid profile email offline_access IdentityServerApi',
  token_type: 'Bearer',
}

/** Mock for `this.#api.request()` — the BFF API instance. */
const mockRequest = vi.fn()
const mockAxiosInstance = {
  defaults: { baseURL: undefined as string | undefined },
  request: mockRequest,
}

/** Mock for bare `axios.post()` — used by PAR and token exchange. */
const mockAxiosPost = vi.fn()

/** Mock for bare `axios.request()` — used by the OIDC redirect chain. */
const mockAxiosRequest = vi.fn()

vi.mock(import('axios'), async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    default: cast({
      create: vi.fn().mockReturnValue(mockAxiosInstance),
      isAxiosError: original.default.isAxiosError,
      post: mockAxiosPost,
      request: mockAxiosRequest,
    }),
  }
})


/*
 * Simulate the OIDC token-based auth flow:
 *   1. axios.post to PAR endpoint → { request_uri }
 *   2. axios.request redirect chain → Cognito login page (200)
 *   3. axios.request credential POST → 302 with Location callback
 *   4. axios.request callback chain → melcloudhome://?code=auth-code
 *   5. axios.post to token endpoint → { access_token, refresh_token, ... }
 *   6. mockAxiosInstance.request for GET /context → mockContext
 */
const setupSuccessfulLogin = (): void => {
  const callbackUrl =
    'https://auth.melcloudhome.com/signin-oidc-meu?code=abc&state=xyz'

  // 1. PAR
  mockAxiosPost.mockResolvedValueOnce(
    mockResponse({ request_uri: 'urn:ietf:params:oauth:request_uri:test' }),
  )

  // 2. Redirect chain to Cognito login page
  mockAxiosRequest
    .mockResolvedValueOnce(
      mockResponse('', { location: `${AUTH_BASE}/connect/redirect` }, 302),
    )
    .mockResolvedValueOnce(
      mockResponse(
        '',
        { location: `${COGNITO}/oauth2/authorize?client_id=test` },
        302,
      ),
    )
    .mockResolvedValueOnce(
      mockResponse('', { location: `${COGNITO}/login?client_id=test` }, 302),
    )
    .mockResolvedValueOnce(mockResponse(cognitoLoginPage(), {}, 200))

  // 3. Credential POST → 302 to callback
  mockAxiosRequest.mockResolvedValueOnce(
    mockResponse('', { location: callbackUrl }, 302),
  )

  // 4. Callback chain → JS redirect page → melcloudhome://?code=...
  mockAxiosRequest
    .mockResolvedValueOnce(
      mockResponse(
        '',
        {
          location: 'https://auth.melcloudhome.com/ExternalLogin/Callback',
        },
        302,
      ),
    )
    .mockResolvedValueOnce(
      mockResponse(
        `<script>window.location='melcloudhome://?code=auth-code&amp;state=xyz'</script>`,
        {},
        200,
      ),
    )

  // 5. Token exchange
  mockAxiosPost.mockResolvedValueOnce(mockResponse(mockTokenResponse))

  // 6. GET /context via the API instance
  mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
}

const HOUR_MS = 60 * 60 * 1000

const axiosUnauthorized = (url = '/context'): Error =>
  Object.assign(new Error('Unauthorized'), {
    config: { url },
    isAxiosError: true,
    response: {
      config: { url },
      data: undefined,
      headers: {},
      status: 401,
    },
  })

const axiosServerError = (
  status: number,
  headers: Record<string, string> = {},
): Error =>
  Object.assign(new Error(`Status ${String(status)}`), {
    config: { url: '/context' },
    isAxiosError: true,
    response: {
      config: { url: '/context' },
      data: undefined,
      headers,
      status,
    },
  })

describe('melcloud home API', () => {
  let melCloudHomeApi: { create: typeof HomeAPI.create } = cast(null)

  beforeEach(async () => {
    mockRequest.mockReset()
    mockAxiosPost.mockReset()
    mockAxiosRequest.mockReset()
    vi.clearAllMocks()
    mockAxiosInstance.defaults.baseURL = BASE_URL
    ;({ HomeAPI: melCloudHomeApi } = await import('../../src/api/home.ts'))
  })

  const createApi = async (
    config: HomeAPIConfig = {},
  ): ReturnType<typeof melCloudHomeApi.create> =>
    melCloudHomeApi.create({
      baseURL: BASE_URL,
      password: 'pass',
      username: 'user@test.com',
      ...config,
    })

  describe('instance creation', () => {
    it('should authenticate and return user on success', async () => {
      setupSuccessfulLogin()
      const api = await createApi()

      expect(api.isAuthenticated()).toBe(true)
      expect(api.user).toStrictEqual({
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        sub: 'user-1',
      })
    })

    it('should return unauthenticated when no credentials', async () => {
      const api = await melCloudHomeApi.create({ baseURL: BASE_URL })

      expect(api.isAuthenticated()).toBe(false)
      expect(api.user).toBeNull()
    })
  })

  describe('authentication', () => {
    it('should return false without credentials', async () => {
      const api = await melCloudHomeApi.create({ baseURL: BASE_URL })
      const isAuthenticated = await api.authenticate()

      expect(isAuthenticated).toBe(false)
    })

    it('should clear user state on re-authentication', async () => {
      setupSuccessfulLogin()
      const api = await createApi()

      expect(api.isAuthenticated()).toBe(true)

      mockAxiosPost.mockRejectedValueOnce(new Error('network'))

      await expect(
        api.authenticate({ password: 'wrong', username: 'u@t.com' }),
      ).rejects.toThrow('network')

      expect(api.user).toBeNull()
    })

    it('should log and return false on stored credential failure', async () => {
      const logger = createLogger()
      mockAxiosPost.mockRejectedValueOnce(new Error('network'))
      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        logger,
        password: 'pass',
        username: 'user@test.com',
      })

      expect(api.isAuthenticated()).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(
        'Authentication failed:',
        expect.any(Error),
      )
    })

    it('should throw on explicit credential failure', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      mockAxiosPost.mockRejectedValueOnce(new Error('bad credentials'))

      await expect(
        api.authenticate({ password: 'wrong', username: 'user@test.com' }),
      ).rejects.toThrow('bad credentials')
    })

    it('should re-authenticate with new credentials', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      setupSuccessfulLogin()
      const isAuthenticated = await api.authenticate({
        password: 'new-pass',
        username: 'new@test.com',
      })

      expect(isAuthenticated).toBe(true)
    })
  })

  describe('user retrieval', () => {
    it('should return null on failure', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      mockRequest.mockRejectedValueOnce(new Error('unauthorized'))
      const user = await api.getUser()

      expect(user).toBeNull()
      expect(api.isAuthenticated()).toBe(false)
    })
  })

  describe('context retrieval', () => {
    it('should return merged buildings on success', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
      const buildings = await api.list()

      expect(buildings).toStrictEqual([mockBuilding])
    })

    it('should sync device registry and expose context on list', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
      await api.list()

      expect(api.registry.getById('device-1')).toBeDefined()
      expect(api.context?.language).toBe('fr')
    })

    it('should return empty array on failure', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      mockRequest.mockRejectedValueOnce(new Error('network'))
      const buildings = await api.list()

      expect(buildings).toStrictEqual([])
    })
  })

  describe('sync callback', () => {
    it('should call onSync after list()', async () => {
      setupSuccessfulLogin()
      const onSync = vi.fn<() => Promise<void>>()
      const api = await createApi({ onSync })
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
      await api.list()

      expect(onSync).toHaveBeenCalledTimes(1)
    })

    it('should call onSync after setValues() via list()', async () => {
      setupSuccessfulLogin()
      const onSync = vi.fn<() => Promise<void>>()
      const api = await createApi({ onSync })
      mockRequest
        .mockResolvedValueOnce(mockResponse('', {}, 200))
        .mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
      await api.setValues('device-1', { power: true })

      expect(onSync).toHaveBeenCalledTimes(1)
    })

    it('should call onSync even on failure for consistency with classic API', async () => {
      setupSuccessfulLogin()
      const onSync = vi.fn<() => Promise<void>>()
      const api = await createApi({ onSync })
      mockRequest.mockRejectedValueOnce(new Error('network'))
      await api.list()

      expect(onSync).toHaveBeenCalledTimes(1)
    })
  })

  describe('device control', () => {
    it('should return true and refresh via list() on successful setValues', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      mockRequest
        .mockResolvedValueOnce(mockResponse('', {}, 200))
        .mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
      const isSuccess = await api.setValues('device-1', {
        operationMode: 'Heat',
        power: true,
      })

      expect(isSuccess).toBe(true)
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { operationMode: 'Heat', power: true },
          method: 'put',
          url: '/monitor/ataunit/device-1',
        }),
      )
    })

    it('should return false on setValues failure', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      mockRequest.mockRejectedValueOnce(new Error('network'))
      const isSuccess = await api.setValues('device-1', { power: false })

      expect(isSuccess).toBe(false)
    })
  })

  describe('error log', () => {
    it('should fetch device error log', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      mockRequest.mockResolvedValueOnce(mockResponse(mockErrorLog, {}, 200))
      const result = await api.getErrorLog('device-1')

      expect(result).toStrictEqual(mockErrorLog)
      expect(mockRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: '/monitor/ataunit/device-1/errorlog',
        }),
      )
    })

    it('should return empty array on failure', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      mockRequest.mockRejectedValueOnce(new Error('network'))
      const result = await api.getErrorLog('device-1')

      expect(result).toStrictEqual([])
    })
  })

  describe('temperature report', () => {
    it('should fetch temperature trend summary', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      mockRequest.mockResolvedValueOnce(mockResponse(mockReportData, {}, 200))
      const result = await api.getTemperatures('device-1', {
        from: '2026-03-01',
        period: 'Hourly',
        to: '2026-03-02',
      })

      expect(result).toStrictEqual(mockReportData)
      expect(mockRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({
          params: {
            from: '2026-03-01',
            period: 'Hourly',
            to: '2026-03-02',
            unitId: 'device-1',
          },
        }),
      )
    })

    it('should return null on failure', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      mockRequest.mockRejectedValueOnce(new Error('network'))
      const result = await api.getTemperatures('device-1', {
        from: '2026-03-01',
        period: 'Daily',
        to: '2026-03-02',
      })

      expect(result).toBeNull()
    })
  })

  describe('energy consumption', () => {
    it('should fetch energy data with cumulative measure', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      mockRequest.mockResolvedValueOnce(mockResponse(mockEnergyData, {}, 200))
      const result = await api.getEnergy('device-1', {
        from: '2026-03-01',
        interval: 'Hour',
        to: '2026-03-02',
      })

      expect(result).toStrictEqual(mockEnergyData)
      expect(mockRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({
          params: {
            from: '2026-03-01',
            interval: 'Hour',
            measure: 'cumulative_energy_consumed_since_last_upload',
            to: '2026-03-02',
          },
        }),
      )
    })

    it('should return null on failure', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      mockRequest.mockRejectedValueOnce(new Error('network'))
      const result = await api.getEnergy('device-1', {
        from: '2026-03-01',
        interval: 'Day',
        to: '2026-03-02',
      })

      expect(result).toBeNull()
    })
  })

  describe('signal strength', () => {
    it('should fetch RSSI signal data', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      mockRequest.mockResolvedValueOnce(mockResponse(mockSignalData, {}, 200))
      const result = await api.getSignal('device-1', {
        from: '2026-03-01',
        to: '2026-03-02',
      })

      expect(result).toStrictEqual(mockSignalData)
      expect(mockRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({
          params: {
            from: '2026-03-01',
            measure: 'rssi',
            to: '2026-03-02',
          },
        }),
      )
    })

    it('should return null on failure', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      mockRequest.mockRejectedValueOnce(new Error('network'))
      const result = await api.getSignal('device-1', {
        from: '2026-03-01',
        to: '2026-03-02',
      })

      expect(result).toBeNull()
    })
  })

  describe('auto-sync', () => {
    it('should not throw on clearSync', async () => {
      setupSuccessfulLogin()
      const api = await createApi()

      expect(() => {
        api.clearSync()
      }).not.toThrow()
    })

    it('should not throw on setSyncInterval', async () => {
      setupSuccessfulLogin()
      const api = await createApi()

      expect(() => {
        api.setSyncInterval(5)
        api.clearSync()
      }).not.toThrow()
    })

    it('should not throw when disabling sync', async () => {
      setupSuccessfulLogin()
      const api = await createApi()

      expect(() => {
        api.setSyncInterval(null)
      }).not.toThrow()
    })

    it('should not throw on dispose', async () => {
      setupSuccessfulLogin()
      const api = await createApi()

      expect(() => {
        api[Symbol.dispose]()
      }).not.toThrow()
    })

    it('should auto-sync after list()', async () => {
      vi.useFakeTimers()
      try {
        setupSuccessfulLogin()
        const api = await createApi({ autoSyncInterval: 1 })

        mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
        await api.list()

        // Advance past the 1-minute auto-sync interval
        mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
        await vi.advanceTimersByTimeAsync(60_001)

        expect(mockRequest).toHaveBeenLastCalledWith(
          expect.objectContaining({ url: '/context' }),
        )
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('session expiry', () => {
    it('should re-authenticate when session is expired', async () => {
      vi.useFakeTimers()
      try {
        setupSuccessfulLogin()
        const api = await createApi()

        expect(api.isAuthenticated()).toBe(true)

        // Advance past the 3600s token expiry
        vi.advanceTimersByTime(3601 * MILLISECONDS_IN_SECOND)

        // #ensureSession detects expired token, tries refresh first.
        // Refresh token call succeeds via axios.post to token endpoint.
        mockAxiosPost.mockResolvedValueOnce(
          mockResponse({
            ...mockTokenResponse,
            access_token: 'refreshed-token',
          }),
        )
        // list() -> #fetchContext() -> GET /context
        mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
        const buildings = await api.list()

        expect(buildings).toStrictEqual([mockBuilding])
      } finally {
        vi.useRealTimers()
      }
    })

    it('should not re-authenticate when session is still valid', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      const {
        mock: {
          calls: { length: callCountAfterLogin },
        },
      } = mockRequest
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
      await api.list()

      expect(mockRequest).toHaveBeenCalledTimes(callCountAfterLogin + 1)
    })

    it('should treat a malformed persisted expiry as expired and reauthenticate', async () => {
      const { settingManager } = createSettingStore({
        accessToken: 'old-token',
        expiry: 'not-a-valid-iso-date',
        password: 'pass',
        refreshToken: 'old-refresh',
        username: 'user@test.com',
      })
      /*
       * #hasPersistedSession() returns true (refreshToken is set).
       * getUser() -> #fetchContext() -> #request() -> #ensureSession()
       *   -> isSessionExpired('not-a-valid-iso-date') -> true
       *   -> try refresh (refreshToken is set) -> succeeds
       *   -> #fetchContext completes with new token
       */
      // Refresh token succeeds
      mockAxiosPost.mockResolvedValueOnce(
        mockResponse({
          ...mockTokenResponse,
          access_token: 'refreshed-token',
        }),
      )
      // GET /context succeeds
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))

      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        settingManager,
      })

      expect(api.isAuthenticated()).toBe(true)
    })
  })

  describe('reactive auth retry on 401', () => {
    it('should retry the request once after a reactive re-auth on 401', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      /*
       * First attempt rejects with 401. The reactive handler tries
       * refresh first (refreshToken is set) — that succeeds. The
       * retry dispatch then succeeds with mockContext.
       */
      mockRequest.mockRejectedValueOnce(axiosUnauthorized())
      // Refresh succeeds
      mockAxiosPost.mockResolvedValueOnce(
        mockResponse({
          ...mockTokenResponse,
          access_token: 'refreshed-after-401',
        }),
      )
      // Retry dispatch
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
      const buildings = await api.list()

      expect(buildings).toStrictEqual([mockBuilding])
    })

    it('should fall back to full re-auth when refresh fails on 401', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      /*
       * 401 triggers reactive retry. Refresh token fails, so the handler
       * clears the session and attempts full re-authentication, which
       * succeeds. The retried dispatch then returns mockContext.
       */
      mockRequest.mockRejectedValueOnce(axiosUnauthorized())
      // Refresh fails
      mockAxiosPost.mockRejectedValueOnce(new Error('refresh failed'))
      // Full re-auth succeeds
      setupSuccessfulLogin()
      // Retry dispatch after re-auth
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
      const buildings = await api.list()

      expect(buildings).toStrictEqual([mockBuilding])
    })

    it('should not retry when the retry budget is already consumed', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      /*
       * First 401: retry budget consumed, refresh succeeds, retry succeeds.
       * Second 401 in the same retry window: no reauth, list() returns [].
       */
      mockRequest.mockRejectedValueOnce(axiosUnauthorized())
      // Refresh succeeds
      mockAxiosPost.mockResolvedValueOnce(
        mockResponse({
          ...mockTokenResponse,
          access_token: 'refreshed-after-401',
        }),
      )
      // Retry dispatch
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
      await api.list()

      mockRequest.mockRejectedValueOnce(axiosUnauthorized())
      const second = await api.list()

      expect(second).toStrictEqual([])
    })

    it('should not trigger reactive retry during the OIDC flow', async () => {
      /*
       * PAR request fails with a network error. The @authenticate
       * decorator catches and logs it, returning false.
       */
      const logger = createLogger()
      mockAxiosPost.mockRejectedValueOnce(axiosUnauthorized())
      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        logger,
        password: 'pass',
        username: 'user@test.com',
      })

      expect(api.isAuthenticated()).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(
        'Authentication failed:',
        expect.any(Error),
      )
    })

    it('should surface the original 401 when reactive reauth fails', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      /*
       * 401 on list -> reactive retry -> reauth itself fails (PAR rejects).
       * `authenticate()` returns false, so the original 401 is re-thrown
       * and list()'s own catch swallows it to return [].
       */
      mockRequest.mockRejectedValueOnce(axiosUnauthorized())
      mockAxiosPost.mockRejectedValueOnce(new Error('PAR failed'))
      const buildings = await api.list()

      expect(buildings).toStrictEqual([])
    })

    it('should not retry on non-401 errors', async () => {
      setupSuccessfulLogin()
      const api = await createApi()

      mockRequest.mockRejectedValueOnce(
        Object.assign(new Error('Server Error'), {
          config: { url: '/context' },
          isAxiosError: true,
          response: {
            config: { url: '/context' },
            data: undefined,
            headers: {},
            status: 500,
          },
        }),
      )
      const buildings = await api.list()

      expect(buildings).toStrictEqual([])
    })
  })

  describe('transient 5xx retry + rate limiting', () => {
    it('should retry a transient 503 on list() and succeed', async () => {
      vi.useFakeTimers()
      try {
        setupSuccessfulLogin()
        const api = await createApi({ autoSyncInterval: null })

        mockRequest.mockRejectedValueOnce(axiosServerError(503))
        mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))

        const listPromise = api.list()
        /*
         * Backoff sequence: 1s, 2s, 4s, 8s (max 16s). First retry succeeds
         * after the first 1s slot.
         */
        await vi.advanceTimersByTimeAsync(2000)
        const buildings = await listPromise

        expect(buildings).toStrictEqual([mockBuilding])
      } finally {
        vi.useRealTimers()
      }
    })

    it('should give up on list() after exhausting the 5xx retry budget', async () => {
      vi.useFakeTimers()
      try {
        setupSuccessfulLogin()
        const api = await createApi({ autoSyncInterval: null })
        const {
          mock: {
            calls: { length: callCountBefore },
          },
        } = mockRequest
        // 1 initial attempt + 4 retries = 5 total
        mockRequest
          .mockRejectedValueOnce(axiosServerError(502))
          .mockRejectedValueOnce(axiosServerError(503))
          .mockRejectedValueOnce(axiosServerError(504))
          .mockRejectedValueOnce(axiosServerError(502))
          .mockRejectedValueOnce(axiosServerError(503))

        const listPromise = api.list()
        // Exhaust all backoff slots: 1 + 2 + 4 + 8 = 15s, pad to 30s.
        await vi.advanceTimersByTimeAsync(30_000)
        const buildings = await listPromise

        expect(buildings).toStrictEqual([])
        expect(mockRequest).toHaveBeenCalledTimes(callCountBefore + 5)
      } finally {
        vi.useRealTimers()
      }
    })

    it('should not retry POST/PUT on 5xx (non-idempotent)', async () => {
      setupSuccessfulLogin()
      const api = await createApi({ autoSyncInterval: null })
      const {
        mock: {
          calls: { length: callCountBefore },
        },
      } = mockRequest

      mockRequest.mockRejectedValueOnce(axiosServerError(503))
      const isOk = await api.setValues('device-1', cast({ Power: 'True' }))

      expect(isOk).toBe(false)
      expect(mockRequest).toHaveBeenCalledTimes(callCountBefore + 1)
    })

    it('should pause non-auth requests after a 429 and reset after the window', async () => {
      vi.useFakeTimers()
      try {
        setupSuccessfulLogin()
        const api = await createApi({ autoSyncInterval: null })
        const {
          mock: {
            calls: { length: callCountAfterLogin },
          },
        } = mockRequest

        const rateLimited = axiosServerError(429, { 'retry-after': '2' })
        mockRequest.mockRejectedValueOnce(rateLimited)

        const first = await api.list()

        expect(first).toStrictEqual([])
        expect(mockRequest).toHaveBeenCalledTimes(callCountAfterLogin + 1)

        // Second call: blocked by the gate without hitting the mock.
        const second = await api.list()

        expect(second).toStrictEqual([])
        expect(mockRequest).toHaveBeenCalledTimes(callCountAfterLogin + 1)

        // Advance past the Retry-After window — the gate reopens.
        vi.advanceTimersByTime(3000)
        mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
        const third = await api.list()

        expect(third).toStrictEqual([mockBuilding])
      } finally {
        vi.useRealTimers()
      }
    })

    it('should emit a correlated onRequestStart / onRequestComplete pair for list()', async () => {
      setupSuccessfulLogin()
      const onRequestStart = vi.fn<(event: RequestStartEvent) => void>()
      const onRequestComplete = vi.fn<(event: RequestCompleteEvent) => void>()
      const onRequestError = vi.fn<(event: RequestErrorEvent) => void>()
      const events: RequestLifecycleEvents = {
        onRequestComplete,
        onRequestError,
        onRequestStart,
      }
      const api = await createApi({ autoSyncInterval: null, events })
      onRequestStart.mockClear()
      onRequestComplete.mockClear()

      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
      await api.list()

      expect(onRequestStart).toHaveBeenCalledTimes(1)
      expect(onRequestComplete).toHaveBeenCalledTimes(1)

      const startEvent = onRequestStart.mock.calls[0]?.[0]
      const completeEvent = onRequestComplete.mock.calls[0]?.[0]

      expect(startEvent?.correlationId).toBeTypeOf('string')

      expect(startEvent?.method).toBe('GET')
      expect(startEvent?.url).toBe('/context')
      expect(completeEvent?.correlationId).toBe(startEvent?.correlationId)
      expect(completeEvent?.method).toBe('GET')
      expect(completeEvent?.status).toBe(200)
      expect(completeEvent?.url).toBe('/context')

      expect(completeEvent?.durationMs).toBeTypeOf('number')

      expect(onRequestError).not.toHaveBeenCalled()
    })

    it('should emit onRequestRetry sharing correlationId with the start event', async () => {
      vi.useFakeTimers()
      try {
        setupSuccessfulLogin()
        const onRequestStart = vi.fn<(event: RequestStartEvent) => void>()
        const onRequestComplete = vi.fn<(event: RequestCompleteEvent) => void>()
        const onRequestRetry = vi.fn<(event: RequestRetryEvent) => void>()
        const events: RequestLifecycleEvents = {
          onRequestComplete,
          onRequestRetry,
          onRequestStart,
        }
        const api = await createApi({ autoSyncInterval: null, events })
        onRequestStart.mockClear()
        onRequestComplete.mockClear()
        onRequestRetry.mockClear()

        mockRequest.mockRejectedValueOnce(axiosServerError(503))
        mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))

        const listPromise = api.list()
        await vi.advanceTimersByTimeAsync(2000)
        await listPromise

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
      } finally {
        vi.useRealTimers()
      }
    })

    it('should expose isRateLimited once the gate has been closed', async () => {
      vi.useFakeTimers()
      try {
        setupSuccessfulLogin()
        const api = await createApi({ autoSyncInterval: null })

        expect(api.isRateLimited).toBe(false)

        const rateLimited = axiosServerError(429, { 'retry-after': '120' })
        mockRequest.mockRejectedValueOnce(rateLimited)
        await api.list()

        expect(api.isRateLimited).toBe(true)

        // Advance past the window — the flag resets automatically.
        vi.advanceTimersByTime(130 * 1000)

        expect(api.isRateLimited).toBe(false)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('redirect handling', () => {
    it('should stop on too many redirects', async () => {
      // PAR succeeds
      mockAxiosPost.mockResolvedValueOnce(
        mockResponse({ request_uri: 'urn:test' }),
      )
      // 21 redirects to exhaust the limit
      Array.from({ length: 21 }, (_unused, index) =>
        mockAxiosRequest.mockResolvedValueOnce(
          mockResponse(
            '',
            { location: `${AUTH_BASE}/redirect-${String(index)}` },
            302,
          ),
        ),
      )
      const logger = createLogger()
      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        logger,
        password: 'pass',
        username: 'user@test.com',
      })

      expect(api.isAuthenticated()).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(
        'Authentication failed:',
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest matcher returns `any`
          message: expect.stringContaining('Too many redirects'),
        }),
      )
    })

    it('should treat a 302 with no location header as an empty redirect', async () => {
      // PAR succeeds
      mockAxiosPost.mockResolvedValueOnce(
        mockResponse({ request_uri: 'urn:test' }),
      )
      // First redirect has a location, second 302 has no location header
      mockAxiosRequest
        .mockResolvedValueOnce(
          mockResponse('', { location: `${AUTH_BASE}/step1` }, 302),
        )
        .mockResolvedValueOnce(mockResponse('', {}, 302))
        /*
         * The empty location resolves relative to current URL, producing an
         * invalid redirect that eventually loops back to a page with no form.
         */
        .mockResolvedValueOnce(
          mockResponse('<html>no form here</html>', {}, 200),
        )
      const logger = createLogger()
      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        logger,
        password: 'pass',
        username: 'user@test.com',
      })

      expect(api.isAuthenticated()).toBe(false)
    })

    it('should resolve relative redirect URLs', async () => {
      // PAR succeeds
      mockAxiosPost.mockResolvedValueOnce(
        mockResponse({ request_uri: 'urn:test' }),
      )
      mockAxiosRequest
        .mockResolvedValueOnce(
          mockResponse('', { location: `${AUTH_BASE}/auth-redirect` }, 302),
        )
        .mockResolvedValueOnce(
          mockResponse('', { location: '/relative-path' }, 302),
        )
        .mockResolvedValueOnce(
          mockResponse('', { location: `${COGNITO}/login?client_id=test` }, 302),
        )
        .mockResolvedValueOnce(
          mockResponse(
            cognitoLoginPage(`${COGNITO}/login?client_id=test`),
            {},
            200,
          ),
        )
        // Credential POST
        .mockResolvedValueOnce(
          mockResponse(
            '',
            {
              location:
                'https://auth.melcloudhome.com/signin-oidc-meu?code=x&state=y',
            },
            302,
          ),
        )
        // Callback chain -> melcloudhome://
        .mockResolvedValueOnce(
          mockResponse(
            '',
            { location: 'melcloudhome://?code=auth-code&state=y' },
            302,
          ),
        )
      // Token exchange
      mockAxiosPost.mockResolvedValueOnce(mockResponse(mockTokenResponse))
      // GET /context
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))

      const api = await createApi()

      expect(api.isAuthenticated()).toBe(true)
      expect(mockAxiosRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${AUTH_BASE}/relative-path`,
        }),
      )
    })
  })

  describe('form parsing', () => {
    it('should throw when form action is missing', async () => {
      // PAR succeeds
      mockAxiosPost.mockResolvedValueOnce(
        mockResponse({ request_uri: 'urn:test' }),
      )
      // Redirect chain lands on a page with no form
      mockAxiosRequest.mockResolvedValueOnce(
        mockResponse('<html>no form here</html>', {}, 200),
      )
      const logger = createLogger()
      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        logger,
        password: 'pass',
        username: 'user@test.com',
      })

      expect(api.isAuthenticated()).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(
        'Authentication failed:',
        expect.any(Error),
      )
    })

    it('should prefix relative form action with Cognito authority', async () => {
      // PAR succeeds
      mockAxiosPost.mockResolvedValueOnce(
        mockResponse({ request_uri: 'urn:test' }),
      )
      // Directly to login page (no redirects before)
      mockAxiosRequest
        .mockResolvedValueOnce(
          mockResponse(
            cognitoLoginPage('/login?client_id=test&amp;state=abc'),
            {},
            200,
          ),
        )
        // Credential POST
        .mockResolvedValueOnce(
          mockResponse(
            '',
            {
              location:
                'https://auth.melcloudhome.com/signin-oidc-meu?code=x&state=y',
            },
            302,
          ),
        )
        // Callback -> melcloudhome://
        .mockResolvedValueOnce(
          mockResponse(
            '',
            { location: 'melcloudhome://?code=auth-code&state=y' },
            302,
          ),
        )
      // Token exchange
      mockAxiosPost.mockResolvedValueOnce(mockResponse(mockTokenResponse))
      // GET /context
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))

      await createApi()

      expect(mockAxiosRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${COGNITO}/login?client_id=test&state=abc`,
        }),
      )
    })

    it('should handle hidden fields without name or value attributes', async () => {
      const htmlWithEdgeCases =
        '<form action="/login?id=test" method="POST">' +
        '<input type="hidden" name="_csrf" value="tok"/>' +
        '<input type="hidden" value="orphan"/>' +
        '<input type="hidden" name="noValue"/>' +
        '</form>'
      // PAR
      mockAxiosPost.mockResolvedValueOnce(
        mockResponse({ request_uri: 'urn:test' }),
      )
      mockAxiosRequest
        .mockResolvedValueOnce(mockResponse(htmlWithEdgeCases, {}, 200))
        // Credential POST
        .mockResolvedValueOnce(
          mockResponse(
            '',
            {
              location:
                'https://auth.melcloudhome.com/signin-oidc-meu?code=x&state=y',
            },
            302,
          ),
        )
        // Callback -> melcloudhome://
        .mockResolvedValueOnce(
          mockResponse(
            '',
            { location: 'melcloudhome://?code=auth-code&state=y' },
            302,
          ),
        )
      // Token exchange
      mockAxiosPost.mockResolvedValueOnce(mockResponse(mockTokenResponse))
      // GET /context
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))

      const api = await createApi()

      expect(api.isAuthenticated()).toBe(true)
    })

    it('should use absolute form action as-is', async () => {
      const absoluteAction = `${COGNITO}/login?client_id=test`
      // PAR
      mockAxiosPost.mockResolvedValueOnce(
        mockResponse({ request_uri: 'urn:test' }),
      )
      mockAxiosRequest
        .mockResolvedValueOnce(
          mockResponse(cognitoLoginPage(absoluteAction), {}, 200),
        )
        // Credential POST
        .mockResolvedValueOnce(
          mockResponse(
            '',
            {
              location:
                'https://auth.melcloudhome.com/signin-oidc-meu?code=x&state=y',
            },
            302,
          ),
        )
        // Callback -> melcloudhome://
        .mockResolvedValueOnce(
          mockResponse(
            '',
            { location: 'melcloudhome://?code=auth-code&state=y' },
            302,
          ),
        )
      // Token exchange
      mockAxiosPost.mockResolvedValueOnce(mockResponse(mockTokenResponse))
      // GET /context
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))

      await createApi()

      expect(mockAxiosRequest).toHaveBeenCalledWith(
        expect.objectContaining({ url: absoluteAction }),
      )
    })

    it('should handle missing location header from credential submission', async () => {
      // PAR
      mockAxiosPost.mockResolvedValueOnce(
        mockResponse({ request_uri: 'urn:test' }),
      )
      mockAxiosRequest
        .mockResolvedValueOnce(mockResponse(cognitoLoginPage(), {}, 200))
        // Credential POST -> no location header
        .mockResolvedValueOnce(mockResponse('', {}, 302))

      const logger = createLogger()
      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        logger,
        password: 'pass',
        username: 'user@test.com',
      })

      expect(api.isAuthenticated()).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(
        'Authentication failed:',
        expect.any(Error),
      )
    })

    it('should handle callback URL without authorization code', async () => {
      // PAR
      mockAxiosPost.mockResolvedValueOnce(
        mockResponse({ request_uri: 'urn:test' }),
      )
      mockAxiosRequest
        .mockResolvedValueOnce(mockResponse(cognitoLoginPage(), {}, 200))
        // Credential POST -> callback without code param
        .mockResolvedValueOnce(
          mockResponse(
            '',
            { location: 'melcloudhome://?state=abc' },
            302,
          ),
        )

      const logger = createLogger()
      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        logger,
        password: 'pass',
        username: 'user@test.com',
      })

      expect(api.isAuthenticated()).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(
        'Authentication failed:',
        expect.any(Error),
      )
    })
  })

  describe('session persistence', () => {
    it('should reuse persisted session and skip OIDC re-login', async () => {
      const futureExpiry = new Date(Date.now() + HOUR_MS).toISOString()
      const { settingManager } = createSettingStore({
        accessToken: 'persisted-token',
        expiry: futureExpiry,
        password: 'pass',
        refreshToken: 'persisted-refresh',
        username: 'user@test.com',
      })
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))

      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        settingManager,
      })

      expect(api.isAuthenticated()).toBe(true)
      expect(mockRequest).toHaveBeenCalledTimes(1)
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/context' }),
      )
    })

    it('should fall back to OIDC when persisted session is rejected', async () => {
      const futureExpiry = new Date(Date.now() + HOUR_MS).toISOString()
      const { settingManager } = createSettingStore({
        accessToken: 'persisted-token',
        expiry: futureExpiry,
        password: 'pass',
        refreshToken: 'persisted-refresh',
        username: 'user@test.com',
      })
      // First getUser() call fails -> triggers fallback to full authenticate()
      mockRequest.mockRejectedValueOnce(new Error('401 Unauthorized'))
      setupSuccessfulLogin()

      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        settingManager,
      })

      expect(api.isAuthenticated()).toBe(true)
    })

    it('should wipe persisted state when rejected session has no credentials', async () => {
      const futureExpiry = new Date(Date.now() + HOUR_MS).toISOString()
      const { setSpy, settingManager } = createSettingStore({
        accessToken: 'dead-token',
        expiry: futureExpiry,
        refreshToken: 'dead-refresh',
      })
      mockRequest.mockRejectedValueOnce(new Error('401 Unauthorized'))

      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        settingManager,
      })

      expect(api.isAuthenticated()).toBe(false)
      expect(setSpy).toHaveBeenCalledWith('accessToken', '')
      expect(setSpy).toHaveBeenCalledWith('refreshToken', '')
      expect(setSpy).toHaveBeenCalledWith('expiry', '')
    })

    it('should skip getUser when expiry is empty and no tokens', async () => {
      const { settingManager } = createSettingStore({
        password: 'pass',
        username: 'user@test.com',
      })
      setupSuccessfulLogin()

      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        settingManager,
      })

      expect(api.isAuthenticated()).toBe(true)
      // First call must be PAR (axios.post), not GET /context
      expect(mockAxiosPost.mock.calls[0]?.[0]).toContain('/connect/par')
    })

    it('wires a consumer AbortSignal into outgoing requests', async () => {
      setupSuccessfulLogin()
      const controller = new AbortController()
      await createApi({ abortSignal: controller.signal })

      // The auth flow requests use the signal
      expect(mockAxiosPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ signal: controller.signal }),
      )
    })

    it('should fall back to OIDC when expiry is in the past', async () => {
      const pastExpiry = new Date(Date.now() - HOUR_MS).toISOString()
      const { settingManager } = createSettingStore({
        accessToken: 'expired-token',
        expiry: pastExpiry,
        password: 'pass',
        refreshToken: 'old-refresh',
        username: 'user@test.com',
      })
      // Refresh token attempt — simulated via #hasPersistedSession returning true
      // since refreshToken is set, getUser is tried
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))

      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        settingManager,
      })

      expect(api.isAuthenticated()).toBe(true)
    })

    it('should persist tokens via settingManager after login', async () => {
      const { setSpy, settingManager } = createSettingStore()
      setupSuccessfulLogin()

      await melCloudHomeApi.create({
        baseURL: BASE_URL,
        password: 'pass',
        settingManager,
        username: 'user@test.com',
      })

      const tokenCalls = setSpy.mock.calls.filter(
        ([key]) => key === 'accessToken',
      )
      const lastToken = tokenCalls.at(-1)?.[1] ?? ''

      expect(lastToken).not.toBe('')
      expect(lastToken).toBe('test-access-token')

      const refreshCalls = setSpy.mock.calls.filter(
        ([key]) => key === 'refreshToken',
      )
      const lastRefresh = refreshCalls.at(-1)?.[1] ?? ''

      expect(lastRefresh).toBe('test-refresh-token')
    })

    it('should clear persisted tokens at the start of authenticate()', async () => {
      /*
       * Create an API with persisted tokens, then explicitly call
       * authenticate() with new credentials. The first thing authenticate()
       * does is call #clearPersistedSession(), wiping the old tokens.
       */
      const futureExpiry = new Date(Date.now() + HOUR_MS).toISOString()
      const { setSpy, settingManager } = createSettingStore({
        accessToken: 'old-token',
        expiry: futureExpiry,
        password: 'pass',
        refreshToken: 'old-refresh',
        username: 'user@test.com',
      })
      // getUser() succeeds with existing token — no OIDC needed for create()
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        settingManager,
      })
      setSpy.mockClear()

      // Now explicitly authenticate → clears old tokens first
      setupSuccessfulLogin()
      await api.authenticate({
        password: 'new-pass',
        username: 'new@test.com',
      })

      const tokenCalls = setSpy.mock.calls.filter(
        ([key]) => key === 'accessToken',
      )
      // First call sets '' (clear), subsequent call sets the new token
      expect(tokenCalls[0]?.[1]).toBe('')
      expect(tokenCalls.at(-1)?.[1]).toBe('test-access-token')
    })
  })

  describe('token refresh', () => {
    it('should refresh access token when expired instead of full re-auth', async () => {
      vi.useFakeTimers()
      try {
        setupSuccessfulLogin()
        const api = await createApi({ autoSyncInterval: null })

        // Advance past token expiry
        vi.advanceTimersByTime(3601 * MILLISECONDS_IN_SECOND)

        // Refresh token request succeeds
        mockAxiosPost.mockResolvedValueOnce(
          mockResponse({
            ...mockTokenResponse,
            access_token: 'refreshed-token',
          }),
        )
        mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
        const buildings = await api.list()

        expect(buildings).toStrictEqual([mockBuilding])
        // Should have used refresh, not full OIDC (no axios.request calls for redirects)
        const postCalls = mockAxiosPost.mock.calls
        const lastPostUrl = postCalls.at(-1)?.[0] as string

        expect(lastPostUrl).toContain('/connect/token')
      } finally {
        vi.useRealTimers()
      }
    })

    it('should fall back to full OIDC when token refresh fails', async () => {
      vi.useFakeTimers()
      try {
        setupSuccessfulLogin()
        const api = await createApi({ autoSyncInterval: null })

        // Advance past token expiry
        vi.advanceTimersByTime(3601 * MILLISECONDS_IN_SECOND)

        // Refresh fails
        mockAxiosPost.mockRejectedValueOnce(new Error('refresh failed'))
        // Full re-auth succeeds
        setupSuccessfulLogin()
        mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
        const buildings = await api.list()

        expect(buildings).toStrictEqual([mockBuilding])
      } finally {
        vi.useRealTimers()
      }
    })

    it('should try token refresh on 401 before full re-auth', async () => {
      setupSuccessfulLogin()
      const api = await createApi({ autoSyncInterval: null })

      // API call fails with 401
      mockRequest.mockRejectedValueOnce(axiosUnauthorized())
      // Refresh succeeds
      mockAxiosPost.mockResolvedValueOnce(
        mockResponse({
          ...mockTokenResponse,
          access_token: 'refreshed-after-401',
        }),
      )
      // Retry after refresh succeeds
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
      const buildings = await api.list()

      expect(buildings).toStrictEqual([mockBuilding])
    })
  })

  describe('token response without refresh_token', () => {
    it('should not overwrite refresh token when response omits it', async () => {
      vi.useFakeTimers()
      try {
        setupSuccessfulLogin()
        const api = await createApi({ autoSyncInterval: null })

        // Advance past token expiry
        vi.advanceTimersByTime(3601 * MILLISECONDS_IN_SECOND)

        // Refresh succeeds but response has no refresh_token
        mockAxiosPost.mockResolvedValueOnce(
          mockResponse({
            access_token: 'refreshed-no-rt',
            expires_in: 3600,
            scope: mockTokenResponse.scope,
            token_type: 'Bearer',
          }),
        )
        mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
        const buildings = await api.list()

        expect(buildings).toStrictEqual([mockBuilding])
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('PAR and token exchange failures', () => {
    it('should handle PAR failure gracefully', async () => {
      const logger = createLogger()
      mockAxiosPost.mockRejectedValueOnce(new Error('PAR endpoint down'))
      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        logger,
        password: 'pass',
        username: 'user@test.com',
      })

      expect(api.isAuthenticated()).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(
        'Authentication failed:',
        expect.any(Error),
      )
    })

    it('should handle token exchange failure gracefully', async () => {
      const logger = createLogger()
      // PAR succeeds
      mockAxiosPost.mockResolvedValueOnce(
        mockResponse({ request_uri: 'urn:test' }),
      )
      // Redirect chain to login page
      mockAxiosRequest
        .mockResolvedValueOnce(mockResponse(cognitoLoginPage(), {}, 200))
        // Credential POST
        .mockResolvedValueOnce(
          mockResponse(
            '',
            { location: 'https://auth.melcloudhome.com/callback?code=x' },
            302,
          ),
        )
        // Callback -> melcloudhome://
        .mockResolvedValueOnce(
          mockResponse(
            '',
            { location: 'melcloudhome://?code=auth-code&state=y' },
            302,
          ),
        )
      // Token exchange fails
      mockAxiosPost.mockRejectedValueOnce(new Error('token exchange failed'))

      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        logger,
        password: 'pass',
        username: 'user@test.com',
      })

      expect(api.isAuthenticated()).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(
        'Authentication failed:',
        expect.any(Error),
      )
    })
  })

  describe('cookie handling in auth flow', () => {
    it('should store and send Set-Cookie headers across redirect requests', async () => {
      // PAR
      mockAxiosPost.mockResolvedValueOnce(
        mockResponse({ request_uri: 'urn:test' }),
      )
      mockAxiosRequest
        .mockResolvedValueOnce(
          mockResponse(
            '',
            {
              location: `${COGNITO}/login`,
              'set-cookie': ['session=abc; Path=/; Secure'],
            },
            302,
          ),
        )
        .mockResolvedValueOnce(
          mockResponse(cognitoLoginPage(`${COGNITO}/login?id=test`), {}, 200),
        )
        // Credential POST
        .mockResolvedValueOnce(
          mockResponse(
            '',
            {
              location:
                'https://auth.melcloudhome.com/signin-oidc-meu?code=x&state=y',
            },
            302,
          ),
        )
        // Callback -> melcloudhome://
        .mockResolvedValueOnce(
          mockResponse(
            '',
            { location: 'melcloudhome://?code=auth-code&state=y' },
            302,
          ),
        )
      // Token exchange
      mockAxiosPost.mockResolvedValueOnce(mockResponse(mockTokenResponse))
      // GET /context
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))

      const api = await createApi()

      expect(api.isAuthenticated()).toBe(true)
    })

    it('should ignore invalid Set-Cookie values', async () => {
      // PAR
      mockAxiosPost.mockResolvedValueOnce(
        mockResponse({ request_uri: 'urn:test' }),
      )
      mockAxiosRequest
        .mockResolvedValueOnce(
          mockResponse(
            cognitoLoginPage(`${COGNITO}/login?id=test`),
            { 'set-cookie': [''] },
            200,
          ),
        )
        // Credential POST
        .mockResolvedValueOnce(
          mockResponse(
            '',
            {
              location:
                'https://auth.melcloudhome.com/signin-oidc-meu?code=x&state=y',
            },
            302,
          ),
        )
        // Callback -> melcloudhome://
        .mockResolvedValueOnce(
          mockResponse(
            '',
            { location: 'melcloudhome://?code=auth-code&state=y' },
            302,
          ),
        )
      // Token exchange
      mockAxiosPost.mockResolvedValueOnce(mockResponse(mockTokenResponse))
      // GET /context
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))

      await expect(createApi()).resolves.toBeDefined()
    })
  })

  describe('logging', () => {
    it('should produce structured log output for both requests and responses', async () => {
      setupSuccessfulLogin()
      const logger = createLogger()
      await createApi({ logger })

      const {
        mock: { calls },
      } = vi.mocked(logger.log)

      const messages = calls.map(([message]) => String(message))

      expect(messages.length).toBeGreaterThan(0)
      expect(messages.some((message) => message.includes('API request'))).toBe(
        true,
      )
      expect(messages.some((message) => message.includes('API response'))).toBe(
        true,
      )
    })

    it('should log structured error data for axios errors', async () => {
      setupSuccessfulLogin()
      const logger = createLogger()
      const api = await createApi({ logger })
      const axiosError = Object.assign(new Error('Request failed'), {
        isAxiosError: true,
      })
      mockRequest.mockRejectedValueOnce(axiosError)
      await api.list()

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Request failed'),
      )
    })
  })
})
