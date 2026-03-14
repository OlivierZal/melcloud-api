import type {
  AxiosError,
  AxiosRequestHeaders,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DeviceType } from '../../src/constants.ts'
import type {
  Building,
  ListDeviceAny,
  SetDevicePostData,
} from '../../src/types/index.ts'

import { mock } from '../helpers.ts'

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

vi.mock(import('axios'), async (importOriginal) => ({
  ...(await importOriginal()),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  default: {
    create: vi.fn().mockReturnValue(mockAxiosInstance),
  } as unknown as typeof import('axios').default,
}))

describe('mELCloudAPI', () => {
  let MELCloudAPI: typeof import('../../src/services/melcloud.ts').MELCloudAPI
  let requestHandler: (
    config: InternalAxiosRequestConfig,
  ) => Promise<InternalAxiosRequestConfig>
  let requestErrorHandler: (error: AxiosError) => Promise<AxiosError>
  let responseHandler: (response: AxiosResponse) => AxiosResponse
  let responseErrorHandler: (error: AxiosError) => Promise<AxiosError>

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockAxiosInstance.get.mockResolvedValue({ data: [] })
    mockAxiosInstance.post.mockResolvedValue({ data: [] })
    const mod = await import('../../src/services/melcloud.ts')
    MELCloudAPI = mod.MELCloudAPI
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const createApi = async (
    config: import('../../src/services/interfaces.ts').APIConfig = {},
  ) => {
    const api = await MELCloudAPI.create({ autoSyncInterval: 0, ...config })
    const reqCalls = mockInterceptors.request.use.mock.calls
    const resCalls = mockInterceptors.response.use.mock.calls
    const lastReq = reqCalls.at(-1)!
    const lastRes = resCalls.at(-1)!
    /* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
    ;[requestHandler, requestErrorHandler] =
      lastReq as [typeof requestHandler, typeof requestErrorHandler]
    ;[responseHandler, responseErrorHandler] =
      lastRes as [typeof responseHandler, typeof responseErrorHandler]
    /* eslint-enable @typescript-eslint/no-unsafe-type-assertion */
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
    const api = await MELCloudAPI.create({ autoSyncInterval: null })

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
    const building: Building = {
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
    } as Building
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
    await MELCloudAPI.create({ autoSyncInterval: 1 })

    expect(() => {
      vi.advanceTimersByTime(60_000)
    }).not.toThrow()
  })

  describe('api endpoints', () => {
    it('calls energy', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({ data: {} })
      await api.energy({
        postData: { DeviceID: 1, FromDate: '2024-01-01', ToDate: '2024-01-31' },
      })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/EnergyCost/Report',
        expect.any(Object),
      )
    })

    it('calls errors', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({ data: [] })
      await api.errors({ postData: { DeviceIDs: [1] } })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/Report/GetUnitErrorLog2',
        expect.any(Object),
      )
    })

    it('calls frostProtection', async () => {
      const api = await createApi()
      mockAxiosInstance.get.mockResolvedValue({ data: {} })
      await api.frostProtection({ params: { id: 1, tableName: 'Building' } })

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/FrostProtection/GetSettings',
        expect.any(Object),
      )
    })

    it('calls group', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({ data: {} })
      await api.group({ postData: { BuildingID: 1 } })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/Group/Get',
        expect.any(Object),
      )
    })

    it('calls holidayMode', async () => {
      const api = await createApi()
      mockAxiosInstance.get.mockResolvedValue({ data: {} })
      await api.holidayMode({ params: { id: 1, tableName: 'Building' } })

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/HolidayMode/GetSettings',
        expect.any(Object),
      )
    })

    it('calls hourlyTemperatures', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({ data: {} })
      await api.hourlyTemperatures({ postData: { device: 1, hour: 12 } })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/Report/GetHourlyTemperature',
        expect.any(Object),
      )
    })

    it('calls internalTemperatures', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({ data: {} })
      await api.internalTemperatures({
        postData: { DeviceID: 1, FromDate: '2024-01-01', ToDate: '2024-01-31' },
      })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/Report/GetInternalTemperatures2',
        expect.any(Object),
      )
    })

    it('calls list', async () => {
      const api = await createApi()
      mockAxiosInstance.get.mockResolvedValue({ data: [] })
      await api.list()

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/User/ListDevices')
    })

    it('calls login', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({ data: { LoginData: null } })
      await api.login({
        postData: { AppVersion: '1.0', Email: 'u', Password: 'p' },
      })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/Login/ClientLogin3',
        expect.any(Object),
      )
    })

    it('calls operationModes', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({ data: [] })
      await api.operationModes({
        postData: { DeviceID: 1, FromDate: '2024-01-01', ToDate: '2024-01-31' },
      })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/Report/GetOperationModeLog2',
        expect.any(Object),
      )
    })

    it('calls setFrostProtection', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({ data: { Success: true } })
      await api.setFrostProtection({
        postData: {
          Enabled: true,
          MaximumTemperature: 16,
          MinimumTemperature: 4,
        },
      })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/FrostProtection/Update',
        expect.any(Object),
      )
    })

    it('calls setGroup', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({ data: {} })
      await api.setGroup({
        postData: { Specification: { BuildingID: 1 }, State: { Power: true } },
      })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/Group/SetAta',
        expect.any(Object),
      )
    })

    it('calls setHolidayMode', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({ data: {} })
      await api.setHolidayMode({
        postData: {
          Enabled: true,
          EndDate: null,
          HMTimeZones: [],
          StartDate: null,
        },
      })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/HolidayMode/Update',
        expect.any(Object),
      )
    })

    it('calls setLanguage', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({ data: true })
      await api.setLanguage({ postData: { language: 0 } })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/User/UpdateLanguage',
        expect.any(Object),
      )
    })

    it('calls setPower', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({ data: true })
      await api.setPower({ postData: { DeviceIds: [1], Power: true } })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/Device/Power',
        expect.any(Object),
      )
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

    it('calls signal', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({ data: {} })
      await api.signal({ postData: { devices: [1], hour: 12 } })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/Report/GetSignalStrength',
        expect.any(Object),
      )
    })

    it('calls temperatures', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({ data: {} })
      await api.temperatures({
        postData: { DeviceID: 1, FromDate: '2024-01-01', ToDate: '2024-01-31' },
      })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/Report/GetTemperatureLog2',
        expect.any(Object),
      )
    })

    it('calls tiles', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({ data: {} })
      await api.tiles({ postData: { DeviceIDs: [1] } })

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/Tile/Get2',
        expect.any(Object),
      )
    })

    it('calls values', async () => {
      const api = await createApi()
      mockAxiosInstance.get.mockResolvedValue({ data: {} })
      await api.values({ params: { buildingId: 1, id: 1 } })

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/Device/Get',
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
      const result = await api.authenticate({
        password: 'pass',
        username: 'user',
      })

      expect(result).toBe(true)
    })

    it('returns false when login data is null', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({ data: { LoginData: null } })
      const result = await api.authenticate({
        password: 'pass',
        username: 'user',
      })

      expect(result).toBe(false)
    })

    it('returns false when no credentials', async () => {
      const api = await createApi()
      const result = await api.authenticate()

      expect(result).toBe(false)
    })

    it('swallows error when no explicit data', async () => {
      mockAxiosInstance.post.mockRejectedValueOnce(new Error('fail'))
      const api = await createApi({ password: 'pass', username: 'user' })
      mockAxiosInstance.post.mockRejectedValue(new Error('fail'))
      const result = await api.authenticate()

      expect(result).toBe(false)
    })

    it('throws error when explicit data and auth fails', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockRejectedValue(new Error('auth fail'))

      await expect(
        api.authenticate({ password: 'p', username: 'u' }),
      ).rejects.toThrow('auth fail')
    })
  })

  describe('updateLanguage', () => {
    it('updates language when different', async () => {
      const api = await createApi({ language: 'en' })
      mockAxiosInstance.post.mockResolvedValue({ data: true })
      await api.updateLanguage('fr')

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/User/UpdateLanguage',
        expect.any(Object),
      )
    })

    it('does not update when same language', async () => {
      const api = await createApi({ language: 'en' })
      mockAxiosInstance.post.mockClear()
      await api.updateLanguage('en')

      expect(mockAxiosInstance.post).not.toHaveBeenCalled()
    })

    it('handles invalid language codes', async () => {
      const api = await createApi({ language: 'en' })
      mockAxiosInstance.post.mockResolvedValue({ data: true })
      await api.updateLanguage('invalid')

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/User/UpdateLanguage',
        expect.objectContaining({ language: 0 }),
      )
    })

    it('does not change internal language when API returns false', async () => {
      const api = await createApi({ language: 'en' })
      mockAxiosInstance.post.mockResolvedValue({ data: false })
      await api.updateLanguage('fr')
      mockAxiosInstance.post.mockClear()
      await api.updateLanguage('en')

      expect(mockAxiosInstance.post).not.toHaveBeenCalled()
    })
  })

  describe('errorLog', () => {
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
      const result = await api.errorLog(
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
      const result = await api.errorLog({}, [1])

      expect(result.errors).toHaveLength(0)
    })

    it('throws when API returns failure data', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({
        data: { AttributeErrors: { f: ['e'] }, Success: false },
      })

      await expect(api.errorLog({}, [1])).rejects.toThrow('f')
    })

    it('handles offset and limit', async () => {
      const api = await createApi()
      mockAxiosInstance.post.mockResolvedValue({ data: [] })
      const result = await api.errorLog(
        { limit: '5', offset: '2', to: '2024-06-01' },
        [1],
      )

      expect(result).toHaveProperty('fromDateHuman')
      expect(result).toHaveProperty('nextFromDate')
    })

    it('uses all devices when no deviceIds provided', async () => {
      const building = mock<Building>({
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
      const result = await api.errorLog({})

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
      const result = await api.errorLog({ from: '2024-01-01' }, [1])

      expect(result.errors).toHaveLength(0)
    })
  })

  describe('interceptors', () => {
    it('request handler sets context key header', async () => {
      await createApi()
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      const headers = new Map() as unknown as AxiosRequestHeaders
      vi.spyOn(headers, 'set')
      const config = mock<InternalAxiosRequestConfig>({
        headers,
        url: '/Device/Get',
      })
      await requestHandler(config)

      expect(headers.set).toHaveBeenCalledWith(
        'X-MitsContextKey',
        expect.any(String),
      )
    })

    it('request handler does not set header for login path', async () => {
      await createApi()
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      const headers = new Map() as unknown as AxiosRequestHeaders
      vi.spyOn(headers, 'set')
      const config = mock<InternalAxiosRequestConfig>({
        headers,
        url: '/Login/ClientLogin3',
      })
      await requestHandler(config)

      expect(headers.set).not.toHaveBeenCalled()
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      const headers = new Map() as unknown as AxiosRequestHeaders
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
      await createApi({ logger: { error: vi.fn(), log: vi.fn() } })
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

      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      const headers = new Map() as unknown as AxiosRequestHeaders
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
      const building = mock<Building>({
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
