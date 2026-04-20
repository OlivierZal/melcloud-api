import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { HomeAPI } from '../../src/api/home.ts'
import type { HomeAPIConfig } from '../../src/api/index.ts'
import type {
  HomeBuilding,
  HomeContext,
  HomeEnergyData,
  HomeErrorLogEntry,
  HomeReportData,
} from '../../src/types/index.ts'
import { HttpError } from '../../src/http/index.ts'
import { MS_PER_HOUR, MS_PER_SECOND } from '../../src/time-units.ts'
import {
  cast,
  createLogger,
  createMockHttpClient,
  createSettingStore,
  matchObject,
  mockFetchResponse,
  mockResponse,
} from '../helpers.ts'

const BASE_URL = 'https://melcloudhome.com'
const COGNITO = 'https://live-melcloudhome.auth.eu-west-1.amazoncognito.com'
const AUTH_BASE = 'https://auth.melcloudhome.com'

const REPORT_TIME_KEY = 'x'
const REPORT_VALUE_KEY = 'y'

const cognitoLoginPage = (
  action = '/login?client_id=test&amp;state=abc',
  csrf = 'csrf-token',
): string =>
  `<form action="${action}" method="POST">` +
  `<input type="hidden" name="_csrf" value="${csrf}"/>` +
  '<input type="hidden" name="cognitoAsfData" value=""/>' +
  '</form>'

const mockCapabilities = {
  hasAirDirection: true,
  hasAutomaticFanSpeed: true,
  hasAutoOperationMode: true,
  hasCoolOperationMode: true,
  hasDryOperationMode: true,
  hasHalfDegreeIncrements: false,
  hasHeatOperationMode: true,
  hasSwing: true,
  maxTempAutomatic: 30,
  maxTempCoolDry: 30,
  maxTempHeat: 30,
  minTempAutomatic: 10,
  minTempCoolDry: 10,
  minTempHeat: 10,
  numberOfFanSpeeds: 5,
}

const mockBuilding: HomeBuilding = {
  airToAirUnits: [
    {
      capabilities: mockCapabilities,
      givenDisplayName: 'Test ClassicDevice',
      id: 'device-1',
      rssi: -50,
      settings: [{ name: 'Power', value: 'True' }],
    },
  ],
  airToWaterUnits: [
    {
      capabilities: mockCapabilities,
      givenDisplayName: 'ATW ClassicDevice',
      id: 'device-2',
      rssi: -55,
      settings: [],
    },
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
          {
            [REPORT_TIME_KEY]: '2026-03-01T00:00:00',
            [REPORT_VALUE_KEY]: 20.5,
          },
          { [REPORT_TIME_KEY]: '2026-03-01T01:00:00', [REPORT_VALUE_KEY]: 21 },
        ],
        id: 'room_temperature',
        label: 'Room ClassicTemperature',
      },
    ],
    reportPeriod: 'hourly',
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

const { client: mockHttpClient, requestSpy: mockRequest } =
  createMockHttpClient(BASE_URL)

// The OIDC token-auth module uses the global `fetch` directly for PAR,
// the redirect chain, and the token exchange. We stub `fetch` globally
// and stage every OIDC hop via `mockResolvedValueOnce` so each test
// phase controls exactly the responses it needs, in order.
const mockFetch = vi.fn<typeof fetch>()
vi.stubGlobal('fetch', mockFetch)

// Queue a scripted sequence of OIDC responses on top of the global
// `fetch` mock. Order matches the runtime flow: PAR, redirect chain,
// credential submission, callback resolution, token exchange. The
// final `GET /context` goes through the BFF HttpClient mock.
const setupSuccessfulLogin = (): void => {
  const callbackUrl =
    'https://auth.melcloudhome.com/signin-oidc-meu?code=abc&state=xyz'

  mockFetch
    // 1. PAR
    .mockResolvedValueOnce(
      mockFetchResponse(
        { request_uri: 'urn:ietf:params:oauth:request_uri:test' },
        {},
        200,
      ),
    )
    // 2. Redirect chain to Cognito login page
    .mockResolvedValueOnce(
      mockFetchResponse('', { location: `${AUTH_BASE}/connect/redirect` }, 302),
    )
    .mockResolvedValueOnce(
      mockFetchResponse(
        '',
        { location: `${COGNITO}/oauth2/authorize?client_id=test` },
        302,
      ),
    )
    .mockResolvedValueOnce(
      mockFetchResponse(
        '',
        { location: `${COGNITO}/login?client_id=test` },
        302,
      ),
    )
    .mockResolvedValueOnce(mockFetchResponse(cognitoLoginPage(), {}, 200))
    // 3. Credential POST → 302 to callback
    .mockResolvedValueOnce(
      mockFetchResponse('', { location: callbackUrl }, 302),
    )
    // 4. Callback chain → JS redirect page → melcloudhome://?code=...
    .mockResolvedValueOnce(
      mockFetchResponse(
        '',
        {
          location: 'https://auth.melcloudhome.com/ExternalLogin/Callback',
        },
        302,
      ),
    )
    .mockResolvedValueOnce(
      mockFetchResponse(
        "<script>window.location='melcloudhome://?code=auth-code&amp;state=xyz'</script>",
        {},
        200,
      ),
    )
    // 5. Token exchange
    .mockResolvedValueOnce(mockFetchResponse(mockTokenResponse, {}, 200))

  // 6. GET /context via the HttpClient BFF instance
  mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
}

const persistedSessionStore = (
  overrides: Record<string, string> = {},
): ReturnType<typeof createSettingStore> =>
  createSettingStore({
    accessToken: 'persisted-token',
    expiry: new Date(Date.now() + MS_PER_HOUR).toISOString(),
    password: 'pass',
    refreshToken: 'persisted-refresh',
    username: 'user@test.com',
    ...overrides,
  })

const httpUnauthorized = (url = '/context'): HttpError =>
  new HttpError(
    'Unauthorized',
    { data: undefined, headers: {}, status: 401 },
    { url },
  )

describe('melcloud home API', () => {
  let melCloudHomeApi: { create: typeof HomeAPI.create } = cast(null)

  beforeEach(async () => {
    mockRequest.mockReset()
    mockFetch.mockReset()

    // The spy would otherwise fall back to HttpClient.prototype.request
    // (real fetch). Default to an empty success response so tests that
    // don't queue a specific mock don't hit the network.
    mockRequest.mockResolvedValue({ data: {}, headers: {}, status: 200 })
    vi.clearAllMocks()
    ;({ HomeAPI: melCloudHomeApi } = await import('../../src/api/home.ts'))
  })

  const createApi = async (
    config: HomeAPIConfig = {},
  ): ReturnType<typeof melCloudHomeApi.create> =>
    melCloudHomeApi.create({
      baseURL: BASE_URL,
      password: 'pass',
      transport: mockHttpClient,
      username: 'user@test.com',
      ...config,
    })

  const createFromPersistedStore = async (
    settingManager: ReturnType<typeof createSettingStore>['settingManager'],
  ): ReturnType<typeof melCloudHomeApi.create> =>
    melCloudHomeApi.create({
      baseURL: BASE_URL,
      settingManager,
      transport: mockHttpClient,
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
      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        transport: mockHttpClient,
      })

      expect(api.isAuthenticated()).toBe(false)
      expect(api.user).toBeNull()
    })
  })

  describe('authentication', () => {
    // Contract: a 401 from the BFF token exchange is wrapped into
    // AuthenticationError by `doAuthenticate` (via
    // `normalizeUnauthorized`) so callers see a stable domain error
    // instead of a raw HttpError — mirroring the Classic
    // `LoginData: null → AuthenticationError` path.
    it('should wrap 401 from token exchange into AuthenticationError', async () => {
      mockFetch
        .mockResolvedValueOnce(
          mockFetchResponse(
            { request_uri: 'urn:ietf:params:oauth:request_uri:test' },
            {},
            200,
          ),
        )
        .mockResolvedValueOnce(
          mockFetchResponse(
            '',
            { location: `${AUTH_BASE}/connect/redirect` },
            302,
          ),
        )
        .mockResolvedValueOnce(
          mockFetchResponse(
            '',
            { location: `${COGNITO}/oauth2/authorize?client_id=test` },
            302,
          ),
        )
        .mockResolvedValueOnce(
          mockFetchResponse(
            '',
            { location: `${COGNITO}/login?client_id=test` },
            302,
          ),
        )
        .mockResolvedValueOnce(mockFetchResponse(cognitoLoginPage(), {}, 200))
        .mockResolvedValueOnce(
          mockFetchResponse(
            '',
            {
              location:
                'https://auth.melcloudhome.com/signin-oidc-meu?code=abc&state=xyz',
            },
            302,
          ),
        )
        .mockResolvedValueOnce(
          mockFetchResponse(
            '',
            {
              location: 'https://auth.melcloudhome.com/ExternalLogin/Callback',
            },
            302,
          ),
        )
        .mockResolvedValueOnce(
          mockFetchResponse(
            "<script>window.location='melcloudhome://?code=auth-code&amp;state=xyz'</script>",
            {},
            200,
          ),
        )
        .mockRejectedValueOnce(httpUnauthorized('/connect/token'))
      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        transport: mockHttpClient,
      })

      const { AuthenticationError } = await import('../../src/errors/index.ts')

      await expect(
        api.authenticate({ password: 'bad', username: 'u@test.com' }),
      ).rejects.toThrow(AuthenticationError)
    })

    it('should clear user state on re-authentication', async () => {
      setupSuccessfulLogin()
      const api = await createApi()

      expect(api.isAuthenticated()).toBe(true)

      mockFetch.mockRejectedValueOnce(new Error('network'))

      await expect(
        api.authenticate({ password: 'wrong', username: 'u@t.com' }),
      ).rejects.toThrow('network')

      expect(api.user).toBeNull()
    })

    it('should re-authenticate with new credentials', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      setupSuccessfulLogin()
      await api.authenticate({
        password: 'new-pass',
        username: 'new@test.com',
      })

      expect(api.isAuthenticated()).toBe(true)
    })
  })

  // `resumeSession()` has generic coverage at the BaseAPI unit level;
  // these cases pin the HomeAPI-specific shape (OIDC round-trip +
  // `/context` + registry hydration) that the base mocks can't
  // exercise. Regression guard for two observable behaviours:
  // - a successful resume repopulates user/context AND registry;
  // - a rejected resume (fetch throws) returns false + logs, without
  //   leaving partial state behind.
  describe('resumeSession', () => {
    it('returns true and populates context + registry on success', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      setupSuccessfulLogin()

      const isResumed = await api.resumeSession()

      expect(isResumed).toBe(true)
      expect(api.isAuthenticated()).toBe(true)
      expect(api.user).not.toBeNull()
      expect(api.registry.getAll().length).toBeGreaterThan(0)
    })

    it('returns false + logs when persisted credentials are rejected', async () => {
      setupSuccessfulLogin()
      const logger = createLogger()
      const api = await createApi({ logger })
      mockFetch.mockRejectedValueOnce(httpUnauthorized('/connect/par'))

      const isResumed = await api.resumeSession()

      expect(isResumed).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(
        'Session resume failed:',
        expect.any(Error),
      )
    })
  })

  describe('user retrieval', () => {
    it('should return the user on success', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
      const user = await api.getUser()

      expect(user).toStrictEqual({
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        sub: 'user-1',
      })
    })

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
      const api = await createApi({ events: { onSyncComplete: onSync } })

      // authenticate triggers list() internally — reset so the assertion
      // only covers the explicit list() below.
      onSync.mockClear()
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
      await api.list()

      expect(onSync).toHaveBeenCalledTimes(1)
    })

    it('should call onSync after updateValues() via list()', async () => {
      setupSuccessfulLogin()
      const onSync = vi.fn<() => Promise<void>>()
      const api = await createApi({ events: { onSyncComplete: onSync } })
      onSync.mockClear()
      mockRequest
        .mockResolvedValueOnce(mockResponse('', {}, 200))
        .mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
      await api.updateValues('device-1', { power: true })

      expect(onSync).toHaveBeenCalledTimes(1)
    })

    it('should call onSync even on failure for consistency with classic API', async () => {
      setupSuccessfulLogin()
      const onSync = vi.fn<() => Promise<void>>()
      const api = await createApi({ events: { onSyncComplete: onSync } })
      onSync.mockClear()
      mockRequest.mockRejectedValueOnce(new Error('network'))
      await api.list()

      expect(onSync).toHaveBeenCalledTimes(1)
    })

    it('should populate the registry during authenticate', async () => {
      setupSuccessfulLogin()
      const api = await createApi()

      expect(
        api.registry.getAll().map(({ id }: { id: string }) => id),
      ).toContain(mockBuilding.airToAirUnits[0]?.id)
    })
  })

  describe('device control', () => {
    it('should return true and refresh via list() on successful updateValues', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      mockRequest
        .mockResolvedValueOnce(mockResponse('', {}, 200))
        .mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
      const isSuccess = await api.updateValues('device-1', {
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

    it('should return false on updateValues failure', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      mockRequest.mockRejectedValueOnce(new Error('network'))
      const isSuccess = await api.updateValues('device-1', { power: false })

      expect(isSuccess).toBe(false)
    })

    // Post-condition contract: on a failed PUT, the server state is
    // presumed unchanged so no re-sync is issued — a failed write must
    // not cost an extra registry fetch. Sync happens only on success
    // (see `resyncs the registry after a successful updateValues`).
    it('does not resync after a failed updateValues', async () => {
      setupSuccessfulLogin()
      const onSync = vi.fn<() => Promise<void>>()
      const api = await createApi({ events: { onSyncComplete: onSync } })
      onSync.mockClear()
      mockRequest.mockClear()
      mockRequest.mockRejectedValueOnce(new Error('network'))
      const isSuccess = await api.updateValues('device-1', { power: false })

      expect(isSuccess).toBe(false)
      expect(mockRequest).toHaveBeenCalledTimes(1)
      expect(onSync).not.toHaveBeenCalled()
    })

    // Post-condition contract: on successful PUT, the registry is
    // refreshed so downstream readers see the server-side effect of
    // the write (the PUT response does not echo device fields).
    it('resyncs the registry after a successful updateValues', async () => {
      setupSuccessfulLogin()
      const onSync = vi.fn<() => Promise<void>>()
      const api = await createApi({ events: { onSyncComplete: onSync } })
      onSync.mockClear()
      mockRequest
        .mockResolvedValueOnce(mockResponse('', {}, 200))
        .mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
      await api.updateValues('device-1', { power: false })

      expect(onSync).toHaveBeenCalledWith(expect.objectContaining({}))
    })

    it('swallows and logs sync failures during updateValues refresh', async () => {
      setupSuccessfulLogin()
      const logger = createLogger()
      const onSync = vi.fn<() => Promise<void>>()
      const api = await createApi({
        events: { onSyncComplete: onSync },
        logger,
      })
      onSync.mockRejectedValueOnce(new Error('sync exploded'))
      mockRequest
        .mockResolvedValueOnce(mockResponse('', {}, 200))
        .mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
      const isSuccess = await api.updateValues('device-1', { power: false })

      expect(isSuccess).toBe(true)
      expect(logger.error).toHaveBeenCalledWith(
        'LifecycleEvents.onSyncComplete callback threw — ignoring',
        expect.any(Error),
      )
    })
  })

  describe('error log', () => {
    it('should fetch device error log', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      mockRequest.mockResolvedValueOnce(mockResponse(mockErrorLog, {}, 200))
      const result = await api.getErrorLog('device-1')

      expect(result).toStrictEqual({ ok: true, value: mockErrorLog })
      expect(mockRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: '/monitor/ataunit/device-1/errorlog',
        }),
      )
    })

    it('should return a typed network failure on transport error', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      mockRequest.mockRejectedValueOnce(new Error('network'))
      const result = await api.getErrorLog('device-1')

      expect(result).toMatchObject({ error: { kind: 'network' }, ok: false })
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

      expect(result).toStrictEqual({ ok: true, value: mockReportData })
      expect(mockRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({
          params: {
            from: '2026-03-01T00:00:00.0000000',
            period: 'Hourly',
            to: '2026-03-02T00:00:00.0000000',
            unitId: 'device-1',
          },
          url: '/report/v1/trendsummary',
        }),
      )
    })

    it('should return a typed network failure on transport error', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      mockRequest.mockRejectedValueOnce(new Error('network'))
      const result = await api.getTemperatures('device-1', {
        from: '2026-03-01',
        period: 'Daily',
        to: '2026-03-02',
      })

      expect(result).toMatchObject({ error: { kind: 'network' }, ok: false })
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

      expect(result).toStrictEqual({ ok: true, value: mockEnergyData })
      expect(mockRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({
          params: {
            from: '2026-03-01 00:00',
            interval: 'Hour',
            measure: 'cumulative_energy_consumed_since_last_upload',
            to: '2026-03-02 00:00',
          },
          url: '/telemetry/telemetry/energy/device-1',
        }),
      )
    })

    it('should return a typed network failure on transport error', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      mockRequest.mockRejectedValueOnce(new Error('network'))
      const result = await api.getEnergy('device-1', {
        from: '2026-03-01',
        interval: 'Day',
        to: '2026-03-02',
      })

      expect(result).toMatchObject({ error: { kind: 'network' }, ok: false })
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

      expect(result).toStrictEqual({ ok: true, value: mockSignalData })
      expect(mockRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({
          params: {
            from: '2026-03-01 00:00',
            measure: 'rssi',
            to: '2026-03-02 00:00',
          },
          url: '/telemetry/telemetry/actual/device-1',
        }),
      )
    })

    it('should return a typed network failure on transport error', async () => {
      setupSuccessfulLogin()
      const api = await createApi()
      mockRequest.mockRejectedValueOnce(new Error('network'))
      const result = await api.getSignal('device-1', {
        from: '2026-03-01',
        to: '2026-03-02',
      })

      expect(result).toMatchObject({ error: { kind: 'network' }, ok: false })
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
        api.setSyncInterval(false)
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
        const api = await createApi({ syncIntervalMinutes: 1 })

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

        // Disable auto-sync so the 3601s advance below does not fire
        // the background sync timer (which authenticate→list() plans).
        const api = await createApi({ syncIntervalMinutes: false })

        expect(api.isAuthenticated()).toBe(true)

        // Advance past the 3600s token expiry
        vi.advanceTimersByTime(3601 * MS_PER_SECOND)

        // #ensureSession detects expired token, tries refresh first.
        // Refresh token call succeeds via axios.post to token endpoint.
        mockFetch.mockResolvedValueOnce(
          mockFetchResponse({
            ...mockTokenResponse,
            access_token: 'refreshed-token',
          }),
        )
        // List → #fetchContext → GET /context
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

      // #hasPersistedSession() returns true (refreshToken is set).
      // getUser() -> #fetchContext() -> #request() -> #ensureSession()
      //   -> isSessionExpired('not-a-valid-iso-date') -> true
      //   -> try refresh (refreshToken is set) -> succeeds
      //   -> #fetchContext completes with new token
      // Refresh token succeeds
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({
          ...mockTokenResponse,
          access_token: 'refreshed-token',
        }),
      )
      // GET /context succeeds
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))

      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        settingManager,
        transport: mockHttpClient,
      })

      expect(api.isAuthenticated()).toBe(true)
    })
  })

  describe('reactive auth retry on 401', () => {
    it('should retry the request once after a reactive re-auth on 401', async () => {
      setupSuccessfulLogin()
      const api = await createApi()

      // First attempt rejects with 401. The reactive handler tries
      // refresh first (refreshToken is set) — that succeeds. The
      // retry dispatch then succeeds with mockContext.
      mockRequest.mockRejectedValueOnce(httpUnauthorized())
      // Refresh succeeds
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({
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

      // 401 triggers reactive retry. Refresh token fails, so the handler
      // clears the session and attempts full re-authentication, which
      // succeeds. The retried dispatch then returns mockContext.
      mockRequest.mockRejectedValueOnce(httpUnauthorized())
      // Refresh fails
      mockFetch.mockRejectedValueOnce(new Error('refresh failed'))
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

      // First 401: retry budget consumed, refresh succeeds, retry succeeds.
      // Second 401 in the same retry window: no reauth, list() returns [].
      mockRequest.mockRejectedValueOnce(httpUnauthorized())
      // Refresh succeeds
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({
          ...mockTokenResponse,
          access_token: 'refreshed-after-401',
        }),
      )
      // Retry dispatch
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
      await api.list()

      mockRequest.mockRejectedValueOnce(httpUnauthorized())
      const second = await api.list()

      expect(second).toStrictEqual([])
    })

    it('should not trigger reactive retry during the OIDC flow', async () => {
      // PAR request fails with a 401. `resumeSession()` (called from
      // `initialize()`) catches and logs it; no session is established.
      const logger = createLogger()
      mockFetch.mockRejectedValueOnce(httpUnauthorized())
      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        logger,
        password: 'pass',
        transport: mockHttpClient,
        username: 'user@test.com',
      })

      expect(api.isAuthenticated()).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(
        'Session resume failed:',
        expect.any(Error),
      )
    })

    it('should surface the original 401 when reactive reauth fails', async () => {
      setupSuccessfulLogin()
      const api = await createApi()

      // 401 on list -> reactive retry -> resumeSession() itself fails
      // (PAR rejects). `resumeSession()` returns false, so `retryAuth`
      // returns null and the original 401 propagates until list()'s
      // own catch swallows it and resolves to [].
      mockRequest.mockRejectedValueOnce(httpUnauthorized())
      mockFetch.mockRejectedValueOnce(new Error('PAR failed'))
      const buildings = await api.list()

      expect(buildings).toStrictEqual([])
    })

    it('throws a descriptive error when the PAR endpoint returns a non-2xx status', async () => {
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({ error: 'denied' }, {}, 500),
      )
      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        transport: mockHttpClient,
      })

      await expect(
        api.authenticate({ password: 'pass', username: 'user@test.com' }),
      ).rejects.toThrow(/failed with status 500/u)
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

  describe('redirect handling', () => {
    it('should stop on too many redirects', async () => {
      // PAR succeeds
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({ request_uri: 'urn:test' }),
      )
      // 21 redirects to exhaust the limit
      Array.from({ length: 21 }, (_unused, index) =>
        mockFetch.mockResolvedValueOnce(
          mockFetchResponse(
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
        transport: mockHttpClient,
        username: 'user@test.com',
      })

      expect(api.isAuthenticated()).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(
        'Session resume failed:',
        matchObject({
          message: cast(expect.stringContaining('Too many redirects')),
        }),
      )
    })

    it('should treat a 302 with no location header as an empty redirect', async () => {
      // PAR succeeds
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({ request_uri: 'urn:test' }),
      )
      // First redirect has a location, second 302 has no location header
      mockFetch
        .mockResolvedValueOnce(
          mockFetchResponse('', { location: `${AUTH_BASE}/step1` }, 302),
        )
        .mockResolvedValueOnce(mockFetchResponse('', {}, 302))

        // The empty location resolves relative to current URL, producing an
        // invalid redirect that eventually loops back to a page with no form.
        .mockResolvedValueOnce(
          mockFetchResponse('<html>no form here</html>', {}, 200),
        )
      const logger = createLogger()
      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        logger,
        password: 'pass',
        transport: mockHttpClient,
        username: 'user@test.com',
      })

      expect(api.isAuthenticated()).toBe(false)
    })

    it('should resolve relative redirect URLs', async () => {
      // PAR succeeds
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({ request_uri: 'urn:test' }),
      )
      mockFetch
        .mockResolvedValueOnce(
          mockFetchResponse(
            '',
            { location: `${AUTH_BASE}/auth-redirect` },
            302,
          ),
        )
        .mockResolvedValueOnce(
          mockFetchResponse('', { location: '/relative-path' }, 302),
        )
        .mockResolvedValueOnce(
          mockFetchResponse(
            '',
            { location: `${COGNITO}/login?client_id=test` },
            302,
          ),
        )
        .mockResolvedValueOnce(
          mockFetchResponse(
            cognitoLoginPage(`${COGNITO}/login?client_id=test`),
            {},
            200,
          ),
        )
        // Credential POST
        .mockResolvedValueOnce(
          mockFetchResponse(
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
          mockFetchResponse(
            '',
            { location: 'melcloudhome://?code=auth-code&state=y' },
            302,
          ),
        )
      // Token exchange
      mockFetch.mockResolvedValueOnce(mockFetchResponse(mockTokenResponse))
      // GET /context
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))

      const api = await createApi()

      expect(api.isAuthenticated()).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        `${AUTH_BASE}/relative-path`,
        expect.anything(),
      )
    })

    it('should follow meta http-equiv refresh redirects', async () => {
      // PAR succeeds
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({ request_uri: 'urn:test' }),
      )
      mockFetch
        .mockResolvedValueOnce(mockFetchResponse(cognitoLoginPage(), {}, 200))
        // Credential POST
        .mockResolvedValueOnce(
          mockFetchResponse(
            '',
            { location: 'https://auth.melcloudhome.com/callback?code=x' },
            302,
          ),
        )
        // IS callback → /Redirect page with meta refresh
        .mockResolvedValueOnce(
          mockFetchResponse(
            '',
            { location: '/Redirect?RedirectUri=%2Fconnect%2Fauthorize' },
            302,
          ),
        )
        .mockResolvedValueOnce(
          mockFetchResponse(
            '<meta http-equiv="refresh" content="0;url=/connect/authorize/callback?client_id=homemobile&amp;request_uri=urn:test">',
            {},
            200,
          ),
        )
        // Following the meta refresh URL → final redirect to melcloudhome://
        .mockResolvedValueOnce(
          mockFetchResponse(
            '',
            { location: 'melcloudhome://?code=auth-code&state=y' },
            302,
          ),
        )
      // Token exchange
      mockFetch.mockResolvedValueOnce(mockFetchResponse(mockTokenResponse))
      // GET /context
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))

      const api = await createApi()

      expect(api.isAuthenticated()).toBe(true)
    })
  })

  describe('form parsing', () => {
    it('should throw when form action is missing', async () => {
      // PAR succeeds
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({ request_uri: 'urn:test' }),
      )
      // Redirect chain lands on a page with no form
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse('<html>no form here</html>', {}, 200),
      )
      const logger = createLogger()
      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        logger,
        password: 'pass',
        transport: mockHttpClient,
        username: 'user@test.com',
      })

      expect(api.isAuthenticated()).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(
        'Session resume failed:',
        expect.any(Error),
      )
    })

    it('should prefix relative form action with Cognito authority', async () => {
      // PAR succeeds
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({ request_uri: 'urn:test' }),
      )
      // Directly to login page (no redirects before)
      mockFetch
        .mockResolvedValueOnce(
          mockFetchResponse(
            cognitoLoginPage('/login?client_id=test&amp;state=abc'),
            {},
            200,
          ),
        )
        // Credential POST
        .mockResolvedValueOnce(
          mockFetchResponse(
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
          mockFetchResponse(
            '',
            { location: 'melcloudhome://?code=auth-code&state=y' },
            302,
          ),
        )
      // Token exchange
      mockFetch.mockResolvedValueOnce(mockFetchResponse(mockTokenResponse))
      // GET /context
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))

      await createApi()

      expect(mockFetch).toHaveBeenCalledWith(
        `${COGNITO}/login?client_id=test&state=abc`,
        expect.anything(),
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
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({ request_uri: 'urn:test' }),
      )
      mockFetch
        .mockResolvedValueOnce(mockFetchResponse(htmlWithEdgeCases, {}, 200))
        // Credential POST
        .mockResolvedValueOnce(
          mockFetchResponse(
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
          mockFetchResponse(
            '',
            { location: 'melcloudhome://?code=auth-code&state=y' },
            302,
          ),
        )
      // Token exchange
      mockFetch.mockResolvedValueOnce(mockFetchResponse(mockTokenResponse))
      // GET /context
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))

      const api = await createApi()

      expect(api.isAuthenticated()).toBe(true)
    })

    it('should use absolute form action as-is', async () => {
      const absoluteAction = `${COGNITO}/login?client_id=test`
      // PAR
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({ request_uri: 'urn:test' }),
      )
      mockFetch
        .mockResolvedValueOnce(
          mockFetchResponse(cognitoLoginPage(absoluteAction), {}, 200),
        )
        // Credential POST
        .mockResolvedValueOnce(
          mockFetchResponse(
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
          mockFetchResponse(
            '',
            { location: 'melcloudhome://?code=auth-code&state=y' },
            302,
          ),
        )
      // Token exchange
      mockFetch.mockResolvedValueOnce(mockFetchResponse(mockTokenResponse))
      // GET /context
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))

      await createApi()

      expect(mockFetch).toHaveBeenCalledWith(absoluteAction, expect.anything())
    })

    it('should handle missing location header from credential submission', async () => {
      // PAR
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({ request_uri: 'urn:test' }),
      )
      mockFetch
        .mockResolvedValueOnce(mockFetchResponse(cognitoLoginPage(), {}, 200))
        // Credential POST -> no location header
        .mockResolvedValueOnce(mockFetchResponse('', {}, 302))

      const logger = createLogger()
      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        logger,
        password: 'pass',
        transport: mockHttpClient,
        username: 'user@test.com',
      })

      expect(api.isAuthenticated()).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(
        'Session resume failed:',
        expect.any(Error),
      )
    })

    it('should handle callback URL without authorization code', async () => {
      // PAR
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({ request_uri: 'urn:test' }),
      )
      mockFetch
        .mockResolvedValueOnce(mockFetchResponse(cognitoLoginPage(), {}, 200))
        // Credential POST -> callback without code param
        .mockResolvedValueOnce(
          mockFetchResponse('', { location: 'melcloudhome://?state=abc' }, 302),
        )

      const logger = createLogger()
      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        logger,
        password: 'pass',
        transport: mockHttpClient,
        username: 'user@test.com',
      })

      expect(api.isAuthenticated()).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(
        'Session resume failed:',
        expect.any(Error),
      )
    })
  })

  describe('session persistence', () => {
    describe('valid persisted session', () => {
      it('reuses the session and hits /context exactly once', async () => {
        const { settingManager } = persistedSessionStore()
        mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))

        const api = await createFromPersistedStore(settingManager)

        expect(api.isAuthenticated()).toBe(true)
        expect(mockRequest).toHaveBeenCalledTimes(1)
        expect(mockRequest).toHaveBeenCalledWith(
          expect.objectContaining({ url: '/context' }),
        )
      })

      // Regression guard for the persisted-session branch of the
      // #1281-class of bug: before this fix, `create()` with a valid
      // persisted session returned an instance whose device registry
      // was still empty (only `context`/`user` were hydrated). Now
      // the reuse path goes through `list()`, which populates both
      // in a single /context request.
      it('populates the device registry on the persisted-session path', async () => {
        const { settingManager } = persistedSessionStore()
        mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))

        const api = await createFromPersistedStore(settingManager)

        expect(api.registry.getAll().length).toBeGreaterThan(0)
      })
    })

    it('should fall back to OIDC when persisted session is rejected', async () => {
      const { settingManager } = persistedSessionStore()
      mockRequest.mockRejectedValueOnce(new Error('401 Unauthorized'))
      setupSuccessfulLogin()

      const api = await createFromPersistedStore(settingManager)

      expect(api.isAuthenticated()).toBe(true)
    })

    it('should wipe persisted state when rejected session has no credentials', async () => {
      const futureExpiry = new Date(Date.now() + MS_PER_HOUR).toISOString()
      const { setSpy, settingManager } = createSettingStore({
        accessToken: 'dead-token',
        expiry: futureExpiry,
        refreshToken: 'dead-refresh',
      })
      mockRequest.mockRejectedValueOnce(new Error('401 Unauthorized'))

      const api = await createFromPersistedStore(settingManager)

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
        transport: mockHttpClient,
      })

      expect(api.isAuthenticated()).toBe(true)
      // First call must be PAR (axios.post), not GET /context
      expect(mockFetch.mock.calls[0]?.[0]).toContain('/connect/par')
    })

    it('should fall back to OIDC when expiry is in the past', async () => {
      const pastExpiry = new Date(Date.now() - MS_PER_HOUR).toISOString()
      const { settingManager } = createSettingStore({
        accessToken: 'expired-token',
        expiry: pastExpiry,
        password: 'pass',
        refreshToken: 'old-refresh',
        username: 'user@test.com',
      })

      // Refresh token attempt — #hasPersistedSession returns true
      // since refreshToken is set, getUser is tried.
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))

      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        settingManager,
        transport: mockHttpClient,
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
        transport: mockHttpClient,
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
      // Flow: create() → initialize() → tryReuseSession() → list()
      // hydrates context with the old token (no OIDC needed). Then
      // explicitly calling authenticate(newCredentials) runs
      // doAuthenticate, whose first step is #clearPersistedSession()
      // wiping the old accessToken/refreshToken/expiry before the
      // new OIDC flow starts.
      const futureExpiry = new Date(Date.now() + MS_PER_HOUR).toISOString()
      const { setSpy, settingManager } = createSettingStore({
        accessToken: 'old-token',
        expiry: futureExpiry,
        password: 'pass',
        refreshToken: 'old-refresh',
        username: 'user@test.com',
      })
      // list() succeeds with existing token — no OIDC needed for create
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        settingManager,
        transport: mockHttpClient,
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
        const api = await createApi({ syncIntervalMinutes: false })

        // Advance past token expiry
        vi.advanceTimersByTime(3601 * MS_PER_SECOND)

        // Refresh token request succeeds
        mockFetch.mockResolvedValueOnce(
          mockFetchResponse({
            ...mockTokenResponse,
            access_token: 'refreshed-token',
          }),
        )
        mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
        const buildings = await api.list()

        expect(buildings).toStrictEqual([mockBuilding])

        // Should have used refresh, not full OIDC (no other fetch calls for redirects)
        expect(mockFetch).toHaveBeenLastCalledWith(
          expect.stringContaining('/connect/token'),
          expect.any(Object),
        )
      } finally {
        vi.useRealTimers()
      }
    })

    it('should pass AbortSignal to refresh token request', async () => {
      vi.useFakeTimers()
      try {
        const controller = new AbortController()
        setupSuccessfulLogin()
        const api = await createApi({
          abortSignal: controller.signal,
          syncIntervalMinutes: false,
        })

        vi.advanceTimersByTime(3601 * MS_PER_SECOND)

        mockFetch.mockResolvedValueOnce(
          mockFetchResponse({
            ...mockTokenResponse,
            access_token: 'refreshed-token',
          }),
        )
        mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))
        await api.list()

        // Refresh token POST should include the signal
        const refreshCall = mockFetch.mock.calls.find(
          ([url]) => typeof url === 'string' && url.includes('/connect/token'),
        )

        expect(refreshCall?.[1]).toStrictEqual(
          expect.objectContaining({ signal: controller.signal }),
        )
      } finally {
        vi.useRealTimers()
      }
    })

    it('should fall back to full OIDC when token refresh fails', async () => {
      vi.useFakeTimers()
      try {
        setupSuccessfulLogin()
        const api = await createApi({ syncIntervalMinutes: false })

        // Advance past token expiry
        vi.advanceTimersByTime(3601 * MS_PER_SECOND)

        // Refresh fails
        mockFetch.mockRejectedValueOnce(new Error('refresh failed'))
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
      const api = await createApi({ syncIntervalMinutes: false })

      // API call fails with 401
      mockRequest.mockRejectedValueOnce(httpUnauthorized())
      // Refresh succeeds
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({
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
        const api = await createApi({ syncIntervalMinutes: false })

        // Advance past token expiry
        vi.advanceTimersByTime(3601 * MS_PER_SECOND)

        // Refresh succeeds but response has no refresh_token
        mockFetch.mockResolvedValueOnce(
          mockFetchResponse({
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

  describe('par and token exchange failures', () => {
    it('should handle PAR failure gracefully', async () => {
      const logger = createLogger()
      mockFetch.mockRejectedValueOnce(new Error('PAR endpoint down'))
      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        logger,
        password: 'pass',
        transport: mockHttpClient,
        username: 'user@test.com',
      })

      expect(api.isAuthenticated()).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(
        'Session resume failed:',
        expect.any(Error),
      )
    })

    it('should handle token exchange failure gracefully', async () => {
      const logger = createLogger()
      // PAR succeeds
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({ request_uri: 'urn:test' }),
      )
      // Redirect chain to login page
      mockFetch
        .mockResolvedValueOnce(mockFetchResponse(cognitoLoginPage(), {}, 200))
        // Credential POST
        .mockResolvedValueOnce(
          mockFetchResponse(
            '',
            { location: 'https://auth.melcloudhome.com/callback?code=x' },
            302,
          ),
        )
        // Callback -> melcloudhome://
        .mockResolvedValueOnce(
          mockFetchResponse(
            '',
            { location: 'melcloudhome://?code=auth-code&state=y' },
            302,
          ),
        )
      // Token exchange fails
      mockFetch.mockRejectedValueOnce(new Error('token exchange failed'))

      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        logger,
        password: 'pass',
        transport: mockHttpClient,
        username: 'user@test.com',
      })

      expect(api.isAuthenticated()).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(
        'Session resume failed:',
        expect.any(Error),
      )
    })
  })

  describe('cookie handling in auth flow', () => {
    it('should store and send Set-Cookie headers across redirect requests', async () => {
      // PAR
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({ request_uri: 'urn:test' }),
      )
      mockFetch
        .mockResolvedValueOnce(
          mockFetchResponse(
            '',
            {
              location: `${COGNITO}/login`,
              'set-cookie': ['session=abc; Path=/; Secure'],
            },
            302,
          ),
        )
        .mockResolvedValueOnce(
          mockFetchResponse(
            cognitoLoginPage(`${COGNITO}/login?id=test`),
            {},
            200,
          ),
        )
        // Credential POST
        .mockResolvedValueOnce(
          mockFetchResponse(
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
          mockFetchResponse(
            '',
            { location: 'melcloudhome://?code=auth-code&state=y' },
            302,
          ),
        )
      // Token exchange
      mockFetch.mockResolvedValueOnce(mockFetchResponse(mockTokenResponse))
      // GET /context
      mockRequest.mockResolvedValueOnce(mockResponse(mockContext, {}, 200))

      const api = await createApi()

      expect(api.isAuthenticated()).toBe(true)
    })

    it('should ignore invalid Set-Cookie values', async () => {
      // PAR
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({ request_uri: 'urn:test' }),
      )
      mockFetch
        .mockResolvedValueOnce(
          mockFetchResponse(
            cognitoLoginPage(`${COGNITO}/login?id=test`),
            { 'set-cookie': [''] },
            200,
          ),
        )
        // Credential POST
        .mockResolvedValueOnce(
          mockFetchResponse(
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
          mockFetchResponse(
            '',
            { location: 'melcloudhome://?code=auth-code&state=y' },
            302,
          ),
        )
      // Token exchange
      mockFetch.mockResolvedValueOnce(mockFetchResponse(mockTokenResponse))
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

    it('should log structured error data for HTTP errors', async () => {
      setupSuccessfulLogin()
      const logger = createLogger()
      const api = await createApi({ logger })
      const httpError = new HttpError(
        'Request failed',
        { data: {}, headers: {}, status: 500 },
        { url: '/context' },
      )
      mockRequest.mockRejectedValueOnce(httpError)
      await api.list()

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Request failed'),
      )
    })
  })
})
