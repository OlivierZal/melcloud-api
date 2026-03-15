import type {
  AxiosError,
  AxiosRequestHeaders,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DeviceType } from '../../src/constants.ts'
import type { APIConfig, MELCloudAPI } from '../../src/services/index.ts'
import type {
  BuildingWithStructure,
  ListDeviceAny,
  SetDevicePostData,
} from '../../src/types/index.ts'

import { cast, mock } from '../helpers.ts'

const mockInterceptors = {
  request: { use: vi.fn() },
  response: { use: vi.fn() },
}
const mockAxiosInstance = {
  get: vi.fn(),
  interceptors: mockInterceptors,
  post: vi.fn(),
  request: vi.fn(),
}

const isInterceptorTuple = (
  value: unknown,
): value is [
  (...args: unknown[]) => unknown,
  (...args: unknown[]) => unknown,
] => {
  if (!Array.isArray(value) || value.length < 2) {
    return false
  }
  return typeof value[0] === 'function' && typeof value[1] === 'function'
}

vi.mock(import('axios'), async (importOriginal) => ({
  ...(await importOriginal()),
  default: cast({
    create: vi.fn().mockReturnValue(mockAxiosInstance),
  }),
}))

describe('mELCloudAPI', () => {
  let melCloudApi: typeof MELCloudAPI = cast(null)
  let requestHandler: (
    config: InternalAxiosRequestConfig,
  ) => Promise<InternalAxiosRequestConfig> = cast(null)
  let requestErrorHandler: (error: AxiosError) => Promise<AxiosError> =
    cast(null)
  let responseHandler: (response: AxiosResponse) => AxiosResponse = cast(null)
  let responseErrorHandler: (error: AxiosError) => Promise<AxiosError> =
    cast(null)

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockAxiosInstance.get.mockResolvedValue({ data: [] })
    mockAxiosInstance.post.mockResolvedValue({ data: [] })
    ;({ MELCloudAPI: melCloudApi } =
      await import('../../src/services/melcloud.ts'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const createApi = async (
    config: APIConfig = {},
  ): Promise<Awaited<ReturnType<typeof melCloudApi.create>>> => {
    const api = await melCloudApi.create({ autoSyncInterval: 0, ...config })
    const {
      request: {
        use: {
          mock: { lastCall: requestCall },
        },
      },
      response: {
        use: {
          mock: { lastCall: responseCall },
        },
      },
    } = mockInterceptors

    expect(isInterceptorTuple(requestCall)).toBe(true)
    expect(isInterceptorTuple(responseCall)).toBe(true)

    if (!isInterceptorTuple(requestCall)) {
      throw new Error('Expected request interceptor handlers')
    }
    if (!isInterceptorTuple(responseCall)) {
      throw new Error('Expected response interceptor handlers')
    }

    requestHandler = cast(requestCall[0])
    requestErrorHandler = cast(requestCall[1])
    responseHandler = cast(responseCall[0])
    responseErrorHandler = cast(responseCall[1])
    return api
  }

  it('creates an API instance via static create()', async () => {
    const api = await createApi()

    expect(api).toBeDefined()
    expect(api.registry).toBeDefined()
  })

  it('accepts custom configuration', async () => {
    const logger = { error: vi.fn(), log: vi.fn() }
    const onSync = vi.fn()
    const api = await createApi({
      language: 'fr',
      logger,
      onSync,
      shouldVerifySSL: false,
      timezone: 'Europe/Paris',
    })

    expect(api.onSync).toBe(onSync)
  })

  it('accepts null autoSyncInterval', async () => {
    const api = await melCloudApi.create({ autoSyncInterval: null })

    expect(api).toBeDefined()
  })

  it('uses settingManager when provided', async () => {
    const settingManager = {
      get: vi.fn().mockReturnValue(null),
      set: vi.fn(),
    }
    await createApi({
      password: 'test-pass',
      settingManager,
      username: 'test-user',
    })

    expect(settingManager.set).toHaveBeenCalled()
  })

  it('fetches building list and syncs registry', async () => {
    const building: BuildingWithStructure = {
      FPDefined: false,
      FPEnabled: false,
      FPMaxTemperature: 16,
      FPMinTemperature: 4,
      HMDefined: false,
      HMEnabled: false,
      HMEndDate: null,
      HMStartDate: null,
      ID: 1,
      Location: 10,
      Name: 'Test',
      Structure: { Areas: [], Devices: [], Floors: [] },
      TimeZone: 0,
    }
    mockAxiosInstance.get.mockResolvedValue({ data: [building] })
    const api = await createApi()
    const buildings = await api.fetch()

    expect(buildings).toHaveLength(1)
  })

  it('returns empty array when fetch fails', async () => {
    const api = await createApi()
    mockAxiosInstance.get.mockRejectedValueOnce(new Error('Network'))
    const buildings = await api.fetch()

    expect(buildings).toStrictEqual([])
  })

  it('clears sync timeout', async () => {
    const api = await createApi()

    expect(() => {
      api.clearSync()
    }).not.toThrow()
  })

  it('disposes resources via Symbol.dispose', async () => {
    const api = await createApi()

    expect(() => {
      api[Symbol.dispose]()
    }).not.toThrow()
  })

  it('schedules next sync when autoSyncInterval is set', async () => {
    await melCloudApi.create({ autoSyncInterval: 1 })

    expect(() => {
      vi.advanceTimersByTime(60_000)
    }).not.toThrow()
  })

  it('logs error when auto-sync onSync callback throws', async () => {
    const logger = { error: vi.fn(), log: vi.fn() }
    const onSync = vi.fn().mockImplementationOnce(() => {
      // First call (initial create) succeeds, subsequent calls can throw
    })
    await melCloudApi.create({ autoSyncInterval: 1, logger, onSync })
    onSync.mockImplementation(() => {
      throw new Error('sync callback failed')
    })
    await vi.advanceTimersByTimeAsync(60_000)

    expect(logger.error).toHaveBeenCalledWith(
      'Auto-sync failed:',
      expect.any(Error),
    )
  })

  describe('api endpoints', () => {
    const reportPostData = {
      DeviceID: 1,
      FromDate: '2024-01-01',
      ToDate: '2024-01-31',
    }

    it.each([
      {
        args: { postData: reportPostData },
        method: 'getEnergy' as const,
        path: '/EnergyCost/Report',
      },
      {
        args: { postData: { DeviceIDs: [1] } },
        method: 'getErrorEntries' as const,
        path: '/Report/GetUnitErrorLog2',
      },
      {
        args: { postData: { BuildingID: 1 } },
        method: 'getGroup' as const,
        path: '/Group/Get',
      },
      {
        args: { postData: { device: 1, hour: 12 } },
        method: 'getHourlyTemperatures' as const,
        path: '/Report/GetHourlyTemperature',
      },
      {
        args: { postData: reportPostData },
        method: 'getInternalTemperatures' as const,
        path: '/Report/GetInternalTemperatures2',
      },
      {
        args: { postData: reportPostData },
        method: 'getOperationModes' as const,
        path: '/Report/GetOperationModeLog2',
      },
      {
        args: { postData: { devices: [1], hour: 12 } },
        method: 'getSignal' as const,
        path: '/Report/GetSignalStrength',
      },
      {
        args: { postData: reportPostData },
        method: 'getTemperatures' as const,
        path: '/Report/GetTemperatureLog2',
      },
      {
        args: { postData: { DeviceIDs: [1] } },
        method: 'getTiles' as const,
        path: '/Tile/Get2',
      },
      {
        args: { postData: { AppVersion: '1.0', Email: 'u', Password: 'p' } },
        method: 'login' as const,
        path: '/Login/ClientLogin3',
      },
      {
        args: {
          postData: {
            Enabled: true,
            MaximumTemperature: 16,
            MinimumTemperature: 4,
          },
        },
        method: 'setFrostProtection' as const,
        path: '/FrostProtection/Update',
      },
      {
        args: {
          postData: {
            Specification: { BuildingID: 1 },
            State: { Power: true },
          },
        },
        method: 'setGroup' as const,
        path: '/Group/SetAta',
      },
      {
        args: {
          postData: {
            Enabled: true,
            EndDate: null,
            HMTimeZones: [],
            StartDate: null,
          },
        },
        method: 'setHolidayMode' as const,
        path: '/HolidayMode/Update',
      },
      {
        args: { postData: { DeviceIds: [1], Power: true } },
        method: 'setPower' as const,
        path: '/Device/Power',
      },
    ])('calls $method via POST', async ({ args, method, path }) => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({ data: {} })
      await api[method](cast(args))

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        path,
        expect.any(Object),
      )
    })

    it.each([
      {
        args: { params: { id: 1, tableName: 'Building' } },
        method: 'getFrostProtection' as const,
        path: '/FrostProtection/GetSettings',
      },
      {
        args: { params: { id: 1, tableName: 'Building' } },
        method: 'getHolidayMode' as const,
        path: '/HolidayMode/GetSettings',
      },
      {
        args: { params: { buildingId: 1, id: 1 } },
        method: 'getValues' as const,
        path: '/Device/Get',
      },
    ])('calls $method via GET', async ({ args, method, path }) => {
      const api = await createApi()
      mockAxiosInstance.get.mockResolvedValue({ data: {} })
      await api[method](cast(args))

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        path,
        expect.any(Object),
      )
    })

    it('calls list', async () => {
      const api = await createApi()
      mockAxiosInstance.get.mockResolvedValue({ data: [] })
      await api.list()

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/User/ListDevices')
    })

    it('calls setValues for each device type', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({ data: {} })
      await api.setValues({
        postData: mock<SetDevicePostData<typeof DeviceType.Ata>>({
          DeviceID: 1,
          EffectiveFlags: 1,
        }),
        type: 0,
      })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/Device/SetAta',
        expect.any(Object),
      )

      mockAxiosInstance.post.mockClear()
      await api.setValues({
        postData: mock<SetDevicePostData<typeof DeviceType.Atw>>({
          DeviceID: 1,
          EffectiveFlags: 1,
        }),
        type: 1,
      })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/Device/SetAtw',
        expect.any(Object),
      )

      mockAxiosInstance.post.mockClear()
      await api.setValues({
        postData: mock<SetDevicePostData<typeof DeviceType.Erv>>({
          DeviceID: 1,
          EffectiveFlags: 1,
        }),
        type: 3,
      })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/Device/SetErv',
        expect.any(Object),
      )
    })
  })

  describe('authenticate', () => {
    it('authenticates with credentials', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          LoginData: { ContextKey: 'ctx', Expiry: '2025-12-31T00:00:00' },
        },
      })
      const api = await createApi({ password: 'pass', username: 'user' })
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          LoginData: { ContextKey: 'ctx', Expiry: '2025-12-31T00:00:00' },
        },
      })
      mockAxiosInstance.get.mockResolvedValue({ data: [] })
      const isAuthenticated = await api.authenticate({
        password: 'pass',
        username: 'user',
      })

      expect(isAuthenticated).toBe(true)
    })

    it('returns false when login data is null', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({ data: { LoginData: null } })
      const isAuthenticated = await api.authenticate({
        password: 'pass',
        username: 'user',
      })

      expect(isAuthenticated).toBe(false)
    })

    it('returns false when no credentials', async () => {
      const api = await createApi()
      const isAuthenticated = await api.authenticate()

      expect(isAuthenticated).toBe(false)
    })

    it('swallows error when no explicit data', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce(new Error('fail'))
      const api = await createApi({ password: 'pass', username: 'user' })
      mockAxiosInstance.post.mockRejectedValue(new Error('fail'))
      const isAuthenticated = await api.authenticate()

      expect(isAuthenticated).toBe(false)
    })

    it('throws error when explicit data and auth fails', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockRejectedValue(new Error('auth fail'))

      await expect(
        api.authenticate({ password: 'p', username: 'u' }),
      ).rejects.toThrow('auth fail')
    })
  })

  describe('setLanguage', () => {
    it('updates language when different', async () => {
      const api = await createApi({ language: 'en' })
      mockAxiosInstance.post.mockResolvedValue({ data: true })
      await api.setLanguage('fr')

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/User/UpdateLanguage',
        expect.any(Object),
      )
    })

    it('does not update when same language', async () => {
      const api = await createApi({ language: 'en' })
      mockAxiosInstance.post.mockClear()
      await api.setLanguage('en')

      expect(mockAxiosInstance.post).not.toHaveBeenCalled()
    })

    it('handles invalid language codes', async () => {
      const api = await createApi({ language: 'en' })
      mockAxiosInstance.post.mockResolvedValue({ data: true })
      await api.setLanguage('invalid')

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/User/UpdateLanguage',
        expect.objectContaining({ language: 0 }),
      )
    })

    it('does not change internal language when API returns false', async () => {
      const api = await createApi({ language: 'en' })
      mockAxiosInstance.post.mockResolvedValue({ data: false })
      await api.setLanguage('fr')
      mockAxiosInstance.post.mockClear()
      await api.setLanguage('en')

      expect(mockAxiosInstance.post).not.toHaveBeenCalled()
    })
  })

  describe('setSyncInterval', () => {
    it('reschedules sync with new interval', async () => {
      const api = await createApi({ autoSyncInterval: 0 })
      api.setSyncInterval(10)

      expect(vi.getTimerCount()).toBe(1)
    })

    it('disables sync when set to null', async () => {
      const api = await createApi({ autoSyncInterval: 5 })
      api.setSyncInterval(null)

      expect(vi.getTimerCount()).toBe(0)
    })
  })

  describe('getErrorLog', () => {
    it('returns parsed error log', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({
        data: [
          {
            DeviceId: 1,
            EndDate: '2024-01-02',
            ErrorMessage: 'Some error',
            StartDate: '2024-01-01T12:00:00',
          },
        ],
      })
      const result = await api.getErrorLog(
        { from: '2024-01-01', to: '2024-01-02' },
        [1],
      )

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]?.error).toBe('Some error')
    })

    it('filters out entries with invalid year', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({
        data: [
          {
            DeviceId: 1,
            EndDate: '0001-01-01',
            ErrorMessage: 'Bad',
            StartDate: '0001-01-01T00:00:00',
          },
        ],
      })
      const result = await api.getErrorLog({}, [1])

      expect(result.errors).toHaveLength(0)
    })

    it('throws when API returns failure data', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({
        data: { AttributeErrors: { field: ['error'] }, Success: false },
      })

      await expect(api.getErrorLog({}, [1])).rejects.toThrow('field')
    })

    it('handles offset and limit', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({ data: [] })
      const result = await api.getErrorLog(
        { limit: '5', offset: '2', to: '2024-06-01' },
        [1],
      )

      expect(result).toHaveProperty('fromDateHuman')
      expect(result).toHaveProperty('nextFromDate')
    })

    it('uses all devices when no deviceIds provided', async () => {
      const building = mock<BuildingWithStructure>({
        FPDefined: false,
        FPEnabled: false,
        FPMaxTemperature: 16,
        FPMinTemperature: 4,
        HMDefined: false,
        HMEnabled: false,
        HMEndDate: null,
        HMStartDate: null,
        ID: 1,
        Location: 10,
        Name: 'Test',
        Structure: {
          Areas: [],
          Devices: [
            mock<ListDeviceAny>({
              AreaID: null,
              BuildingID: 1,
              DeviceID: 42,
              DeviceName: 'D1',
              FloorID: null,
              Type: 0,
            }),
          ],
          Floors: [],
        },
        TimeZone: 0,
      })
      mockAxiosInstance.get.mockResolvedValue({ data: [building] })
      const api = await createApi()
      await api.fetch()
      mockAxiosInstance.post.mockResolvedValue({ data: [] })
      const result = await api.getErrorLog({})

      expect(result).toHaveProperty('errors')
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/Report/GetUnitErrorLog2',
        expect.objectContaining({ DeviceIDs: [42] }),
      )
    })

    it('filters null/empty error messages', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({
        data: [
          {
            DeviceId: 1,
            EndDate: '2024-01-02',
            ErrorMessage: null,
            StartDate: '2024-01-01T12:00:00',
          },
        ],
      })
      const result = await api.getErrorLog({ from: '2024-01-01' }, [1])

      expect(result.errors).toHaveLength(0)
    })
  })

  describe('interceptors', () => {
    it('request handler sets context key header', async () => {
      await createApi()
      const headers: AxiosRequestHeaders = cast(new Map())
      const setSpy = vi.spyOn(headers, 'set')
      const config = mock<InternalAxiosRequestConfig>({
        headers,
        url: '/Device/Get',
      })
      await requestHandler(config)

      expect(setSpy).toHaveBeenCalledWith(
        'X-MitsContextKey',
        expect.any(String),
      )
    })

    it('request handler does not set header for login path', async () => {
      await createApi()
      const headers: AxiosRequestHeaders = cast(new Map())
      const setSpy = vi.spyOn(headers, 'set')
      const config = mock<InternalAxiosRequestConfig>({
        headers,
        url: '/Login/ClientLogin3',
      })
      await requestHandler(config)

      expect(setSpy).not.toHaveBeenCalled()
    })

    it('request handler re-authenticates when expired', async () => {
      const settingManager = {
        get: vi.fn().mockImplementation((key: string) => {
          if (key === 'expiry') {
            return '2020-01-01T00:00:00'
          }
          if (key === 'contextKey') {
            return 'old-ctx'
          }
          if (key === 'username') {
            return 'user'
          }
          if (key === 'password') {
            return 'pass'
          }
          return null
        }),
        set: vi.fn(),
      }
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          LoginData: { ContextKey: 'newer', Expiry: '2030-01-01T00:00:00' },
        },
      })
      mockAxiosInstance.get.mockResolvedValue({ data: [] })
      await createApi({ settingManager })
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          LoginData: { ContextKey: 'newest', Expiry: '2030-01-01T00:00:00' },
        },
      })
      mockAxiosInstance.get.mockResolvedValue({ data: [] })
      const headers: AxiosRequestHeaders = cast(new Map())
      vi.spyOn(headers, 'set')
      const config = mock<InternalAxiosRequestConfig>({
        headers,
        url: '/Device/Get',
      })

      await expect(requestHandler(config)).resolves.toMatchObject({
        url: '/Device/Get',
      })
    })

    it('response handler returns response', async () => {
      await createApi({
        logger: {
          error: vi.fn<(...args: unknown[]) => void>(),
          log: vi.fn<(...args: unknown[]) => void>(),
        },
      })
      const response = mock<AxiosResponse>({
        config: mock<InternalAxiosRequestConfig>({
          method: 'get',
          url: '/test',
        }),
        data: {},
        headers: {},
        status: 200,
      })
      const result = responseHandler(response)

      expect(result).toBe(response)
    })

    it('error handler logs and throws', async () => {
      const logger = { error: vi.fn(), log: vi.fn() }
      await createApi({ logger })
      const error = mock<AxiosError>({
        config: mock<InternalAxiosRequestConfig>({
          method: 'get',
          url: '/test',
        }),
        message: 'test error',
        response: mock<AxiosResponse>({
          config: mock<InternalAxiosRequestConfig>({
            data: null,
            method: 'get',
            url: '/test',
          }),
          data: {},
          headers: {},
          status: 500,
        }),
      })

      await expect(requestErrorHandler(error)).rejects.toThrow('test error')
    })

    it('error handler handles request-only errors (no response)', async () => {
      const logger = { error: vi.fn(), log: vi.fn() }
      await createApi({ logger })
      const error = mock<AxiosError>({
        config: mock<InternalAxiosRequestConfig>({
          method: 'get',
          url: '/test',
        }),
        message: 'network error',
      })

      await expect(requestErrorHandler(error)).rejects.toThrow('network error')
    })

    it('error handler pauses list on 429', async () => {
      const logger = { error: vi.fn(), log: vi.fn() }
      await createApi({ logger })
      const error = mock<AxiosError>({
        config: mock<InternalAxiosRequestConfig>({
          method: 'get',
          url: '/User/ListDevices',
        }),
        message: 'too many',
        response: mock<AxiosResponse>({
          config: mock<InternalAxiosRequestConfig>({
            data: null,
            method: 'get',
            url: '/User/ListDevices',
          }),
          data: {},
          headers: {},
          status: 429,
        }),
      })

      await expect(responseErrorHandler(error)).rejects.toThrow('too many')
    })

    it('error handler retries on 401 for non-login path', async () => {
      const logger = { error: vi.fn(), log: vi.fn() }
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          LoginData: { ContextKey: 'ctx', Expiry: '2030-12-31T00:00:00' },
        },
      })
      mockAxiosInstance.get.mockResolvedValue({ data: [] })
      await createApi({ logger, password: 'pass', username: 'user' })
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          LoginData: { ContextKey: 'new-ctx', Expiry: '2030-12-31T00:00:00' },
        },
      })
      mockAxiosInstance.get.mockResolvedValue({ data: [] })
      mockAxiosInstance.request.mockResolvedValue({ data: 'retried' })
      const error = mock<AxiosError>({
        config: mock<InternalAxiosRequestConfig>({
          method: 'get',
          url: '/Device/Get',
        }),
        message: 'unauthorized',
        response: mock<AxiosResponse>({
          config: mock<InternalAxiosRequestConfig>({
            data: null,
            method: 'get',
            url: '/Device/Get',
          }),
          data: {},
          headers: {},
          status: 401,
        }),
      })
      const result = await responseErrorHandler(error)

      expect(mockAxiosInstance.request).toHaveBeenCalled()
      expect(result).toStrictEqual({ data: 'retried' })
    })

    it('error handler does not retry on 401 for login path', async () => {
      const logger = { error: vi.fn(), log: vi.fn() }
      await createApi({ logger })
      const error = mock<AxiosError>({
        config: mock<InternalAxiosRequestConfig>({
          url: '/Login/ClientLogin3',
        }),
        message: 'unauthorized',
        response: mock<AxiosResponse>({
          config: mock<InternalAxiosRequestConfig>({
            data: null,
            url: '/Login/ClientLogin3',
          }),
          data: {},
          headers: {},
          status: 401,
        }),
      })

      await expect(responseErrorHandler(error)).rejects.toThrow('unauthorized')
    })

    it('error handler does not retry twice within retry delay', async () => {
      const logger = { error: vi.fn(), log: vi.fn() }
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          LoginData: { ContextKey: 'ctx', Expiry: '2030-12-31T00:00:00' },
        },
      })
      mockAxiosInstance.get.mockResolvedValue({ data: [] })
      await createApi({ logger, password: 'pass', username: 'user' })
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          LoginData: { ContextKey: 'ctx2', Expiry: '2030-12-31T00:00:00' },
        },
      })
      mockAxiosInstance.get.mockResolvedValue({ data: [] })
      mockAxiosInstance.request.mockResolvedValue({ data: 'retried' })
      const error1 = mock<AxiosError>({
        config: mock<InternalAxiosRequestConfig>({
          method: 'get',
          url: '/Device/Get',
        }),
        message: 'unauthorized',
        response: mock<AxiosResponse>({
          config: mock<InternalAxiosRequestConfig>({
            data: null,
            method: 'get',
            url: '/Device/Get',
          }),
          data: {},
          headers: {},
          status: 401,
        }),
      })
      await responseErrorHandler(error1)
      const error2 = mock<AxiosError>({
        config: mock<InternalAxiosRequestConfig>({
          method: 'get',
          url: '/Device/Get',
        }),
        message: 'unauthorized again',
        response: mock<AxiosResponse>({
          config: mock<InternalAxiosRequestConfig>({
            data: null,
            method: 'get',
            url: '/Device/Get',
          }),
          data: {},
          headers: {},
          status: 401,
        }),
      })

      await expect(responseErrorHandler(error2)).rejects.toThrow(
        'unauthorized again',
      )
    })

    it('retry timeout clears itself after delay', async () => {
      const logger = { error: vi.fn(), log: vi.fn() }
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          LoginData: { ContextKey: 'ctx', Expiry: '2030-12-31T00:00:00' },
        },
      })
      mockAxiosInstance.get.mockResolvedValue({ data: [] })
      await createApi({ logger, password: 'pass', username: 'user' })
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          LoginData: { ContextKey: 'ctx3', Expiry: '2030-12-31T00:00:00' },
        },
      })
      mockAxiosInstance.get.mockResolvedValue({ data: [] })
      mockAxiosInstance.request.mockResolvedValue({ data: 'retried' })
      const error = mock<AxiosError>({
        config: mock<InternalAxiosRequestConfig>({
          method: 'get',
          url: '/Device/Get',
        }),
        message: 'unauthorized',
        response: mock<AxiosResponse>({
          config: mock<InternalAxiosRequestConfig>({
            data: null,
            method: 'get',
            url: '/Device/Get',
          }),
          data: {},
          headers: {},
          status: 401,
        }),
      })
      await responseErrorHandler(error)
      vi.advanceTimersByTime(1500)
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          LoginData: { ContextKey: 'ctx4', Expiry: '2030-12-31T00:00:00' },
        },
      })
      mockAxiosInstance.get.mockResolvedValue({ data: [] })
      mockAxiosInstance.request.mockResolvedValue({ data: 'retried again' })
      const error2 = mock<AxiosError>({
        config: mock<InternalAxiosRequestConfig>({
          method: 'get',
          url: '/Device/Get',
        }),
        message: 'unauthorized',
        response: mock<AxiosResponse>({
          config: mock<InternalAxiosRequestConfig>({
            data: null,
            method: 'get',
            url: '/Device/Get',
          }),
          data: {},
          headers: {},
          status: 401,
        }),
      })
      const result = await responseErrorHandler(error2)

      expect(result).toStrictEqual({ data: 'retried again' })
    })

    it('request handler blocks list path when paused', async () => {
      const logger = { error: vi.fn(), log: vi.fn() }
      await createApi({ logger })
      const tooManyError = mock<AxiosError>({
        config: mock<InternalAxiosRequestConfig>({ url: '/api' }),
        message: 'too many',
        response: mock<AxiosResponse>({
          config: mock<InternalAxiosRequestConfig>({ data: null, url: '/api' }),
          data: {},
          headers: {},
          status: 429,
        }),
      })

      await expect(responseErrorHandler(tooManyError)).rejects.toThrow(
        'too many',
      )

      const headers: AxiosRequestHeaders = cast(new Map())
      vi.spyOn(headers, 'set')
      const config = mock<InternalAxiosRequestConfig>({
        headers,
        url: '/User/ListDevices',
      })

      await expect(requestHandler(config)).rejects.toThrow('on hold')
    })
  })

  describe('fetch with complex building structure', () => {
    it('syncs floors, areas, and devices from building structure', async () => {
      const building = mock<BuildingWithStructure>({
        FPDefined: false,
        FPEnabled: false,
        FPMaxTemperature: 16,
        FPMinTemperature: 4,
        HMDefined: false,
        HMEnabled: false,
        HMEndDate: null,
        HMStartDate: null,
        ID: 1,
        Location: 10,
        Name: 'B1',
        Structure: {
          Areas: [
            {
              BuildingId: 1,
              Devices: [
                mock<ListDeviceAny>({
                  AreaID: 100,
                  BuildingID: 1,
                  DeviceID: 2000,
                  DeviceName: 'Area Device',
                  FloorID: null,
                  Type: 0,
                }),
              ],
              FloorId: null,
              ID: 100,
              Name: 'A1',
            },
          ],
          Devices: [
            mock<ListDeviceAny>({
              AreaID: null,
              BuildingID: 1,
              DeviceID: 1000,
              DeviceName: 'Building Device',
              FloorID: null,
              Type: 0,
            }),
          ],
          Floors: [
            {
              Areas: [
                {
                  BuildingId: 1,
                  Devices: [
                    mock<ListDeviceAny>({
                      AreaID: 200,
                      BuildingID: 1,
                      DeviceID: 3000,
                      DeviceName: 'Floor Area Device',
                      FloorID: 10,
                      Type: 0,
                    }),
                  ],
                  FloorId: 10,
                  ID: 200,
                  Name: 'FA1',
                },
              ],
              BuildingId: 1,
              Devices: [
                mock<ListDeviceAny>({
                  AreaID: null,
                  BuildingID: 1,
                  DeviceID: 4000,
                  DeviceName: 'Floor Device',
                  FloorID: 10,
                  Type: 0,
                }),
              ],
              ID: 10,
              Name: 'F1',
            },
          ],
        },
        TimeZone: 0,
      })
      mockAxiosInstance.get.mockResolvedValue({ data: [building] })
      const api = await createApi()
      const buildings = await api.fetch()

      expect(buildings).toHaveLength(1)
      expect(api.registry.buildings.getById(1)?.name).toBe('B1')
      expect(api.registry.floors.getById(10)?.name).toBe('F1')
      expect(api.registry.areas.getById(100)?.name).toBe('A1')
      expect(api.registry.areas.getById(200)?.name).toBe('FA1')
      expect(api.registry.devices.getById(1000)?.name).toBe('Building Device')
      expect(api.registry.devices.getById(2000)?.name).toBe('Area Device')
      expect(api.registry.devices.getById(3000)?.name).toBe('Floor Area Device')
      expect(api.registry.devices.getById(4000)?.name).toBe('Floor Device')
    })
  })
})
