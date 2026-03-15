import type {
  AxiosError,
  AxiosRequestHeaders,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'

import {
  type MockInstance,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import type { DeviceType } from '../../src/constants.ts'
import type {
  APIConfig,
  Logger,
  MELCloudAPI,
} from '../../src/services/index.ts'
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

const createLogger = (): Logger => ({
  error: vi.fn<(...data: unknown[]) => void>(),
  log: vi.fn<(...data: unknown[]) => void>(),
})

const loginResponse = (
  contextKey = 'ctx',
  expiry = '2030-12-31T00:00:00',
): { data: { LoginData: { ContextKey: string; Expiry: string } } } => ({
  data: { LoginData: { ContextKey: contextKey, Expiry: expiry } },
})

const mockLoginAndList = (
  contextKey = 'ctx',
  expiry = '2030-12-31T00:00:00',
): void => {
  mockAxiosInstance.post.mockResolvedValue(loginResponse(contextKey, expiry))
  mockAxiosInstance.get.mockResolvedValue({ data: [] })
}

const createHeaders = (): {
  headers: AxiosRequestHeaders
  setSpy: MockInstance
} => {
  const headers: AxiosRequestHeaders = cast(new Map())
  const setSpy = vi.spyOn(headers, 'set')
  return { headers, setSpy }
}

const createAxiosError = ({
  message,
  method = 'get',
  status,
  url,
}: {
  message: string
  status: number
  url: string
  method?: string
}): AxiosError =>
  mock<AxiosError>({
    config: mock<InternalAxiosRequestConfig>({ method, url }),
    message,
    response: mock<AxiosResponse>({
      config: mock<InternalAxiosRequestConfig>({ data: null, method, url }),
      data: {},
      headers: {},
      status,
    }),
  })

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
    const onSync = vi.fn()
    const api = await createApi({
      language: 'fr',
      logger: createLogger(),
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

    expect(settingManager.set).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
    )
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
    const logger = createLogger()
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
      mockAxiosInstance.post.mockResolvedValue(
        loginResponse('ctx', '2025-12-31T00:00:00'),
      )
      const api = await createApi({ password: 'pass', username: 'user' })
      mockLoginAndList('ctx', '2025-12-31T00:00:00')
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
      const { headers, setSpy } = createHeaders()
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
      const { headers, setSpy } = createHeaders()
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
      mockLoginAndList('newer', '2030-01-01T00:00:00')
      await createApi({ settingManager })
      mockLoginAndList('newest', '2030-01-01T00:00:00')
      const { headers } = createHeaders()
      const config = mock<InternalAxiosRequestConfig>({
        headers,
        url: '/Device/Get',
      })

      await expect(requestHandler(config)).resolves.toMatchObject({
        url: '/Device/Get',
      })
    })

    it('response handler returns response', async () => {
      await createApi({ logger: createLogger() })
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
      await createApi({ logger: createLogger() })

      await expect(
        requestErrorHandler(
          createAxiosError({
            message: 'test error',
            status: 500,
            url: '/test',
          }),
        ),
      ).rejects.toThrow('test error')
    })

    it('error handler handles request-only errors (no response)', async () => {
      await createApi({ logger: createLogger() })
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
      await createApi({ logger: createLogger() })

      await expect(
        responseErrorHandler(
          createAxiosError({
            message: 'too many',
            status: 429,
            url: '/User/ListDevices',
          }),
        ),
      ).rejects.toThrow('too many')
    })

    it('error handler retries on 401 for non-login path', async () => {
      mockLoginAndList()
      await createApi({
        logger: createLogger(),
        password: 'pass',
        username: 'user',
      })
      mockLoginAndList('new-ctx')
      mockAxiosInstance.request.mockResolvedValue({ data: 'retried' })
      const result = await responseErrorHandler(
        createAxiosError({
          message: 'unauthorized',
          status: 401,
          url: '/Device/Get',
        }),
      )

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(expect.any(Object))
      expect(result).toStrictEqual({ data: 'retried' })
    })

    it('error handler does not retry on 401 for login path', async () => {
      await createApi({ logger: createLogger() })

      await expect(
        responseErrorHandler(
          createAxiosError({
            message: 'unauthorized',
            status: 401,
            url: '/Login/ClientLogin3',
          }),
        ),
      ).rejects.toThrow('unauthorized')
    })

    it('error handler does not retry twice within retry delay', async () => {
      mockLoginAndList()
      await createApi({
        logger: createLogger(),
        password: 'pass',
        username: 'user',
      })
      mockLoginAndList('ctx2')
      mockAxiosInstance.request.mockResolvedValue({ data: 'retried' })
      await responseErrorHandler(
        createAxiosError({
          message: 'unauthorized',
          status: 401,
          url: '/Device/Get',
        }),
      )

      await expect(
        responseErrorHandler(
          createAxiosError({
            message: 'unauthorized again',
            status: 401,
            url: '/Device/Get',
          }),
        ),
      ).rejects.toThrow('unauthorized again')
    })

    it('retry timeout clears itself after delay', async () => {
      mockLoginAndList()
      await createApi({
        logger: createLogger(),
        password: 'pass',
        username: 'user',
      })
      mockLoginAndList('ctx3')
      mockAxiosInstance.request.mockResolvedValue({ data: 'retried' })
      await responseErrorHandler(
        createAxiosError({
          message: 'unauthorized',
          status: 401,
          url: '/Device/Get',
        }),
      )
      vi.advanceTimersByTime(1500)
      mockLoginAndList('ctx4')
      mockAxiosInstance.request.mockResolvedValue({ data: 'retried again' })
      const result = await responseErrorHandler(
        createAxiosError({
          message: 'unauthorized',
          status: 401,
          url: '/Device/Get',
        }),
      )

      expect(result).toStrictEqual({ data: 'retried again' })
    })

    it('request handler blocks list path when paused', async () => {
      await createApi({ logger: createLogger() })

      await expect(
        responseErrorHandler(
          createAxiosError({ message: 'too many', status: 429, url: '/api' }),
        ),
      ).rejects.toThrow('too many')

      const { headers } = createHeaders()
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
