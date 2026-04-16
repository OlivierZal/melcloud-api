import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClassicAPI, ClassicAPIConfig } from '../../src/api/index.ts'
import type { ClassicDeviceType } from '../../src/constants.ts'
import {
  type ClassicBuildingWithStructure,
  type ClassicListDeviceAny,
  type ClassicSetDevicePostData,
  toClassicBuildingId,
  toClassicDeviceId,
} from '../../src/types/index.ts'
import {
  cast,
  createAxiosError,
  createLogger,
  createSettingStore,
  mock,
} from '../helpers.ts'

const mockAxiosInstance = {
  get: vi.fn(),
  post: vi.fn(),
  request: vi.fn(),
}

const loginResponse = (
  contextKey = 'ctx',
  expiry = '2030-12-31T00:00:00',
): { data: { ClassicLoginData: { ContextKey: string; Expiry: string } } } => ({
  data: { ClassicLoginData: { ContextKey: contextKey, Expiry: expiry } },
})

/**
 * Configure `mockAxiosInstance.request` to handle login (POST) and list (GET)
 * calls by discriminating on the `url` field in the request config.
 */
const mockLoginAndList = (
  contextKey = 'ctx',
  expiry = '2030-12-31T00:00:00',
): void => {
  mockAxiosInstance.request.mockImplementation(
    (config: { url?: string } = {}) => {
      if (config.url === '/Login/ClientLogin3') {
        return loginResponse(contextKey, expiry)
      }
      if (config.url === '/User/ListDevices') {
        return { data: [] }
      }
      return { data: {} }
    },
  )
}

const errorEntry = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  DeviceId: 1,
  EndDate: '2024-01-02',
  ErrorMessage: 'Some error',
  StartDate: '2024-01-01T12:00:00',
  ...overrides,
})

const createDevice = (
  overrides: Record<string, unknown> = {},
): ClassicListDeviceAny =>
  cast({
    AreaID: null,
    BuildingID: 1,
    Device: {},
    DeviceID: 1,
    DeviceName: 'ClassicDevice',
    FloorID: null,
    Type: 0,
    ...overrides,
  })

const createBuilding = (
  overrides: Partial<ClassicBuildingWithStructure> = {},
): ClassicBuildingWithStructure =>
  mock({
    FPDefined: false,
    FPEnabled: false,
    FPMaxTemperature: 16,
    FPMinTemperature: 4,
    HMDefined: false,
    HMEnabled: false,
    HMEndDate: null,
    HMStartDate: null,
    ID: toClassicBuildingId(1),
    Location: 10,
    Name: 'Test',
    Structure: { Areas: [], Devices: [], Floors: [] },
    TimeZone: 0,
    ...overrides,
  })

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

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockAxiosInstance.request.mockResolvedValue({ data: [] })
    ;({ ClassicAPI: melCloudApi } = await import('../../src/api/classic.ts'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const createApi = async (
    config: ClassicAPIConfig = {},
  ): Promise<Awaited<ReturnType<typeof melCloudApi.create>>> =>
    melCloudApi.create({ autoSyncInterval: 0, ...config })

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
    mockAxiosInstance.request.mockResolvedValue({ data: [building] })
    const api = await createApi()
    const buildings = await api.fetch()

    expect(buildings).toHaveLength(1)
  })

  it('returns empty array when fetch fails', async () => {
    const api = await createApi()
    mockAxiosInstance.request.mockRejectedValueOnce(new Error('Network'))
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
        method: 'updateFrostProtection' as const,
        path: '/FrostProtection/Update',
      },
      {
        args: {
          postData: {
            Specification: { BuildingID: 1 },
            State: { Power: true },
          },
        },
        method: 'updateGroupState' as const,
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
        method: 'updateHolidayMode' as const,
        path: '/HolidayMode/Update',
      },
      {
        args: { postData: { DeviceIds: [1], Power: true } },
        method: 'updatePower' as const,
        path: '/ClassicDevice/Power',
      },
    ])('calls $method via POST', async ({ args, method, path }) => {
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockAxiosInstance.request.mockResolvedValue({ data: {} })
      await api[method](cast(args))

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'post', url: path }),
      )
    })

    it.each([
      {
        args: { params: { id: 1, tableName: 'ClassicBuilding' } },
        method: 'getFrostProtection' as const,
        path: '/FrostProtection/GetSettings',
      },
      {
        args: { params: { id: 1, tableName: 'ClassicBuilding' } },
        method: 'getHolidayMode' as const,
        path: '/HolidayMode/GetSettings',
      },
      {
        args: { params: { buildingId: 1, id: 1 } },
        method: 'getValues' as const,
        path: '/ClassicDevice/Get',
      },
    ])('calls $method via GET', async ({ args, method, path }) => {
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockAxiosInstance.request.mockResolvedValue({ data: {} })
      await api[method](cast(args))

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'get', url: path }),
      )
    })

    it('calls list', async () => {
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockAxiosInstance.request.mockResolvedValue({ data: [] })
      await api.list()

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'get', url: '/User/ListDevices' }),
      )
    })

    it.each([
      { path: '/ClassicDevice/SetAta', type: 0 as const },
      { path: '/ClassicDevice/SetAtw', type: 1 as const },
      { path: '/ClassicDevice/SetErv', type: 3 as const },
    ])(
      'calls updateValues for type $type via $path',
      async ({ path, type }) => {
        mockLoginAndList()
        const api = await createApi({ password: 'pass', username: 'user' })
        mockAxiosInstance.request.mockResolvedValue({ data: {} })
        await api.updateValues({
          postData: mock<
            ClassicSetDevicePostData<typeof ClassicDeviceType.Ata>
          >({
            DeviceID: toClassicDeviceId(1),
            EffectiveFlags: 1,
          }),
          type,
        })

        expect(mockAxiosInstance.request).toHaveBeenCalledWith(
          expect.objectContaining({ method: 'post', url: path }),
        )
      },
    )
  })

  describe('authentication', () => {
    it('authenticates with credentials', async () => {
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockLoginAndList()
      const isAuthenticated = await api.authenticate({
        password: 'pass',
        username: 'user',
      })

      expect(isAuthenticated).toBe(true)
    })

    it('returns false when login data is null', async () => {
      const api = await createApi()
      mockAxiosInstance.request.mockResolvedValue({
        data: { ClassicLoginData: null },
      })
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
      mockAxiosInstance.request.mockRejectedValueOnce(new Error('fail'))
      const api = await createApi({ password: 'pass', username: 'user' })
      mockAxiosInstance.request.mockRejectedValue(new Error('fail'))
      const isAuthenticated = await api.authenticate()

      expect(isAuthenticated).toBe(false)
    })

    it('throws error when explicit data and auth fails', async () => {
      const api = await createApi()
      mockAxiosInstance.request.mockRejectedValue(new Error('auth fail'))

      await expect(
        api.authenticate({ password: 'p', username: 'u' }),
      ).rejects.toThrow('auth fail')
    })
  })

  describe('language settings', () => {
    it('updates language when different', async () => {
      mockLoginAndList()
      const api = await createApi({
        language: 'en',
        password: 'pass',
        username: 'user',
      })
      mockAxiosInstance.request.mockResolvedValue({ data: true })
      await api.updateLanguage('fr')

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'post',
          url: '/User/UpdateLanguage',
        }),
      )
    })

    it('does not update when same language', async () => {
      mockLoginAndList()
      const api = await createApi({
        language: 'en',
        password: 'pass',
        username: 'user',
      })
      mockAxiosInstance.request.mockClear()
      await api.updateLanguage('en')

      expect(mockAxiosInstance.request).not.toHaveBeenCalled()
    })

    it('handles invalid language codes', async () => {
      mockLoginAndList()
      const api = await createApi({
        language: 'en',
        password: 'pass',
        username: 'user',
      })
      mockAxiosInstance.request.mockResolvedValue({ data: true })
      await api.updateLanguage('invalid')

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { language: 0 },
          method: 'post',
          url: '/User/UpdateLanguage',
        }),
      )
    })

    it('does not change internal language when the API returns false', async () => {
      mockLoginAndList()
      const api = await createApi({
        language: 'en',
        password: 'pass',
        username: 'user',
      })
      mockAxiosInstance.request.mockResolvedValue({ data: false })
      await api.updateLanguage('fr')
      mockAxiosInstance.request.mockClear()
      await api.updateLanguage('en')

      expect(mockAxiosInstance.request).not.toHaveBeenCalled()
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
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockAxiosInstance.request.mockResolvedValue({
        data: [errorEntry()],
      })
      const result = await api.getErrorLog(
        { from: '2024-01-01', to: '2024-01-02' },
        [1],
      )

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]?.error).toBe('Some error')
    })

    it('filters out entries with invalid year', async () => {
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockAxiosInstance.request.mockResolvedValue({
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
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockAxiosInstance.request.mockResolvedValue({
        data: { AttributeErrors: { field: ['error'] }, Success: false },
      })

      await expect(api.getErrorLog({}, [1])).rejects.toThrow('field')
    })

    it('handles offset and limit', async () => {
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockAxiosInstance.request.mockResolvedValue({ data: [] })
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
      mockAxiosInstance.request.mockResolvedValue({ data: [building] })
      const api = await createApi()
      await api.fetch()
      mockLoginAndList()
      mockAxiosInstance.request.mockImplementation(
        (config: { url?: string } = {}) => {
          if (config.url === '/Report/GetUnitErrorLog2') {
            return { data: [] }
          }
          if (config.url === '/Login/ClientLogin3') {
            return loginResponse()
          }
          return { data: [] }
        },
      )
      const result = await api.getErrorLog({})

      expect(result).toHaveProperty('errors')
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest matcher
          data: expect.objectContaining({ DeviceIDs: [42] }),
          url: '/Report/GetUnitErrorLog2',
        }),
      )
    })

    it('filters null/empty error messages', async () => {
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockAxiosInstance.request.mockResolvedValue({
        data: [errorEntry({ ErrorMessage: null })],
      })
      const result = await api.getErrorLog({ from: '2024-01-01' }, [1])

      expect(result.errors).toHaveLength(0)
    })

    it('throws on invalid date in query', async () => {
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockAxiosInstance.request.mockResolvedValue({ data: [] })

      await expect(api.getErrorLog({ to: 'not-a-date' }, [1])).rejects.toThrow(
        'Invalid DateTime',
      )
    })
  })

  describe('request lifecycle', () => {
    it('sets X-MitsContextKey header on authenticated requests', async () => {
      mockLoginAndList('my-ctx')
      const api = await createApi({ password: 'pass', username: 'user' })
      mockAxiosInstance.request.mockResolvedValue({ data: {} })
      await api.getValues({ params: { buildingId: 1, id: 1 } })

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest matcher
          headers: expect.objectContaining({
            'X-MitsContextKey': 'my-ctx',
          }),
        }),
      )
    })

    it('does not set context key header for login path', async () => {
      const api = await createApi()
      mockAxiosInstance.request.mockResolvedValue({
        data: { ClassicLoginData: null },
      })
      await api.login({
        postData: {
          AppVersion: '1.0',
          ClassicLanguage: 0,
          Email: 'u',
          Password: 'p',
          Persist: true,
        },
      })

      // Login goes through #dispatch which sends empty headers when contextKey is ''
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {},
          url: '/Login/ClientLogin3',
        }),
      )
    })

    it('re-authenticates when session is expired', async () => {
      const { settingManager } = createSettingStore({
        password: 'pass',
        username: 'user',
      })
      mockLoginAndList('newer', '2030-01-01T00:00:00')
      const api = await createApi({ settingManager })
      /* Simulate an expired session after initial create */
      settingManager.set('contextKey', 'old-ctx')
      settingManager.set('expiry', '2020-01-01T00:00:00')
      mockAxiosInstance.request.mockClear()
      mockLoginAndList('newest', '2030-01-01T00:00:00')
      await api.getValues({ params: { buildingId: 1, id: 1 } })

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest matcher
          headers: expect.objectContaining({
            'X-MitsContextKey': 'newest',
          }),
          url: '/ClassicDevice/Get',
        }),
      )
    })

    it('re-authenticates when contextKey is empty', async () => {
      const { settingManager } = createSettingStore({
        password: 'pass',
        username: 'user',
      })
      mockLoginAndList()
      const api = await createApi({ settingManager })
      /* Simulate a cleared session after initial create */
      settingManager.set('contextKey', '')
      mockAxiosInstance.request.mockClear()
      mockLoginAndList('fresh', '2030-12-31T00:00:00')
      await api.getValues({ params: { buildingId: 1, id: 1 } })

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest matcher
          data: expect.objectContaining({
            Email: 'user',
            Password: 'pass',
          }),
          url: '/Login/ClientLogin3',
        }),
      )
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest matcher
          headers: expect.objectContaining({
            'X-MitsContextKey': 'fresh',
          }),
          url: '/ClassicDevice/Get',
        }),
      )
    })

    it('treats malformed expiry as expired', async () => {
      const { settingManager } = createSettingStore({
        password: 'pass',
        username: 'user',
      })
      mockLoginAndList()
      const api = await createApi({ settingManager })
      /* Simulate a stale session after initial create */
      settingManager.set('contextKey', 'stale')
      settingManager.set('expiry', 'not-a-valid-iso-date')
      mockAxiosInstance.request.mockClear()
      mockLoginAndList('fresh', '2030-12-31T00:00:00')
      await api.getValues({ params: { buildingId: 1, id: 1 } })

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/Login/ClientLogin3' }),
      )
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest matcher
          headers: expect.objectContaining({
            'X-MitsContextKey': 'fresh',
          }),
        }),
      )
    })

    it('skips reauth when expiry is empty but contextKey is present', async () => {
      const { settingManager } = createSettingStore({ contextKey: 'valid' })
      mockLoginAndList()
      const api = await createApi({ settingManager })
      mockAxiosInstance.request.mockClear()
      mockAxiosInstance.request.mockResolvedValue({ data: {} })
      await api.getValues({ params: { buildingId: 1, id: 1 } })

      // Should NOT have called login
      expect(mockAxiosInstance.request).not.toHaveBeenCalledWith(
        expect.objectContaining({ url: '/Login/ClientLogin3' }),
      )

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest matcher
          headers: expect.objectContaining({
            'X-MitsContextKey': 'valid',
          }),
        }),
      )
    })

    it('clears persisted session when server rejects login', async () => {
      const { setSpy, settingManager } = createSettingStore({
        contextKey: 'old-ctx',
        expiry: '2030-12-31T00:00:00',
      })
      mockLoginAndList()
      const api = await createApi({ settingManager })
      setSpy.mockClear()
      mockAxiosInstance.request.mockResolvedValueOnce({
        data: { ClassicLoginData: null },
      })

      const isAuthenticated = await api.authenticate({
        password: 'wrong',
        username: 'user',
      })

      expect(isAuthenticated).toBe(false)
      expect(setSpy).toHaveBeenCalledWith('contextKey', '')
      expect(setSpy).toHaveBeenCalledWith('expiry', '')
    })

    it('retries with re-authentication on 401', async () => {
      mockLoginAndList('ctx', '2030-12-31T00:00:00')
      const api = await createApi({ password: 'pass', username: 'user' })

      // First call returns 401, re-auth succeeds, retry succeeds
      let isCallCount = 0
      mockAxiosInstance.request.mockImplementation(
        (config: { url?: string } = {}) => {
          if (config.url === '/Login/ClientLogin3') {
            return loginResponse('new-ctx', '2030-12-31T00:00:00')
          }
          if (config.url === '/User/ListDevices') {
            return { data: [] }
          }
          isCallCount += 1
          if (isCallCount === 1) {
            throw createAxiosError({
              message: 'unauthorized',
              status: 401,
              url: '/ClassicDevice/Get',
            })
          }
          return { data: { value: 'retried' } }
        },
      )
      const result = await api.getValues({
        params: { buildingId: 1, id: 1 },
      })

      expect(result.data).toStrictEqual({ value: 'retried' })
    })

    it('surfaces 401 when re-authentication fails', async () => {
      mockLoginAndList('ctx', '2030-12-31T00:00:00')
      const api = await createApi({ password: 'pass', username: 'user' })

      // 401 on endpoint, re-auth returns ClassicLoginData: null → authenticate() returns false
      mockAxiosInstance.request.mockImplementation(
        (config: { url?: string } = {}) => {
          if (config.url === '/Login/ClientLogin3') {
            return { data: { ClassicLoginData: null } }
          }
          if (config.url === '/User/ListDevices') {
            return { data: [] }
          }
          throw createAxiosError({
            message: 'unauthorized',
            status: 401,
            url: '/ClassicDevice/Get',
          })
        },
      )

      await expect(
        api.getValues({ params: { buildingId: 1, id: 1 } }),
      ).rejects.toThrow('unauthorized')
    })

    it('handles errors without crashing when error has no config', async () => {
      const logger = createLogger()
      mockLoginAndList()
      const api = await createApi({
        logger,
        password: 'pass',
        username: 'user',
      })
      // An error with no response — e.g. network/TLS failure
      mockAxiosInstance.request.mockRejectedValueOnce(
        new Error('connect ECONNREFUSED'),
      )

      await expect(
        api.getValues({ params: { buildingId: 1, id: 1 } }),
      ).rejects.toThrow('connect ECONNREFUSED')
    })
  })

  describe('fetch with complex building structure', () => {
    it('syncs floors, areas, and devices from building structure', async () => {
      const building = createBuilding({
        Name: 'B1',
        Structure: {
          Areas: [
            {
              BuildingId: toClassicBuildingId(1),
              Devices: [
                createDevice({
                  AreaID: 100,
                  DeviceID: 2000,
                  DeviceName: 'ClassicArea ClassicDevice',
                }),
              ],
              FloorId: null,
              ID: 100,
              Name: 'A1',
            },
          ],
          Devices: [
            createDevice({
              DeviceID: 1000,
              DeviceName: 'ClassicBuilding ClassicDevice',
            }),
          ],
          Floors: [
            {
              Areas: [
                {
                  BuildingId: toClassicBuildingId(1),
                  Devices: [
                    createDevice({
                      AreaID: 200,
                      DeviceID: 3000,
                      DeviceName: 'ClassicFloor ClassicArea ClassicDevice',
                      FloorID: 10,
                    }),
                  ],
                  FloorId: 10,
                  ID: 200,
                  Name: 'FA1',
                },
              ],
              BuildingId: toClassicBuildingId(1),
              Devices: [
                createDevice({
                  DeviceID: 4000,
                  DeviceName: 'ClassicFloor ClassicDevice',
                  FloorID: 10,
                }),
              ],
              ID: 10,
              Name: 'F1',
            },
          ],
        },
      })
      mockAxiosInstance.request.mockResolvedValue({ data: [building] })
      const api = await createApi()
      const buildings = await api.fetch()

      expect(buildings).toHaveLength(1)
      expect(api.registry.buildings.getById(1)?.name).toBe('B1')
      expect(api.registry.floors.getById(10)?.name).toBe('F1')
      expect(api.registry.areas.getById(100)?.name).toBe('A1')
      expect(api.registry.areas.getById(200)?.name).toBe('FA1')
      expect(api.registry.devices.getById(1000)?.name).toBe(
        'ClassicBuilding ClassicDevice',
      )
      expect(api.registry.devices.getById(2000)?.name).toBe(
        'ClassicArea ClassicDevice',
      )
      expect(api.registry.devices.getById(3000)?.name).toBe(
        'ClassicFloor ClassicArea ClassicDevice',
      )
      expect(api.registry.devices.getById(4000)?.name).toBe(
        'ClassicFloor ClassicDevice',
      )
    })
  })
})
