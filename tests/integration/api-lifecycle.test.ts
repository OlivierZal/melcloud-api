import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClassicAPI } from '../../src/api/classic.ts'
import type { HomeAPI } from '../../src/api/home.ts'
import type { SyncCallback } from '../../src/api/index.ts'
import { ClassicDeviceType } from '../../src/constants.ts'
import { RateLimitError } from '../../src/errors/index.ts'
import { ClassicFacadeManager } from '../../src/facades/classic-manager.ts'
import { HttpError } from '../../src/http/index.ts'
import { MS_PER_HOUR } from '../../src/time-units.ts'
import {
  type ClassicBuildingWithStructure,
  type HomeContext,
  toClassicAreaId,
  toClassicBuildingId,
  toClassicDeviceId,
  toClassicFloorId,
} from '../../src/types/index.ts'
import { ataDeviceData, buildingData } from '../fixtures.ts'
import {
  cast,
  createMockHttpClient,
  createSettingStore,
  defined,
  mock,
  mockFetchResponse,
} from '../helpers.ts'

const transientError = (status: number): HttpError =>
  new HttpError(
    `Status ${String(status)}`,
    { data: {}, headers: {}, status },
    { url: '/User/ListDevices' },
  )

const buildingResponse: ClassicBuildingWithStructure[] = [
  mock<ClassicBuildingWithStructure>({
    ...buildingData({
      HMDefined: true,
      Location: 0,
      Name: 'Home',
      TimeZone: 1,
    }),
    Structure: {
      Areas: [],
      Devices: [],
      Floors: [
        {
          Areas: [
            {
              BuildingId: toClassicBuildingId(1),
              Devices: [
                {
                  AreaID: toClassicAreaId(100),
                  BuildingID: toClassicBuildingId(1),
                  Device: ataDeviceData({
                    NumberOfFanSpeeds: 5,
                    SetTemperature: 23,
                  }),
                  DeviceID: toClassicDeviceId(1001),
                  DeviceName: 'AC unit',
                  FloorID: toClassicFloorId(10),
                  Type: ClassicDeviceType.Ata,
                },
              ],
              FloorId: 10,
              ID: 100,
              Name: 'Living room',
            },
          ],
          BuildingId: toClassicBuildingId(1),
          Devices: [],
          ID: 10,
          Name: 'Ground floor',
        },
      ],
    },
  }),
]

const { client: mockHttpClient, requestSpy: mockRequest } =
  createMockHttpClient('https://app.melcloud.com/Mitsubishi.Wifi.Client')

describe('api lifecycle', () => {
  let melCloudApi: typeof ClassicAPI = cast(null)

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockRequest.mockResolvedValue({
      data: buildingResponse,
      headers: {},
      status: 200,
    })
    ;({ ClassicAPI: melCloudApi } = await import('../../src/api/classic.ts'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates ClassicAPI, syncs buildings, and populates the registry', async () => {
    const api = await melCloudApi.create({
      syncIntervalMinutes: false,
      transport: mockHttpClient,
    })

    expect(api.registry.getDevices()).toHaveLength(1)
    expect(
      api.registry.getDevicesByBuildingId(toClassicBuildingId(1)),
    ).toHaveLength(1)
    expect(
      api.registry.getFloorsByBuildingId(toClassicBuildingId(1)),
    ).toHaveLength(1)
    expect(api.registry.getAreasByFloorId(toClassicFloorId(10))).toHaveLength(1)
    expect(api.registry.getDevicesByAreaId(toClassicAreaId(100))).toHaveLength(
      1,
    )

    const device = api.registry.devices.getById(1001)

    expect(device).toBeDefined()
    expect(defined(device).name).toBe('AC unit')
    expect(defined(device).type).toBe(ClassicDeviceType.Ata)

    // Inline snapshot on the registry summary after initial sync.
    // Captures building → floor → area → device hierarchy shape
    // without being brittle on device-data fields.
    expect(
      api.registry.getBuildings().map(({ floors, name }) => ({
        floors: floors.map(({ areas, name: floorName }) => ({
          areas: areas.map(({ devices, name: areaName }) => ({
            devices: devices.map(({ name: deviceName }) => deviceName),
            name: areaName,
          })),
          name: floorName,
        })),
        name,
      })),
    ).toMatchInlineSnapshot(`
      [
        {
          "floors": [
            {
              "areas": [
                {
                  "devices": [
                    "AC unit",
                  ],
                  "name": "Living room",
                },
              ],
              "name": "Ground floor",
            },
          ],
          "name": "Home",
        },
      ]
    `)
  })

  it('facadeManager works with registry populated by ClassicAPI', async () => {
    const api = await melCloudApi.create({
      syncIntervalMinutes: false,
      transport: mockHttpClient,
    })
    const manager = new ClassicFacadeManager(api, api.registry)

    const building = defined(api.registry.buildings.getById(1))
    const facade = manager.get(building)

    expect(facade.name).toBe('Home')
    expect(facade.devices).toHaveLength(1)
    expect(defined(facade.devices[0]).name).toBe('AC unit')
  })

  it('authenticate → fetch → registry reflects updated data', async () => {
    mockRequest.mockResolvedValue({ data: [], headers: {}, status: 200 })
    const api = await melCloudApi.create({
      syncIntervalMinutes: false,
      transport: mockHttpClient,
    })

    expect(api.registry.getDevices()).toHaveLength(0)

    // Simulate authentication returning login data, then fetch returns buildings
    mockRequest.mockImplementation(async (config) => {
      await Promise.resolve()
      if (config.url === '/Login/ClientLogin3') {
        return {
          data: {
            LoginData: {
              ContextKey: 'ctx-123',
              Expiry: '2099-12-31T00:00:00',
            },
          },
          headers: {},
          status: 200,
        }
      }
      return { data: buildingResponse, headers: {}, status: 200 }
    })

    await api.authenticate({ password: 'pass', username: 'user@test.com' })

    // Registry should now be populated after the post-auth fetch
    expect(api.registry.getDevices()).toHaveLength(1)
    expect(defined(api.registry.buildings.getById(1)).name).toBe('Home')
  })

  it('settingManager persists credentials across ClassicAPI operations', async () => {
    const { setSpy, settingManager } = createSettingStore()

    mockRequest.mockImplementation(async (config) => {
      await Promise.resolve()
      if (config.url === '/Login/ClientLogin3') {
        return {
          data: {
            LoginData: {
              ContextKey: 'ctx-abc',
              Expiry: '2099-12-31T00:00:00',
            },
          },
          headers: {},
          status: 200,
        }
      }
      return { data: buildingResponse, headers: {}, status: 200 }
    })

    const api = await melCloudApi.create({
      settingManager,
      syncIntervalMinutes: false,
      transport: mockHttpClient,
    })

    await api.authenticate({ password: 'secret', username: 'me@test.com' })

    // Verify credentials were persisted
    expect(setSpy).toHaveBeenCalledWith('username', 'me@test.com')
    expect(setSpy).toHaveBeenCalledWith('password', 'secret')
    expect(setSpy).toHaveBeenCalledWith('contextKey', 'ctx-abc')
    expect(setSpy).toHaveBeenCalledWith('expiry', '2099-12-31T00:00:00')
  })

  it('re-sync replaces registry data', async () => {
    const api = await melCloudApi.create({
      syncIntervalMinutes: false,
      transport: mockHttpClient,
    })

    expect(api.registry.getDevices()).toHaveLength(1)

    // Next fetch returns empty buildings
    mockRequest.mockResolvedValue({ data: [], headers: {}, status: 200 })
    await api.fetch()

    expect(api.registry.getDevices()).toHaveLength(0)
    expect(
      api.registry.getFloorsByBuildingId(toClassicBuildingId(1)),
    ).toHaveLength(0)
  })

  it('events.onSyncComplete is invoked after fetch', async () => {
    const onSyncComplete = vi.fn<SyncCallback>()
    await melCloudApi.create({
      events: { onSyncComplete },
      syncIntervalMinutes: false,
      transport: mockHttpClient,
    })

    expect(onSyncComplete).toHaveBeenCalledWith(expect.objectContaining({}))
  })

  // End-to-end cascade: zone-level writes (frost protection / holiday
  // mode) return envelopes with no device payload — we rely on
  // `@classicFetchDevices({ when: 'after' })` to trigger `api.fetch()`
  // post-mutation, which in turn fires `events.onSyncComplete` via its
  // own `@syncDevices()` wrap. This test closes that wiring end-to-end
  // at the ClassicAPI level, since unit-level facade tests use a mock
  // adapter where the cascade can't be observed.
  it('facade.updateFrostProtection cascades to onSyncComplete via api.fetch', async () => {
    const onSyncComplete = vi.fn<SyncCallback>()
    const api = await melCloudApi.create({
      events: { onSyncComplete },
      syncIntervalMinutes: false,
      transport: mockHttpClient,
    })
    const manager = new ClassicFacadeManager(api, api.registry)
    const building = manager.get(defined(api.registry.buildings.getById(1)))

    mockRequest.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/require-await -- vitest mockImplementation signature requires async
      async (config) =>
        config.url === '/FrostProtection/Update' ?
          cast({
            data: { AttributeErrors: null, Success: true },
            headers: {},
            status: 200,
          })
        : cast({ data: buildingResponse, headers: {}, status: 200 }),
    )
    onSyncComplete.mockClear()

    await building.updateFrostProtection({ max: 14, min: 6 })

    expect(onSyncComplete).toHaveBeenCalledWith(expect.objectContaining({}))
  })

  // End-to-end resilience: exercises the `withRetryBackoff` wrapper
  // around `list()` (the classic heartbeat) to confirm a transient
  // 5xx is recovered without the consumer seeing it.
  describe('resilience end-to-end', () => {
    it('recovers from a transient 503 on fetch via exponential backoff', async () => {
      const api = await melCloudApi.create({
        syncIntervalMinutes: false,
        transport: mockHttpClient,
      })
      mockRequest.mockClear()
      mockRequest
        .mockRejectedValueOnce(transientError(503))
        .mockResolvedValueOnce({
          data: buildingResponse,
          headers: {},
          status: 200,
        })

      const fetchPromise = api.fetch()
      await vi.advanceTimersByTimeAsync(2000)
      const buildings = await fetchPromise

      expect(buildings).toHaveLength(1)
      expect(mockRequest).toHaveBeenCalledTimes(2)
      expect(api.registry.getDevices()).toHaveLength(1)
    })

    it('gives up after exhausting the 5xx retry budget and returns empty data', async () => {
      const api = await melCloudApi.create({
        syncIntervalMinutes: false,
        transport: mockHttpClient,
      })
      mockRequest.mockClear()
      mockRequest
        .mockRejectedValueOnce(transientError(502))
        .mockRejectedValueOnce(transientError(503))
        .mockRejectedValueOnce(transientError(504))
        .mockRejectedValueOnce(transientError(502))
        .mockRejectedValueOnce(transientError(503))

      const fetchPromise = api.fetch()
      await vi.advanceTimersByTimeAsync(60_000)
      const buildings = await fetchPromise

      // `fetch()` catches the final rejection and returns `[]` so the
      // Homey app's sync loop keeps running through an outage — the
      // registry just reflects what was last known.
      expect(buildings).toStrictEqual([])
      // 1 initial attempt + 4 retries = 5 total.
      expect(mockRequest).toHaveBeenCalledTimes(5)
    })

    // 429 closes the rate-limit gate for the duration signalled by
    // `Retry-After`, so subsequent requests fail fast with
    // `RateLimitError` from the gate check — no HTTP call is issued.
    it('rate-limit 429 closes the gate and short-circuits the next request', async () => {
      const rateLimitError = new HttpError(
        'Status 429',
        { data: {}, headers: { 'retry-after': '60' }, status: 429 },
        { url: '/User/ListDevices' },
      )
      mockRequest.mockRejectedValue(rateLimitError)
      const api = await melCloudApi.create({
        syncIntervalMinutes: false,
        transport: mockHttpClient,
      })

      // First fetch swallows the 429 (graceful degradation) and records the gate.
      expect(api.registry.getDevices()).toHaveLength(0)
      expect(api.isRateLimited).toBe(true)

      mockRequest.mockClear()

      // Second fetch short-circuits via the rate-limit gate: no HTTP call is made.
      const buildings = await api.fetch()

      expect(buildings).toStrictEqual([])
      expect(mockRequest).not.toHaveBeenCalled()

      // A non-fetch() method that doesn't swallow errors surfaces the
      // gate's RateLimitError directly, proving the gate is closed.
      await expect(
        api.getHolidayMode({ params: { id: 1, tableName: 'ClassicBuilding' } }),
      ).rejects.toBeInstanceOf(RateLimitError)
      expect(mockRequest).not.toHaveBeenCalled()
    })

    it('propagates AbortSignal end-to-end to the HTTP client', async () => {
      const controller = new AbortController()
      mockRequest.mockImplementation(async (config) => {
        await Promise.resolve()
        if (config.signal?.aborted === true) {
          throw new DOMException('The operation was aborted.', 'AbortError')
        }
        return { data: buildingResponse, headers: {}, status: 200 }
      })
      const api = await melCloudApi.create({
        abortSignal: controller.signal,
        syncIntervalMinutes: false,
        transport: mockHttpClient,
      })

      // Verify the initial sync carried the caller-provided signal.
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ signal: controller.signal }),
      )

      // After aborting, fetch() swallows the AbortError (like any other
      // failure) but the underlying request still received the aborted
      // signal — proving the signal is wired through to the HTTP layer.
      controller.abort()
      mockRequest.mockClear()
      const buildings = await api.fetch()

      expect(buildings).toStrictEqual([])

      const abortedCall = mockRequest.mock.calls.find(
        ([config]) => config.signal?.aborted === true,
      )

      expect(abortedCall).toBeDefined()
      expect(abortedCall?.[0].signal).toBe(controller.signal)

      // A non-fetch() method surfaces the AbortError so the DOMException
      // /abort/i name check is exercised end-to-end.
      await expect(
        api.getHolidayMode({ params: { id: 1, tableName: 'ClassicBuilding' } }),
      ).rejects.toThrow(/abort/iu)
    })
  })

  // HomeAPI lifecycle covers token-based session handling: reusing a
  // valid persisted session and refreshing an expired access token.
  describe('home api session lifecycle', () => {
    const homeContext: HomeContext = {
      buildings: [],
      country: 'FR',
      email: 'user@test.com',
      firstname: 'Test',
      guestBuildings: [],
      id: 'user-1',
      language: 'fr',
      lastname: 'User',
    }

    const mockFetch = vi.fn<typeof fetch>()

    beforeEach(() => {
      vi.unstubAllGlobals()
      vi.stubGlobal('fetch', mockFetch)
      mockFetch.mockReset()
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('reuses a valid persisted session without triggering OIDC', async () => {
      const futureExpiry = new Date(Date.now() + MS_PER_HOUR).toISOString()
      const { settingManager } = createSettingStore({
        accessToken: 'valid',
        expiry: futureExpiry,
        refreshToken: 'refresh',
      })
      // Switch back to real timers so luxon's session-expiry math works.
      vi.useRealTimers()
      mockRequest.mockReset()
      mockRequest.mockResolvedValueOnce({
        data: homeContext,
        headers: {},
        status: 200,
      })

      const { HomeAPI: melCloudHomeApi } = await import('../../src/api/home.ts')
      const api: HomeAPI = await melCloudHomeApi.create({
        settingManager,
        syncIntervalMinutes: false,
        transport: mockHttpClient,
      })

      // Only GET /context — no /connect/par, no /connect/token.
      expect(mockRequest).toHaveBeenCalledTimes(1)
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/context' }),
      )
      expect(mockFetch).not.toHaveBeenCalled()
      expect(api.isAuthenticated()).toBe(true)
      expect(api.user).toStrictEqual({
        email: 'user@test.com',
        firstName: 'Test',
        lastName: 'User',
        sub: 'user-1',
      })
    })

    it('refreshes an expired access token and persists the new tokens', async () => {
      const pastExpiry = new Date(Date.now() - MS_PER_HOUR).toISOString()
      const { setSpy, settingManager } = createSettingStore({
        accessToken: 'expired',
        expiry: pastExpiry,
        refreshToken: 'refresh',
      })
      // Real timers so luxon sees the actually-past expiry.
      vi.useRealTimers()
      mockRequest.mockReset()

      // ensureSession() sees the expired token, calls refreshAccessToken
      // (via global fetch) which succeeds, stores the new tokens, and
      // then dispatches GET /context with the refreshed Bearer.
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse({
          access_token: 'fresh-access',
          expires_in: 3600,
          refresh_token: 'fresh-refresh',
          scope: 'openid',
          token_type: 'Bearer',
        }),
      )
      mockRequest.mockResolvedValueOnce({
        data: homeContext,
        headers: {},
        status: 200,
      })

      const { HomeAPI: melCloudHomeApi } = await import('../../src/api/home.ts')
      const api: HomeAPI = await melCloudHomeApi.create({
        settingManager,
        syncIntervalMinutes: false,
        transport: mockHttpClient,
      })

      // Refresh endpoint called exactly once, then /context succeeds.
      expect(mockFetch).toHaveBeenCalledTimes(1)

      const refreshUrl = mockFetch.mock.calls[0]?.[0]

      expect(typeof refreshUrl === 'string' ? refreshUrl : '').toContain(
        '/connect/token',
      )
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/context' }),
      )

      // Dispatch carried the fresh access token.
      const lastCall = mockRequest.mock.calls.at(-1)
      const lastHeaders = lastCall?.[0].headers ?? {}

      expect(lastHeaders['Authorization']).toBe('Bearer fresh-access')
      // New tokens persisted via settingManager.set.
      expect(setSpy).toHaveBeenCalledWith('accessToken', 'fresh-access')
      expect(setSpy).toHaveBeenCalledWith('refreshToken', 'fresh-refresh')
      expect(api.isAuthenticated()).toBe(true)
    })
  })
})
