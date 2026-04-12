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

import type {
  ClassicAPI,
  ClassicAPIConfig,
  Logger,
} from '../../src/api/index.ts'
import type { DeviceType } from '../../src/constants.ts'
import { RateLimitError } from '../../src/errors/index.ts'
import {
  type BuildingWithStructure,
  type ListDeviceAny,
  type SetDevicePostData,
  buildingId,
  deviceId,
} from '../../src/types/index.ts'
import { cast, createSettingStore, mock } from '../helpers.ts'

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
  responseHeaders = {},
  status,
  url,
}: {
  message: string
  status: number
  url: string
  method?: string
  responseHeaders?: Record<string, string>
}): AxiosError =>
  mock<AxiosError>({
    config: mock<InternalAxiosRequestConfig>({ method, url }),
    isAxiosError: true,
    message,
    response: mock<AxiosResponse>({
      config: mock<InternalAxiosRequestConfig>({ data: null, method, url }),
      data: {},
      headers: responseHeaders,
      status,
    }),
  })

const transientServerError = (status: number): Error =>
  Object.assign(new Error(`Status ${String(status)}`), {
    config: { url: '/User/ListDevices' },
    isAxiosError: true,
    response: {
      config: { url: '/User/ListDevices' },
      data: undefined,
      headers: {},
      status,
    },
  })

const errorEntry = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  DeviceId: 1,
  EndDate: '2024-01-02',
  ErrorMessage: 'Some error',
  StartDate: '2024-01-01T12:00:00',
  ...overrides,
})

const unauthorizedError = (
  url = '/Device/Get',
  message = 'unauthorized',
): AxiosError => createAxiosError({ message, status: 401, url })

const createDevice = (overrides: Record<string, unknown> = {}): ListDeviceAny =>
  cast({
    AreaID: null,
    BuildingID: 1,
    Device: {},
    DeviceID: 1,
    DeviceName: 'Device',
    FloorID: null,
    Type: 0,
    ...overrides,
  })

const createBuilding = (
  overrides: Partial<BuildingWithStructure> = {},
): BuildingWithStructure =>
  mock({
    FPDefined: false,
    FPEnabled: false,
    FPMaxTemperature: 16,
    FPMinTemperature: 4,
    HMDefined: false,
    HMEnabled: false,
    HMEndDate: null,
    HMStartDate: null,
    ID: buildingId(1),
    Location: 10,
    Name: 'Test',
    Structure: { Areas: [], Devices: [], Floors: [] },
    TimeZone: 0,
    ...overrides,
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

describe('mELCloud Classic API', () => {
  let melCloudApi: typeof ClassicAPI = cast(null)
  let requestHandler: (
    config: InternalAxiosRequestConfig,
  ) => Promise<InternalAxiosRequestConfig> = cast(null)
  let requestErrorHandler: (error: AxiosError) => Promise<AxiosError> =
    cast(null)
  let responseHandler: (response: AxiosResponse) => AxiosResponse = cast(null)
  let responseErrorHandler: (error: unknown) => Promise<AxiosError> = cast(null)

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockAxiosInstance.get.mockResolvedValue({ data: [] })
    mockAxiosInstance.post.mockResolvedValue({ data: [] })
    ;({ ClassicAPI: melCloudApi } = await import('../../src/api/classic.ts'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const createApi = async (
    config: ClassicAPIConfig = {},
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

  it('creates a ClassicAPI instance via static create()', async () => {
    const api = await createApi()

    expect(api).toBeDefined()
    expect(api.registry).toBeDefined()
  })

  it('reports unauthenticated before login', async () => {
    const api = await createApi()

    expect(api.isAuthenticated()).toBe(false)
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

  it('wires a consumer AbortSignal into outgoing requests', async () => {
    const controller = new AbortController()
    await createApi({ abortSignal: controller.signal })
    const { headers } = createHeaders()
    const config = mock<InternalAxiosRequestConfig>({
      headers,
      method: 'get',
      url: '/Device/Get',
    })

    const tagged = await requestHandler(config)

    expect(tagged.signal).toBe(controller.signal)
  })

  it('does not set a signal when no abortSignal is provided', async () => {
    await createApi()
    const { headers } = createHeaders()
    const config = mock<InternalAxiosRequestConfig>({
      headers,
      method: 'get',
      url: '/Device/Get',
    })

    const tagged = await requestHandler(config)

    expect(tagged.signal).toBeUndefined()
  })

  it('uses settingManager when provided', async () => {
    const { setSpy, settingManager } = createSettingStore()
    await createApi({
      password: 'test-pass',
      settingManager,
      username: 'test-user',
    })

    expect(setSpy).toHaveBeenCalledWith(expect.any(String), expect.any(String))
  })

  it('fetches building list and syncs registry', async () => {
    const building = createBuilding()
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

    it.each([
      { path: '/Device/SetAta', type: 0 as const },
      { path: '/Device/SetAtw', type: 1 as const },
      { path: '/Device/SetErv', type: 3 as const },
    ])('calls setValues for type $type via $path', async ({ path, type }) => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({ data: {} })
      await api.setValues({
        postData: mock<SetDevicePostData<typeof DeviceType.Ata>>({
          DeviceID: deviceId(1),
          EffectiveFlags: 1,
        }),
        type,
      })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        path,
        expect.any(Object),
      )
    })
  })

  describe('authentication', () => {
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

  describe('language settings', () => {
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

    it('does not change internal language when the API returns false', async () => {
      const api = await createApi({ language: 'en' })
      mockAxiosInstance.post.mockResolvedValue({ data: false })
      await api.setLanguage('fr')
      mockAxiosInstance.post.mockClear()
      await api.setLanguage('en')

      expect(mockAxiosInstance.post).not.toHaveBeenCalled()
    })
  })

  describe('sync interval', () => {
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

  describe('error log retrieval', () => {
    it('returns parsed error log', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({ data: [errorEntry()] })
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
          errorEntry({
            EndDate: '0001-01-01',
            ErrorMessage: 'Bad',
            StartDate: '0001-01-01T00:00:00',
          }),
        ],
      })
      const result = await api.getErrorLog({}, [1])

      expect(result.errors).toHaveLength(0)
    })

    it('throws when the API returns failure data', async () => {
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

      expect(result).toHaveProperty('fromDate')
      expect(result).toHaveProperty('nextFromDate')
    })

    it('uses all devices when no deviceIds provided', async () => {
      const building = createBuilding({
        Structure: {
          Areas: [],
          Devices: [createDevice({ DeviceID: 42, DeviceName: 'D1' })],
          Floors: [],
        },
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
        data: [errorEntry({ ErrorMessage: null })],
      })
      const result = await api.getErrorLog({ from: '2024-01-01' }, [1])

      expect(result.errors).toHaveLength(0)
    })

    it('throws on invalid date in query', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({ data: [] })

      await expect(api.getErrorLog({ to: 'not-a-date' }, [1])).rejects.toThrow(
        'Invalid DateTime',
      )
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
      const { settingManager } = createSettingStore({
        contextKey: 'old-ctx',
        expiry: '2020-01-01T00:00:00',
        password: 'pass',
        username: 'user',
      })
      mockLoginAndList('newer', '2030-01-01T00:00:00')
      await createApi({ settingManager })
      mockLoginAndList('newest', '2030-01-01T00:00:00')
      const { headers, setSpy } = createHeaders()
      const config = mock<InternalAxiosRequestConfig>({
        headers,
        url: '/Device/Get',
      })

      await requestHandler(config)

      expect(setSpy).toHaveBeenCalledWith('X-MitsContextKey', 'newest')
    })

    it('request handler re-authenticates when contextKey is empty', async () => {
      const { settingManager } = createSettingStore({
        password: 'pass',
        username: 'user',
      })
      mockLoginAndList()
      await createApi({ settingManager })
      mockAxiosInstance.post.mockClear()
      mockLoginAndList('fresh', '2030-12-31T00:00:00')
      const { headers, setSpy } = createHeaders()
      const config = mock<InternalAxiosRequestConfig>({
        headers,
        url: '/Device/Get',
      })

      await requestHandler(config)

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/Login/ClientLogin3',
        expect.objectContaining({ Email: 'user', Password: 'pass' }),
      )
      expect(setSpy).toHaveBeenCalledWith('X-MitsContextKey', 'fresh')
    })

    it('request handler treats malformed expiry as expired', async () => {
      const { settingManager } = createSettingStore({
        contextKey: 'stale',
        expiry: 'not-a-valid-iso-date',
        password: 'pass',
        username: 'user',
      })
      mockLoginAndList()
      await createApi({ settingManager })
      mockAxiosInstance.post.mockClear()
      mockLoginAndList('fresh', '2030-12-31T00:00:00')
      const { headers, setSpy } = createHeaders()
      const config = mock<InternalAxiosRequestConfig>({
        headers,
        url: '/Device/Get',
      })

      await requestHandler(config)

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/Login/ClientLogin3',
        expect.any(Object),
      )
      expect(setSpy).toHaveBeenCalledWith('X-MitsContextKey', 'fresh')
    })

    it('request handler skips reauth when expiry is empty', async () => {
      const { settingManager } = createSettingStore({ contextKey: 'valid' })
      mockLoginAndList()
      await createApi({ settingManager })
      mockAxiosInstance.post.mockClear()
      const { headers, setSpy } = createHeaders()
      const config = mock<InternalAxiosRequestConfig>({
        headers,
        url: '/Device/Get',
      })

      await requestHandler(config)

      expect(mockAxiosInstance.post).not.toHaveBeenCalled()
      expect(setSpy).toHaveBeenCalledWith('X-MitsContextKey', 'valid')
    })

    it('authenticate clears persisted session when server rejects login', async () => {
      const { setSpy, settingManager } = createSettingStore({
        contextKey: 'old-ctx',
        expiry: '2030-12-31T00:00:00',
      })
      mockLoginAndList()
      const api = await createApi({ settingManager })
      setSpy.mockClear()
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { LoginData: null },
      })

      const isAuthenticated = await api.authenticate({
        password: 'wrong',
        username: 'user',
      })

      expect(isAuthenticated).toBe(false)
      expect(setSpy).toHaveBeenCalledWith('contextKey', '')
      expect(setSpy).toHaveBeenCalledWith('expiry', '')
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

    it('error handler uses retry-after header for 429 pause duration', async () => {
      await createApi({ logger: createLogger() })

      await expect(
        responseErrorHandler(
          createAxiosError({
            message: 'too many',
            responseHeaders: { 'retry-after': '120' },
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
      const result = await responseErrorHandler(unauthorizedError())

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(expect.any(Object))
      expect(result).toStrictEqual({ data: 'retried' })
    })

    it('error handler does not retry on 401 for login path', async () => {
      await createApi({ logger: createLogger() })

      await expect(
        responseErrorHandler(unauthorizedError('/Login/ClientLogin3')),
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
      await responseErrorHandler(unauthorizedError())

      await expect(
        responseErrorHandler(
          unauthorizedError('/Device/Get', 'unauthorized again'),
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
      await responseErrorHandler(unauthorizedError())
      vi.advanceTimersByTime(1500)
      mockLoginAndList('ctx4')
      mockAxiosInstance.request.mockResolvedValue({ data: 'retried again' })
      const result = await responseErrorHandler(unauthorizedError())

      expect(result).toStrictEqual({ data: 'retried again' })
    })

    it('request handler blocks list path with a RateLimitError when paused', async () => {
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

      await expect(requestHandler(config)).rejects.toBeInstanceOf(
        RateLimitError,
      )
    })

    it('response error handler preserves MelCloudError subclass types', async () => {
      /*
       * When #onRequest throws a RateLimitError, axios routes it through
       * the response error interceptor. The interceptor must not wrap it
       * into a generic Error — consumers rely on `instanceof RateLimitError`
       * to handle the rate-limit window specifically.
       */
      await createApi({ logger: createLogger() })
      const rateLimitError = new RateLimitError('paused', {
        retryAfter: null,
      })

      await expect(responseErrorHandler(rateLimitError)).rejects.toBe(
        rateLimitError,
      )
    })

    it('exposes isRateLimited once the gate has closed', async () => {
      const api = await createApi({ logger: createLogger() })

      expect(api.isRateLimited).toBe(false)

      await expect(
        responseErrorHandler(
          createAxiosError({
            message: 'too many',
            responseHeaders: { 'retry-after': '60' },
            status: 429,
            url: '/api',
          }),
        ),
      ).rejects.toThrow('too many')

      expect(api.isRateLimited).toBe(true)
    })

    it('emits onRequestStart / onRequestComplete for a tagged config', async () => {
      const onRequestStart = vi.fn<(event: unknown) => void>()
      const onRequestComplete = vi.fn<(event: unknown) => void>()
      await createApi({ events: { onRequestComplete, onRequestStart } })
      const { headers } = createHeaders()
      const config = mock<InternalAxiosRequestConfig>({
        headers,
        method: 'get',
        url: '/User/ListDevices',
      })

      const tagged = await requestHandler(config)
      responseHandler(
        mock<AxiosResponse>({
          config: tagged,
          data: {},
          headers: {},
          status: 200,
        }),
      )

      expect(onRequestStart).toHaveBeenCalledTimes(1)
      expect(onRequestComplete).toHaveBeenCalledTimes(1)
    })

    it('emits onRequestError when the response error carries a tagged config', async () => {
      const onRequestError = vi.fn<(event: unknown) => void>()
      await createApi({ events: { onRequestError } })
      const { headers } = createHeaders()
      const config = mock<InternalAxiosRequestConfig>({
        headers,
        method: 'get',
        url: '/Device/Get',
      })

      // First tag via #onRequest.
      const tagged = await requestHandler(config)

      // Then feed a matching error through #onError.
      await expect(
        responseErrorHandler(
          mock<AxiosError>({
            config: tagged,
            isAxiosError: true,
            message: 'server fault',
            response: mock<AxiosResponse>({
              config: tagged,
              data: {},
              headers: {},
              status: 500,
            }),
          }),
        ),
      ).rejects.toThrow('server fault')

      expect(onRequestError).toHaveBeenCalledTimes(1)
    })

    it('skips onRequestError when the axios error has no config', async () => {
      /*
       * Axios can surface errors that originated before the request
       * was even dispatched (e.g. a network/TLS failure on connect).
       * These reach the error interceptor with `config === undefined`.
       * The emitter must silently skip rather than publish a partial
       * event.
       */
      const onRequestError = vi.fn<(event: unknown) => void>()
      await createApi({ events: { onRequestError } })

      await expect(
        responseErrorHandler(
          mock<AxiosError>({
            config: undefined,
            isAxiosError: true,
            message: 'connect ECONNREFUSED',
          }),
        ),
      ).rejects.toThrow('connect ECONNREFUSED')

      expect(onRequestError).not.toHaveBeenCalled()
    })
  })

  describe('transient 5xx retry on fetch', () => {
    it('retries list() on 503 and succeeds on the next attempt', async () => {
      mockLoginAndList()
      const api = await createApi()
      mockAxiosInstance.get.mockClear()
      mockAxiosInstance.get
        .mockRejectedValueOnce(transientServerError(503))
        .mockResolvedValueOnce({ data: [] })

      const promise = api.fetch()
      await vi.advanceTimersByTimeAsync(2000)
      const buildings = await promise

      expect(buildings).toStrictEqual([])
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2)
    })

    it('gives up after exhausting the 5xx retry budget', async () => {
      mockLoginAndList()
      const api = await createApi()
      mockAxiosInstance.get.mockClear()
      mockAxiosInstance.get
        .mockRejectedValueOnce(transientServerError(502))
        .mockRejectedValueOnce(transientServerError(503))
        .mockRejectedValueOnce(transientServerError(504))
        .mockRejectedValueOnce(transientServerError(502))
        .mockRejectedValueOnce(transientServerError(503))

      const promise = api.fetch()
      await vi.advanceTimersByTimeAsync(30_000)
      const buildings = await promise

      // Classic's public fetch() swallows errors and returns [].
      expect(buildings).toStrictEqual([])
      // 1 initial attempt + 4 retries
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(5)
    })

    it('does not retry on non-transient 500', async () => {
      mockLoginAndList()
      const api = await createApi()
      mockAxiosInstance.get.mockClear()
      mockAxiosInstance.get.mockRejectedValueOnce(transientServerError(500))

      const buildings = await api.fetch()

      expect(buildings).toStrictEqual([])
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1)
    })
  })

  describe('fetch with complex building structure', () => {
    it('syncs floors, areas, and devices from building structure', async () => {
      const building = createBuilding({
        Name: 'B1',
        Structure: {
          Areas: [
            {
              BuildingId: buildingId(1),
              Devices: [
                createDevice({
                  AreaID: 100,
                  DeviceID: 2000,
                  DeviceName: 'Area Device',
                }),
              ],
              FloorId: null,
              ID: 100,
              Name: 'A1',
            },
          ],
          Devices: [
            createDevice({ DeviceID: 1000, DeviceName: 'Building Device' }),
          ],
          Floors: [
            {
              Areas: [
                {
                  BuildingId: buildingId(1),
                  Devices: [
                    createDevice({
                      AreaID: 200,
                      DeviceID: 3000,
                      DeviceName: 'Floor Area Device',
                      FloorID: 10,
                    }),
                  ],
                  FloorId: 10,
                  ID: 200,
                  Name: 'FA1',
                },
              ],
              BuildingId: buildingId(1),
              Devices: [
                createDevice({
                  DeviceID: 4000,
                  DeviceName: 'Floor Device',
                  FloorID: 10,
                }),
              ],
              ID: 10,
              Name: 'F1',
            },
          ],
        },
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
