import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ClassicAPI,
  ClassicAPIConfig,
  SyncCallback,
} from '../../src/api/index.ts'
import type { ClassicDeviceType } from '../../src/constants.ts'
import { AuthenticationError } from '../../src/errors/index.ts'
import { Temporal } from '../../src/temporal.ts'
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
  defined,
  matchObject,
  mock,
  okValue,
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
 * @param buildings - Buildings returned by the mocked list call.
 */
const mockLoginAndList = (
  contextKey = 'ctx',
  expiry = '2030-12-31T00:00:00',
  buildings: ReturnType<typeof classicBuildingWithStructure>[] = [],
): void => {
  mockRequest.mockImplementation(async (config) => {
    await Promise.resolve()
    if (config.url === '/Login/ClientLogin3') {
      return loginResponse(contextKey, expiry)
    }
    if (config.url === '/User/ListDevices') {
      return wrap(buildings)
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
  let melCloudApi: typeof ClassicAPI

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

  // One-device building behind the login + list mocks, then a real
  // authenticate(): the shared starting state of the registry
  // lifecycle cases (populate on login, empty on logOut).
  const authenticateWithPopulatedRegistry = async (): Promise<
    Awaited<ReturnType<typeof melCloudApi.create>>
  > => {
    mockLoginAndList('ctx', '2030-12-31T00:00:00', [
      classicBuildingWithStructure({
        Structure: {
          Areas: [],
          Devices: [
            classicRawDevice({ DeviceID: 42, DeviceName: 'Populated' }),
          ],
          Floors: [],
        },
      }),
    ])
    const api = await createApi()
    await api.authenticate({ password: 'pass', username: 'user' })
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

  // The Classic half of the post-auth sync contract (the Home suite
  // asks the same two questions of its own wiring): the enforced sync
  // propagates, while the heartbeat's `fetch()` still swallows and,
  // swallowing, announces nothing.
  it('rejects the sign-in when the enforced post-auth sync fails', async () => {
    mockLoginAndList()
    const api = await createApi({ password: 'pass', username: 'user' })
    // The credential check still passes; only the registry refresh
    // that the sign-in enforces fails.
    mockRequest.mockImplementation(async (config) => {
      await Promise.resolve()
      if (config.url === '/Login/ClientLogin3') {
        return loginResponse('ctx', '2030-12-31T00:00:00')
      }
      throw new Error('registry')
    })

    await expect(
      api.authenticate({ password: 'pass', username: 'user' }),
    ).rejects.toThrow('registry')
  })

  it('stays silent when a sync cycle fails', async () => {
    const onSyncComplete = vi.fn<SyncCallback>()
    mockLoginAndList()
    const api = await createApi({ events: { onSyncComplete } })
    onSyncComplete.mockClear()
    mockRequest.mockRejectedValueOnce(new Error('network'))

    await expect(api.fetch()).resolves.toStrictEqual([])

    expect(onSyncComplete).not.toHaveBeenCalled()
  })

  it('accepts custom configuration', async () => {
    const onSyncComplete = vi.fn<SyncCallback>()
    const api = await createApi({
      events: { onSyncComplete },
      language: 'fr',
      locale: 'fr-FR',
      logger: createLogger(),
      shouldVerifySSL: false,
      timezone: 'Europe/Paris',
    })

    onSyncComplete.mockClear()
    await api.notifySync({ type: undefined })

    expect(onSyncComplete).toHaveBeenCalledWith({ type: undefined })
    expect(api.timezone).toBe('Europe/Paris')
    expect(api.locale).toBe('fr-FR')
  })

  it('exposes timezone and locale as undefined when none is configured', async () => {
    const api = await createApi()

    expect(api.timezone).toBeUndefined()
    expect(api.locale).toBeUndefined()
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
    // Persisted session so the create-time reuse probe runs the first
    // sync and arms the auto-sync timer the test advances into.
    const { settingManager } = createSettingStore({
      contextKey: 'test-context-key',
      expiry: '2099-12-31T00:00:00',
    })
    await melCloudApi.create({
      events: { onSyncComplete },
      logger,
      settingManager,
      syncIntervalMinutes: 1,
      transport: mockHttpClient,
    })
    onSyncComplete.mockImplementation(() => {
      throw new Error('sync callback failed')
    })
    await vi.advanceTimersByTimeAsync(60_000)

    expect(logger.error).toHaveBeenCalledWith(
      '[Classic]',
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

    // Schema-valid ATA payload: getEnergy responses are Zod-validated,
    // so mocking `{}` would silently reroute the call through the
    // validation-failure branch instead of the success path.
    const ataEnergyResponse = {
      Auto: [0, 0.5],
      Cooling: [0, 0.5],
      Dry: [0, 0.5],
      Fan: [0, 0.5],
      Heating: [0, 0.5],
      Labels: [0, 1],
      LabelType: 4,
      Other: [0, 0.5],
      TotalAutoConsumed: 0.5,
      TotalCoolingConsumed: 0.5,
      TotalDryConsumed: 0.5,
      TotalFanConsumed: 0.5,
      TotalHeatingConsumed: 0.5,
      TotalOtherConsumed: 0.5,
      UsageDisclaimerPercentages: '100',
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
          method === 'login'
            ? {
                LoginData: {
                  ContextKey: 'ctx',
                  Expiry: '2099-01-01T00:00:00Z',
                },
              }
            : method === 'getEnergy'
              ? ataEnergyResponse
              : {},
        ),
      )
      await api[method](cast(args))

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'post', url: path }),
      )
    })

    it('returns validated energy data for a well-formed ATA payload', async () => {
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockRequest.mockResolvedValue(wrap(ataEnergyResponse))
      const result = await api.getEnergy({ postData: cast(reportPostData) })

      expect(okValue(result)).toStrictEqual(ataEnergyResponse)
    })

    it('returns a validation failure when the energy payload is malformed', async () => {
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockRequest.mockResolvedValue(wrap({ TotalHeatingConsumed: 'oops' }))
      const result = await api.getEnergy({ postData: cast(reportPostData) })

      expect(result.ok).toBe(false)
      expect(!result.ok && result.error.kind).toBe('validation')
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

    it('fetch hits ListDevices', async () => {
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockRequest.mockResolvedValue({ data: [], headers: {}, status: 200 })
      await api.fetch()

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
          >({ DeviceID: toClassicDeviceId(1), EffectiveFlags: 1 }),
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
    // The live session outranks the refused re-sign-in: `resumeSession`
    // answers "is there a usable session", and reporting `false` over a
    // working one is what had `initialize()` emit a spurious
    // authentication-lost, prompting a user whose app was fine.
    it('reports the live session and logs when LoginData is null', async () => {
      const logger = createLogger()
      mockLoginAndList()
      const api = await createApi({
        logger,
        password: 'pass',
        username: 'user',
      })
      mockRequest.mockResolvedValue(wrap({ LoginData: null }))

      const isResumed = await api.resumeSession()

      expect(isResumed).toBe(true)
      // The failed attempt leaves the live session standing: nothing
      // is cleared before the server verdict.
      expect(api.isAuthenticated()).toBe(true)
      expect(logger.error).toHaveBeenCalledWith(
        '[Classic]',
        'Session resume failed:',
        expect.any(AuthenticationError),
      )
    })

    // Post-condition contract: a successful authenticate() must leave
    // the registry populated so callers never see an empty device list
    // after a successful login. Enforced by BaseAPI.authenticate's
    // template method (guard against OlivierZal/com.melcloud#1281-style regressions).
    it('populates the device registry during authenticate', async () => {
      const api = await authenticateWithPopulatedRegistry()

      expect(api.registry.devices.getById(42)?.name).toBe('Populated')
    })

    it('empties the device registry and de-authenticates on logOut', async () => {
      const api = await authenticateWithPopulatedRegistry()

      expect(api.isAuthenticated()).toBe(true)

      api.logOut()

      expect(api.registry.getDevices()).toHaveLength(0)
      expect(api.registry.buildings.getById(1)).toBeUndefined()
      expect(api.isAuthenticated()).toBe(false)
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

      const value = okValue(result)

      expect(value.entries).toHaveLength(1)
      expect(value.entries[0]?.message).toBe('Some error')
      // No configured timezone: the building-local StartDate anchors in
      // the host's zone, the same fallback the holiday projection takes.
      expect(value.entries[0]?.atEpochMs).toBe(
        Temporal.PlainDateTime.from('2024-01-01T12:00:00').toZonedDateTime(
          Temporal.Now.timeZoneId(),
        ).epochMilliseconds,
      )
    })

    it('anchors the building-local StartDate in the configured timezone', async () => {
      mockLoginAndList()
      const api = await createApi({
        password: 'pass',
        timezone: 'Europe/Paris',
        username: 'user',
      })
      mockRequest.mockResolvedValue(
        wrap([errorEntry({ StartDate: '2026-03-01T06:00:00' })]),
      )
      const result = await api.getErrorLog({}, [1])

      // Paris winter wall clock (UTC+1): 06:00 locally is 05:00Z — a
      // projection that drops the zone cannot pass.
      expect(defined(okValue(result).entries[0]).atEpochMs).toBe(
        Temporal.Instant.from('2026-03-01T05:00:00Z').epochMilliseconds,
      )
    })

    // One filtering mechanism, three year-1 sentinel spellings: each
    // row is a wire shape the parser must read as "no instant".
    it.each([
      {
        entry: {
          EndDate: '0001-01-01',
          ErrorMessage: 'Bad',
          StartDate: '0001-01-01T00:00:00',
        },
        sentinel: 'entries with invalid year',
      },
      {
        entry: {
          EndDate: '2025-09-29T20:56:00+01:00',
          ErrorMessage: 'Unknown Error',
          StartDate: '0001-01-01T00:00:00Z',
        },
        sentinel: 'the instant-dialect sentinel (live payload 2026-07-18)',
      },
      {
        entry: {
          ErrorMessage: 'Unknown Error',
          // Lands in UTC year 0 — still the sentinel, never an
          // ancient instant.
          StartDate: '0001-01-01T00:00:00+01:00',
        },
        sentinel: 'an offset-shifted year-1 sentinel',
      },
    ])('filters out $sentinel', async ({ entry }) => {
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockRequest.mockResolvedValue(wrap([errorEntry(entry)]))
      const result = await api.getErrorLog({}, [1])

      expect(okValue(result).entries).toHaveLength(0)
    })

    it('keeps entries with unparseable StartDate (no invalid-year sentinel)', async () => {
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockRequest.mockResolvedValue(
        wrap([
          errorEntry({ ErrorMessage: 'Mystery', StartDate: 'not-a-real-date' }),
        ]),
      )
      const result = await api.getErrorLog({}, [1])

      expect(okValue(result).entries).toHaveLength(1)
      expect(okValue(result).entries[0]?.message).toBe('Mystery')
      // The kept-garbage policy carries into the normalized instant:
      // what cannot be parsed reads null — never a fabricated epoch,
      // and never NaN, which JSON.stringify would silently rewrite.
      expect(defined(okValue(result).entries[0]).atEpochMs).toBeNull()
    })

    it('returns validation failure when the API returns failure data', async () => {
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockRequest.mockResolvedValue(
        wrap({ AttributeErrors: { field: ['error'] }, Success: false }),
      )
      const result = await api.getErrorLog({}, [1])

      expect(result.ok).toBe(false)
      expect(!result.ok && result.error.kind).toBe('validation')
    })

    it('handles offset and period', async () => {
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockRequest.mockResolvedValue({ data: [], headers: {}, status: 200 })
      const result = await api.getErrorLog(
        { offset: 2, period: 5, to: '2024-06-01' },
        [1],
      )

      // offset=2, period=5 → daysBack = 2 * (5 + 1) = 12
      // toDate = 2024-06-01 - 12d = 2024-05-20
      // fromDate = toDate - 5d = 2024-05-15
      expect(okValue(result)).toMatchObject({
        fromDate: '2024-05-15',
        nextFromDate: '2024-05-09',
        nextToDate: '2024-05-14',
      })
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

      expect(okValue(result)).toHaveProperty('entries')
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

      expect(okValue(result).entries).toHaveLength(0)
    })

    it('throws on invalid date in query', async () => {
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockRequest.mockResolvedValue({ data: [], headers: {}, status: 200 })

      await expect(api.getErrorLog({ to: 'not-a-date' }, [1])).rejects.toThrow(
        'Invalid DateTime',
      )
    })

    it('propagates transport failure from getErrorEntries', async () => {
      mockLoginAndList()
      const api = await createApi({ password: 'pass', username: 'user' })
      mockRequest.mockRejectedValue(
        createHttpError({
          message: 'boom',
          status: 500,
          url: '/Report/GetUnitErrorLog2',
        }),
      )
      const result = await api.getErrorLog({ from: '2024-01-01' }, [1])

      expect(result.ok).toBe(false)
      expect(!result.ok && result.error.kind).toBe('server')
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
          headers: matchObject({ 'X-MitsContextKey': 'my-ctx' }),
        }),
      )
    })

    it('does not set context key header for login path', async () => {
      const api = await createApi()
      mockRequest.mockResolvedValue(wrap({ LoginData: null }))

      await expect(
        api.authenticate({ password: 'p', username: 'u' }),
      ).rejects.toThrow('MELCloud Classic rejected the credentials')

      // Login goes through #dispatch which sends empty headers when contextKey is ''
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ headers: {}, url: '/Login/ClientLogin3' }),
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
          headers: matchObject({ 'X-MitsContextKey': 'newest' }),
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
          data: matchObject({ Email: 'user', Password: 'pass' }),
          url: '/Login/ClientLogin3',
        }),
      )
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: matchObject({ 'X-MitsContextKey': 'fresh' }),
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
          headers: matchObject({ 'X-MitsContextKey': 'fresh' }),
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

      expect(mockRequest).not.toHaveBeenCalledWith(
        expect.objectContaining({ url: '/Login/ClientLogin3' }),
      )

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: matchObject({ 'X-MitsContextKey': 'valid' }),
        }),
      )
    })

    it('keeps the stored credentials and session when the server rejects a login', async () => {
      const { setSpy, settingManager } = createSettingStore({
        contextKey: 'old-ctx',
        expiry: '2030-12-31T00:00:00',
        password: 'good-pass',
        username: 'good-user',
      })
      mockLoginAndList()
      const api = await createApi({ settingManager })
      setSpy.mockClear()
      mockRequest.mockResolvedValueOnce(wrap({ LoginData: null }))

      await expect(
        api.authenticate({ password: 'wrong', username: 'typo-user' }),
      ).rejects.toThrow(AuthenticationError)

      // A mistyped attempt must neither overwrite the working stored
      // pair nor wipe the live session — only the backoff persists.
      expect(settingManager.get('username')).toBe('good-user')
      expect(settingManager.get('password')).toBe('good-pass')
      expect(settingManager.get('contextKey')).toBe('old-ctx')
      expect(setSpy).not.toHaveBeenCalledWith('contextKey', '')
      expect(setSpy).not.toHaveBeenCalledWith('expiry', '')
    })

    it('persists the accepted credentials and replaces the session on success', async () => {
      const { settingManager } = createSettingStore({
        contextKey: 'old-ctx',
        expiry: '2020-01-01T00:00:00',
        password: 'old-pass',
        username: 'old-user',
      })
      mockLoginAndList('new-ctx', '2030-12-31T00:00:00')
      const api = await createApi({ settingManager })

      await api.authenticate({ password: 'new-pass', username: 'new-user' })

      expect(settingManager.get('username')).toBe('new-user')
      expect(settingManager.get('password')).toBe('new-pass')
      expect(settingManager.get('contextKey')).toBe('new-ctx')
    })

    it('retries with re-authentication on 401', async () => {
      mockLoginAndList('ctx', '2030-12-31T00:00:00')
      const api = await createApi({ password: 'pass', username: 'user' })

      // First call returns 401, re-auth succeeds, retry succeeds
      let callCount = 0
      mockRequest.mockImplementation(async (config) => {
        await Promise.resolve()
        if (config.url === '/Login/ClientLogin3') {
          return loginResponse('new-ctx', '2030-12-31T00:00:00')
        }
        if (config.url === '/User/ListDevices') {
          return wrap([])
        }
        callCount++
        if (callCount === 1) {
          throw createHttpError({
            message: 'unauthorized',
            status: 401,
            url: '/Device/Get',
          })
        }
        return wrap({ value: 'retried' })
      })
      const result = await api.getValues({ params: { buildingId: 1, id: 1 } })

      expect(okValue(result)).toStrictEqual({ value: 'retried' })
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

      const result = await api.getValues({ params: { buildingId: 1, id: 1 } })

      expect(result.ok).toBe(false)
      expect(!result.ok && result.error.kind).toBe('unauthorized')
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

      const result = await api.getValues({ params: { buildingId: 1, id: 1 } })

      expect(result.ok).toBe(false)
      expect(!result.ok && result.error.kind).toBe('network')
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

  it('classifies ErrorId 6 as a login throttle, not bad credentials', async () => {
    const { AuthenticationThrottledError } =
      await import('../../src/errors/index.ts')
    mockRequest.mockResolvedValue(wrap({ ErrorId: 6, LoginData: null }))
    const api = await createApi()

    await expect(
      api.authenticate({ password: 'p', username: 'u@test.com' }),
    ).rejects.toThrow(AuthenticationThrottledError)
  })

  it('carries the announced lockout from LoginMinutes', async () => {
    mockRequest.mockResolvedValue(
      wrap({ ErrorId: 6, LoginData: null, LoginMinutes: 60 }),
    )
    const api = await createApi()

    await expect(
      api.authenticate({ password: 'p', username: 'u@test.com' }),
    ).rejects.toMatchObject({
      retryAfter: expect.objectContaining({ minutes: 60 }) as unknown,
    })
  })

  it.each([
    { announced: undefined, label: 'absent' },
    { announced: null, label: 'null' },
    { announced: 0, label: 'zero' },
    // The endpoint sent -10033 in the field: a sentinel, not a window.
    { announced: -10_033, label: 'negative' },
  ])(
    'announces no window when LoginMinutes is $label',
    async ({ announced }) => {
      mockRequest.mockResolvedValue(
        wrap({ ErrorId: 6, LoginData: null, LoginMinutes: announced }),
      )
      const api = await createApi()

      await expect(
        api.authenticate({ password: 'p', username: 'u@test.com' }),
      ).rejects.toMatchObject({ retryAfter: null })
    },
  )
})
