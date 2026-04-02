import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MELCloudHomeAPI } from '../../src/services/home-api.ts'
import type { HomeAPIConfig, Logger } from '../../src/services/index.ts'
import type {
  HomeBuilding,
  HomeClaim,
  HomeContext,
  HomeEnergyData,
  HomeErrorLogEntry,
  HomeReportData,
} from '../../src/types/index.ts'
import { cast } from '../helpers.ts'

const BASE_URL = 'https://melcloudhome.com'
const MILLISECONDS_IN_SECOND = 1000
const COGNITO = 'https://live-melcloudhome.auth.eu-west-1.amazoncognito.com'

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

const userClaims: HomeClaim[] = [
  { type: 'sub', value: 'user-123', valueType: 'null' },
  { type: 'given_name', value: 'John', valueType: 'null' },
  { type: 'family_name', value: 'Doe', valueType: 'null' },
  { type: 'email', value: 'john@example.com', valueType: 'null' },
  { type: 'bff:session_expires_in', value: '28800', valueType: 'null' },
]

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
  guestBuildings: [mockBuilding],
  language: 'fr',
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

const mockRequest = vi.fn()
const mockAxiosInstance = {
  defaults: { baseURL: undefined as string | undefined },
  request: mockRequest,
}

vi.mock(import('axios'), async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    default: cast({
      create: vi.fn().mockReturnValue(mockAxiosInstance),
      isAxiosError: original.default.isAxiosError,
    }),
  }
})

const mockResponse = (
  data: unknown,
  headers: Record<string, string | string[]> = {},
  status = 200,
): {
  config: object
  data: unknown
  headers: Record<string, string | string[]>
  status: number
} => ({
  config: {},
  data,
  headers,
  status,
})

const createLogger = (): Logger => ({
  error: vi.fn<(...data: unknown[]) => void>(),
  log: vi.fn<(...data: unknown[]) => void>(),
})

/*
 * Simulate the OIDC redirect chain:
 *   1. GET /bff/login → 302 → Cognito authorize → 302 → Cognito login page (200)
 *   2. POST credentials → 302 → callback URL
 *   3. GET callback → 302 chain → final 200
 *   4. GET /bff/user → 200 with claims
 */
const setupSuccessfulLogin = (): void => {
  const callbackUrl =
    'https://auth.melcloudhome.com/signin-oidc-meu?code=abc&state=xyz'
  mockRequest
    .mockResolvedValueOnce(
      mockResponse('', { location: `${BASE_URL}/auth-redirect` }, 302),
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
    .mockResolvedValueOnce(mockResponse('', { location: callbackUrl }, 302))
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
      mockResponse('', { location: `${BASE_URL}/signin-oidc?code=final` }, 302),
    )
    .mockResolvedValueOnce(mockResponse('', {}, 200))
    .mockResolvedValueOnce(mockResponse(userClaims, {}, 200))
}

describe('melcloud home API', () => {
  let melCloudHomeApi: { create: typeof MELCloudHomeAPI.create } = cast(null)

  beforeEach(async () => {
    mockRequest.mockReset()
    vi.clearAllMocks()
    mockAxiosInstance.defaults.baseURL = BASE_URL
    ;({ MELCloudHomeAPI: melCloudHomeApi } =
      await import('../../src/services/home-api.ts'))
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
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        sub: 'user-123',
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

      mockRequest.mockRejectedValueOnce(new Error('network'))

      await expect(
        api.authenticate({ password: 'wrong', username: 'u@t.com' }),
      ).rejects.toThrow('network')

      expect(api.user).toBeNull()
    })

    it('should log and return false on stored credential failure', async () => {
      const logger = createLogger()
      mockRequest.mockRejectedValueOnce(new Error('network'))
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
      mockRequest.mockRejectedValueOnce(new Error('bad credentials'))

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
          url: '/api/ataunit/device-1',
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
          url: '/api/ataunit/device-1/errorlog',
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
          expect.objectContaining({ url: '/api/user/context' }),
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

        // Advance past the 28800s session expiry
        vi.advanceTimersByTime(28_801 * MILLISECONDS_IN_SECOND)

        setupSuccessfulLogin()
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
  })

  describe('redirect handling', () => {
    it('should stop on empty location header', async () => {
      mockRequest
        .mockResolvedValueOnce(mockResponse('', { location: '' }, 302))
        .mockResolvedValueOnce(mockResponse(userClaims, {}, 200))
      const api = await melCloudHomeApi.create({
        baseURL: BASE_URL,
        password: 'pass',
        username: 'user@test.com',
      })

      expect(api.isAuthenticated()).toBe(false)
    })

    it('should stop on missing location header in redirect chain', async () => {
      mockRequest
        .mockResolvedValueOnce(
          mockResponse('', { location: `${BASE_URL}/step1` }, 302),
        )
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

    it('should throw on too many redirects', async () => {
      Array.from({ length: 21 }, (_unused, index) =>
        mockRequest.mockResolvedValueOnce(
          mockResponse(
            '',
            { location: `${BASE_URL}/redirect-${String(index)}` },
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

    it('should resolve relative redirect URLs', async () => {
      mockRequest
        .mockResolvedValueOnce(
          mockResponse('', { location: `${BASE_URL}/auth-redirect` }, 302),
        )
        .mockResolvedValueOnce(
          mockResponse('', { location: '/relative-path' }, 302),
        )
        .mockResolvedValueOnce(
          mockResponse(
            cognitoLoginPage(`${COGNITO}/login?client_id=test`),
            {},
            200,
          ),
        )
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
        .mockResolvedValueOnce(mockResponse('', {}, 200))
        .mockResolvedValueOnce(mockResponse(userClaims, {}, 200))
      const api = await createApi()

      expect(api.isAuthenticated()).toBe(true)
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${BASE_URL}/relative-path`,
        }),
      )
    })
  })

  describe('form parsing', () => {
    it('should throw when form action is missing', async () => {
      mockRequest.mockResolvedValueOnce(
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
      mockRequest
        .mockResolvedValueOnce(
          mockResponse(
            cognitoLoginPage('/login?client_id=test&amp;state=abc'),
            {},
            200,
          ),
        )
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
        .mockResolvedValueOnce(mockResponse('', {}, 200))
        .mockResolvedValueOnce(mockResponse(userClaims, {}, 200))
      await createApi()

      expect(mockRequest).toHaveBeenCalledWith(
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
      mockRequest
        .mockResolvedValueOnce(mockResponse(htmlWithEdgeCases, {}, 200))
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
        .mockResolvedValueOnce(mockResponse('', {}, 200))
        .mockResolvedValueOnce(mockResponse(userClaims, {}, 200))
      const api = await createApi()

      expect(api.isAuthenticated()).toBe(true)
    })

    it('should handle missing claim types with empty string fallback', async () => {
      const partialClaims: HomeClaim[] = [
        { type: 'email', value: 'only@email.com', valueType: 'null' },
      ]
      mockRequest
        .mockResolvedValueOnce(mockResponse(cognitoLoginPage(), {}, 200))
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
        .mockResolvedValueOnce(mockResponse('', {}, 200))
        .mockResolvedValueOnce(mockResponse(partialClaims, {}, 200))
      const api = await createApi()

      expect(api.user).toStrictEqual({
        email: 'only@email.com',
        firstName: '',
        lastName: '',
        sub: '',
      })
    })

    it('should use absolute form action as-is', async () => {
      const absoluteAction = `${COGNITO}/login?client_id=test`
      mockRequest
        .mockResolvedValueOnce(
          mockResponse(cognitoLoginPage(absoluteAction), {}, 200),
        )
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
        .mockResolvedValueOnce(mockResponse('', {}, 200))
        .mockResolvedValueOnce(mockResponse(userClaims, {}, 200))
      await createApi()

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ url: absoluteAction }),
      )
    })

    it('should handle missing location header from credential submission', async () => {
      mockRequest
        .mockResolvedValueOnce(mockResponse(cognitoLoginPage(), {}, 200))
        .mockResolvedValueOnce(mockResponse('', {}, 302))
        .mockResolvedValueOnce(mockResponse('', {}, 200))
        .mockResolvedValueOnce(mockResponse(userClaims, {}, 200))
      const api = await createApi()

      expect(api.isAuthenticated()).toBe(true)
    })
  })

  describe('cookie handling', () => {
    it('should store and send Set-Cookie headers across requests', async () => {
      mockRequest
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
        .mockResolvedValueOnce(mockResponse('', {}, 200))
        .mockResolvedValueOnce(mockResponse(userClaims, {}, 200))
      const api = await createApi()

      expect(api.isAuthenticated()).toBe(true)
    })

    it('should ignore invalid Set-Cookie values', async () => {
      mockRequest
        .mockResolvedValueOnce(
          mockResponse(
            cognitoLoginPage(`${COGNITO}/login?id=test`),
            { 'set-cookie': [''] },
            200,
          ),
        )
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
        .mockResolvedValueOnce(mockResponse('', {}, 200))
        .mockResolvedValueOnce(mockResponse(userClaims, {}, 200))

      await expect(createApi()).resolves.toBeDefined()
    })
  })

  describe('logging', () => {
    it('should produce structured log output for requests', async () => {
      setupSuccessfulLogin()
      const logger = createLogger()
      await createApi({ logger })

      const {
        mock: { calls },
      } = vi.mocked(logger.log)

      expect(calls.length).toBeGreaterThan(0)

      for (const [message] of calls) {
        expect(String(message)).toContain('API response')
      }
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
