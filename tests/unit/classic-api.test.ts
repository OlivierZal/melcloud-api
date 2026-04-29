import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ClassicAPI,
  ClassicAPIConfig,
  SyncCallback,
} from '../../src/api/index.ts'
import type { ClassicDeviceType } from '../../src/constants.ts'
import { AuthenticationError } from '../../src/errors/index.ts'
import {
  type ClassicSetDevicePostData,
  toClassicBuildingId,
  toClassicDeviceId,
} from '../../src/types/index.ts'
import {
  classicBuildingWithStructure,
  classicRawDevice,
} from '../classic-fixtures.ts'
import {
  cast,
  createHttpError,
  createLogger,
  createMockHttpClient,
  createSettingStore,
  matchObject,
  mock,
} from '../helpers.ts'

const { client: mockHttpClient, requestSpy: mockRequest } =
  createMockHttpClient('https://app.melcloud.com/Mitsubishi.Wifi.Client')

const wrap = <T>(
  data: T,
): { data: T; headers: Record<string, never>; status: number } => ({
  data,
  headers: {},
  status: 200,
})

const loginResponse = (
  contextKey = 'ctx',
  expiry = '2030-12-31T00:00:00',
): ReturnType<
  typeof wrap<{ LoginData: { ContextKey: string; Expiry: string } }>
> => wrap({ LoginData: { ContextKey: contextKey, Expiry: expiry } })

/**
 * Configure `mockRequest` to handle login (POST) and list (GET)
 * calls by discriminating on the `url` field in the request config.
 * @param contextKey - LoginData.ContextKey returned by the mocked login call.
 * @param expiry - LoginData.Expiry returned by the mocked login call.
 */
const mockLoginAndList = (
  contextKey = 'ctx',
  expiry = '2030-12-31T00:00:00',
): void => {
  mockRequest.mockImplementation(async (config) => {
    await Promise.resolve()
    if (config.url === '/Login/ClientLogin3') {
      return loginResponse(contextKey, expiry)
    }
    if (config.url === '/User/ListDevices') {
      return wrap([])
    }
    return wrap({})
  })
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

describe('mELCloud Classic API', () => {
  let melCloudApi: typeof ClassicAPI = cast(null)

  beforeEach(async () => {
    vi.useFakeTimers()
    mockRequest.mockResolvedValue({ data: [], headers: {}, status: 200 })
    ;({ ClassicAPI: melCloudApi } = await import('../../src/api/classic.ts'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const createApi = async (
    config: ClassicAPIConfig = {},
  ): Promise<Awaited<ReturnType<typeof melCloudApi.create>>> =>
    melCloudApi.create({
      syncIntervalMinutes: false,
      transport: mockHttpClient,
      ...config,
    })

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
    const onSyncComplete = vi.fn<SyncCallback>()
    const api = await createApi({
      events: { onSyncComplete },
      language: 'fr',
      logger: createLogger(),
      shouldVerifySSL: false,
      timezone: 'Europe/Paris',
    })

    onSyncComplete.mockClear()
    await api.notifySync({ type: undefined })

    expect(onSyncComplete).toHaveBeenCalledWith({ type: undefined })
  })

  it('accepts a disabled sync timer', async () => {
    const api = await melCloudApi.create({
      syncIntervalMinutes: false,
      transport: mockHttpClient,
    })

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
    const building = classicBuildingWithStructure()
    mockRequest.mockResolvedValue({
      data: [building],
      headers: {},
      status: 200,
    })
    const api = await createApi()
    const buildings = await api.fetch()

    expect(buildings).toHaveLength(1)
  })

  it('returns empty array when fetch fails', async () => {
    const api = await createApi()
    mockRequest.mockRejectedValueOnce(new Error('Network'))
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

  it('schedules next sync when intervalMinutes is set', async () => {
    await melCloudApi.create({
      syncIntervalMinutes: 1,
      transport: mockHttpClient,
    })

    expect(() => {
      vi.advanceTimersByTime(60_000)
    }).not.toThrow()
  })

  it('logs error when auto-sync onSyncComplete callback throws', async () => {
    const logger = createLogger()
    const onSyncComplete = vi
      .fn<SyncCallback>()
      .mockImplementationOnce(async () => {
        // First call (initial create) succeeds, subsequent calls can throw
      })
    await melCloudApi.create({
      events: { onSyncComplete },
      logger,
      syncIntervalMinutes: 1,
      transport: mockHttpClient,
    })
    onSyncComplete.mockImplementation(() => {
      throw new Error('sync callback failed')
    })
    await vi.advanceTimersByTimeAsync(60_000)

    expect(logger.error).toHaveBeenCalledWith(
      'LifecycleEvents.onSyncComplete callback threw — ignoring',
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
        path: '/Device/Power',
      },
    ])('calls $method via POST', async ({ args, method, path }) => {
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockRequest.mockResolvedValue(
        wrap(
          method === 'login' ?
            { LoginData: { ContextKey: 'ctx', Expiry: '2099-01-01T00:00:00Z' } }
          : {},
        ),
      )
      await api[method](cast(args))

      expect(mockRequest).toHaveBeenCalledWith(
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
        path: '/Device/Get',
      },
    ])('calls $method via GET', async ({ args, method, path }) => {
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockRequest.mockResolvedValue({ data: {}, headers: {}, status: 200 })
      await api[method](cast(args))

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'get', url: path }),
      )
    })

    it('calls list', async () => {
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockRequest.mockResolvedValue({ data: [], headers: {}, status: 200 })
      await api.list()

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'get', url: '/User/ListDevices' }),
      )
    })

    it.each([
      { path: '/Device/SetAta', type: 0 as const },
      { path: '/Device/SetAtw', type: 1 as const },
      { path: '/Device/SetErv', type: 3 as const },
    ])(
      'calls updateValues for type $type via $path',
      async ({ path, type }) => {
        mockLoginAndList()
        const api = await createApi({ password: 'pass', username: 'user' })
        mockRequest.mockResolvedValue({ data: {}, headers: {}, status: 200 })
        await api.updateValues({
          postData: mock<
            ClassicSetDevicePostData<typeof ClassicDeviceType.Ata>
          >({
            DeviceID: toClassicDeviceId(1),
            EffectiveFlags: 1,
          }),
          type,
        })

        expect(mockRequest).toHaveBeenCalledWith(
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
      await api.authenticate({ password: 'pass', username: 'user' })

      expect(api.isAuthenticated()).toBe(true)
    })

    it('throws AuthenticationError when login data is null with explicit credentials', async () => {
      const api = await createApi()
      mockRequest.mockResolvedValue(wrap({ LoginData: null }))

      await expect(
        api.authenticate({ password: 'pass', username: 'user' }),
      ).rejects.toThrow(AuthenticationError)
    })

    // Pins the Classic-specific normalization path: MELCloud returns
    // `HTTP 200 { LoginData: null }` for bad credentials (not a 401),
    // so `doAuthenticate` throws AuthenticationError directly — which
    // `resumeSession` then logs and swallows. The generic "no
    // credentials persisted" and "doAuthenticate rejects → logged +
    // false" cases are covered at the BaseAPI unit level
    // (base-api.test.ts → `authenticate() vs resumeSession() contract`).
    it('resumeSession logs AuthenticationError when LoginData is null', async () => {
      const logger = createLogger()
      mockLoginAndList()
      const api = await createApi({
        logger,
        password: 'pass',
        username: 'user',
      })
      mockRequest.mockResolvedValue(wrap({ LoginData: null }))

      const isResumed = await api.resumeSession()

      expect(isResumed).toBe(false)
      expect(api.isAuthenticated()).toBe(false)
      expect(logger.error).toHaveBeenCalledWith(
        'Session resume failed:',
        expect.any(AuthenticationError),
      )
    })

    // Post-condition contract: a successful authenticate() must leave
    // the registry populated so callers never see an empty device list
    // after a successful login. Enforced by BaseAPI.authenticate's
    // template method (guard against OlivierZal/com.melcloud#1281-style regressions).
    it('populates the device registry during authenticate', async () => {
      const building = classicBuildingWithStructure({
        Structure: {
          Areas: [],
          Devices: [
            classicRawDevice({ DeviceID: 42, DeviceName: 'Populated' }),
          ],
          Floors: [],
        },
      })
      mockRequest.mockImplementation(async (config) => {
        await Promise.resolve()
        if (config.url === '/Login/ClientLogin3') {
          return loginResponse()
        }
        if (config.url === '/User/ListDevices') {
          return wrap([building])
        }
        return wrap({})
      })
      const api = await createApi()
      await api.authenticate({ password: 'pass', username: 'user' })

      expect(api.registry.devices.getById(42)?.name).toBe('Populated')
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
      mockRequest.mockResolvedValue({ data: true, headers: {}, status: 200 })
      await api.updateLanguage('fr')

      expect(mockRequest).toHaveBeenCalledWith(
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
      mockRequest.mockClear()
      await api.updateLanguage('en')

      expect(mockRequest).not.toHaveBeenCalled()
    })

    it('handles invalid language codes', async () => {
      mockLoginAndList()
      const api = await createApi({
        language: 'en',
        password: 'pass',
        username: 'user',
      })
      mockRequest.mockResolvedValue({ data: true, headers: {}, status: 200 })
      await api.updateLanguage('invalid')

      expect(mockRequest).toHaveBeenCalledWith(
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
      mockRequest.mockResolvedValue({ data: false, headers: {}, status: 200 })
      await api.updateLanguage('fr')
      mockRequest.mockClear()
      await api.updateLanguage('en')

      expect(mockRequest).not.toHaveBeenCalled()
    })
  })

  describe('sync interval', () => {
    it('reschedules sync with new interval', async () => {
      const api = await createApi({ syncIntervalMinutes: false })
      api.setSyncInterval(10)

      expect(vi.getTimerCount()).toBe(1)
    })

    it('disables sync when set to false', async () => {
      const api = await createApi({ syncIntervalMinutes: 5 })
      api.setSyncInterval(false)

      expect(vi.getTimerCount()).toBe(0)
    })
  })

  describe('error log retrieval', () => {
    it('returns parsed error log', async () => {
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockRequest.mockResolvedValue(wrap([errorEntry()]))
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
      mockRequest.mockResolvedValue(
        wrap([
          errorEntry({
            EndDate: '0001-01-01',
            ErrorMessage: 'Bad',
            StartDate: '0001-01-01T00:00:00',
          }),
        ]),
      )
      const result = await api.getErrorLog({}, [1])

      expect(result.errors).toHaveLength(0)
    })

    it('throws when the API returns failure data', async () => {
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockRequest.mockResolvedValue(
        wrap({ AttributeErrors: { field: ['error'] }, Success: false }),
      )

      await expect(api.getErrorLog({}, [1])).rejects.toThrow('field')
    })

    it('handles offset and limit', async () => {
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockRequest.mockResolvedValue({ data: [], headers: {}, status: 200 })
      const result = await api.getErrorLog(
        { limit: '5', offset: '2', to: '2024-06-01' },
        [1],
      )

      expect(result).toHaveProperty('fromDate')
      expect(result).toHaveProperty('nextFromDate')
    })

    it('uses all devices when no deviceIds provided', async () => {
      const building = classicBuildingWithStructure({
        Structure: {
          Areas: [],
          Devices: [classicRawDevice({ DeviceID: 42, DeviceName: 'D1' })],
          Floors: [],
        },
      })
      mockRequest.mockResolvedValue({
        data: [building],
        headers: {},
        status: 200,
      })
      const api = await createApi()
      await api.fetch()
      mockLoginAndList()
      mockRequest.mockImplementation(async (config) => {
        await Promise.resolve()
        if (config.url === '/Report/GetUnitErrorLog2') {
          return wrap([])
        }
        if (config.url === '/Login/ClientLogin3') {
          return loginResponse()
        }
        return wrap([])
      })
      const result = await api.getErrorLog({})

      expect(result).toHaveProperty('errors')
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          data: matchObject({ DeviceIDs: [42] }),
          url: '/Report/GetUnitErrorLog2',
        }),
      )
    })

    it('filters null/empty error messages', async () => {
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockRequest.mockResolvedValue(wrap([errorEntry({ ErrorMessage: null })]))
      const result = await api.getErrorLog({ from: '2024-01-01' }, [1])

      expect(result.errors).toHaveLength(0)
    })

    it('throws on invalid date in query', async () => {
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockRequest.mockResolvedValue({ data: [], headers: {}, status: 200 })

      await expect(api.getErrorLog({ to: 'not-a-date' }, [1])).rejects.toThrow(
        'Invalid DateTime',
      )
    })
  })

  describe('request lifecycle', () => {
    it('sets X-MitsContextKey header on authenticated requests', async () => {
      mockLoginAndList('my-ctx')
      const api = await createApi({ password: 'pass', username: 'user' })
      mockRequest.mockResolvedValue({ data: {}, headers: {}, status: 200 })
      await api.getValues({ params: { buildingId: 1, id: 1 } })

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: matchObject({
            'X-MitsContextKey': 'my-ctx',
          }),
        }),
      )
    })

    it('does not set context key header for login path', async () => {
      const api = await createApi()
      mockRequest.mockResolvedValue(wrap({ LoginData: null }))
      await api.login({
        postData: {
          AppVersion: '1.0',
          Email: 'u',
          Language: 0,
          Password: 'p',
          Persist: true,
        },
      })

      // Login goes through #dispatch which sends empty headers when contextKey is ''
      expect(mockRequest).toHaveBeenCalledWith(
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
      // Simulate an expired session after initial create
      settingManager.set('contextKey', 'old-ctx')
      settingManager.set('expiry', '2020-01-01T00:00:00')
      mockRequest.mockClear()
      mockLoginAndList('newest', '2030-01-01T00:00:00')
      await api.getValues({ params: { buildingId: 1, id: 1 } })

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: matchObject({
            'X-MitsContextKey': 'newest',
          }),
          url: '/Device/Get',
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
      // Simulate a cleared session after initial create
      settingManager.set('contextKey', '')
      mockRequest.mockClear()
      mockLoginAndList('fresh', '2030-12-31T00:00:00')
      await api.getValues({ params: { buildingId: 1, id: 1 } })

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          data: matchObject({
            Email: 'user',
            Password: 'pass',
          }),
          url: '/Login/ClientLogin3',
        }),
      )
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: matchObject({
            'X-MitsContextKey': 'fresh',
          }),
          url: '/Device/Get',
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
      // Simulate a stale session after initial create
      settingManager.set('contextKey', 'stale')
      settingManager.set('expiry', 'not-a-valid-iso-date')
      mockRequest.mockClear()
      mockLoginAndList('fresh', '2030-12-31T00:00:00')
      await api.getValues({ params: { buildingId: 1, id: 1 } })

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/Login/ClientLogin3' }),
      )
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: matchObject({
            'X-MitsContextKey': 'fresh',
          }),
        }),
      )
    })

    it('skips reauth when expiry is empty but contextKey is present', async () => {
      const { settingManager } = createSettingStore({ contextKey: 'valid' })
      mockLoginAndList()
      const api = await createApi({ settingManager })
      mockRequest.mockClear()
      mockRequest.mockResolvedValue({ data: {}, headers: {}, status: 200 })
      await api.getValues({ params: { buildingId: 1, id: 1 } })

      // Should NOT have called login
      expect(mockRequest).not.toHaveBeenCalledWith(
        expect.objectContaining({ url: '/Login/ClientLogin3' }),
      )

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: matchObject({
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
      mockRequest.mockResolvedValueOnce(wrap({ LoginData: null }))

      await expect(
        api.authenticate({ password: 'wrong', username: 'user' }),
      ).rejects.toThrow(AuthenticationError)

      expect(setSpy).toHaveBeenCalledWith('contextKey', '')
      expect(setSpy).toHaveBeenCalledWith('expiry', '')
    })

    it('retries with re-authentication on 401', async () => {
      mockLoginAndList('ctx', '2030-12-31T00:00:00')
      const api = await createApi({ password: 'pass', username: 'user' })

      // First call returns 401, re-auth succeeds, retry succeeds
      let isCallCount = 0
      mockRequest.mockImplementation(async (config) => {
        await Promise.resolve()
        if (config.url === '/Login/ClientLogin3') {
          return loginResponse('new-ctx', '2030-12-31T00:00:00')
        }
        if (config.url === '/User/ListDevices') {
          return wrap([])
        }
        isCallCount += 1
        if (isCallCount === 1) {
          throw createHttpError({
            message: 'unauthorized',
            status: 401,
            url: '/Device/Get',
          })
        }
        return wrap({ value: 'retried' })
      })
      const result = await api.getValues({
        params: { buildingId: 1, id: 1 },
      })

      expect(result.data).toStrictEqual({ value: 'retried' })
    })

    it('surfaces 401 when re-authentication fails', async () => {
      mockLoginAndList('ctx', '2030-12-31T00:00:00')
      const api = await createApi({ password: 'pass', username: 'user' })

      // 401 on endpoint, re-auth throws AuthenticationError → decorator logs + returns false
      mockRequest.mockImplementation(async (config) => {
        await Promise.resolve()
        if (config.url === '/Login/ClientLogin3') {
          return wrap({ LoginData: null })
        }
        if (config.url === '/User/ListDevices') {
          return wrap([])
        }
        throw createHttpError({
          message: 'unauthorized',
          status: 401,
          url: '/Device/Get',
        })
      })

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
      mockRequest.mockRejectedValueOnce(new Error('connect ECONNREFUSED'))

      await expect(
        api.getValues({ params: { buildingId: 1, id: 1 } }),
      ).rejects.toThrow('connect ECONNREFUSED')
    })
  })

  describe('fetch with complex building structure', () => {
    it('syncs floors, areas, and devices from building structure', async () => {
      const building = classicBuildingWithStructure({
        Name: 'B1',
        Structure: {
          Areas: [
            {
              BuildingId: toClassicBuildingId(1),
              Devices: [
                classicRawDevice({
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
            classicRawDevice({
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
                    classicRawDevice({
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
                classicRawDevice({
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
      mockRequest.mockResolvedValue({
        data: [building],
        headers: {},
        status: 200,
      })
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
