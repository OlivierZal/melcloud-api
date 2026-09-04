import { vi } from 'vitest'

import type { HomeAPIAdapter } from '../src/api/home-types.ts'
import type {
  HomeRegistry,
  TypedHomeDeviceData,
} from '../src/entities/home-registry.ts'
import type {
  HomeAtaDeviceCapabilities,
  HomeAtaDeviceData,
  HomeAtwDeviceCapabilities,
  HomeAtwDeviceData,
  HomeBuilding,
  HomeBuildingRef,
  HomeContext,
  HomeEnergyData,
  HomeEnergyPoint,
  HomeFrostProtection,
  HomeHolidayMode,
  HomeOverheatProtection,
  HomeReportPoint,
} from '../src/types/index.ts'
import { HomeDeviceType } from '../src/constants.ts'
import { HomeDevice } from '../src/entities/home-device.ts'
import { cast, mock, mockFetchResponse } from './helpers.ts'

// Mid-range RSSI so derived signal-quality assertions land in a
// predictable band without special-casing weak/strong values.
const DEFAULT_RSSI_DBM = -50

// Realistic defaults so every operation mode resolves to a non-empty range.
export const defaultHomeAtaCapabilities: HomeAtaDeviceCapabilities = {
  hasAirDirection: true,
  hasAutomaticFanSpeed: true,
  hasAutoOperationMode: true,
  hasCoolOperationMode: true,
  hasDemandSideControl: true,
  hasDryOperationMode: true,
  hasEnergyConsumedMeter: true,
  hasExtendedTemperatureRange: true,
  hasHalfDegreeIncrements: true,
  hasHeatOperationMode: true,
  hasStandby: true,
  hasSwing: true,
  isLegacyDevice: false,
  isMultiSplitSystem: false,
  maxTempAutomatic: 31,
  maxTempCoolDry: 31,
  maxTempHeat: 31,
  minTempAutomatic: 16,
  minTempCoolDry: 16,
  minTempHeat: 10,
  numberOfFanSpeeds: 5,
  supportsWideVane: false,
}

const homeDeviceCapabilities = (
  overrides: Partial<HomeAtaDeviceCapabilities> = {},
): HomeAtaDeviceCapabilities => ({
  ...defaultHomeAtaCapabilities,
  ...overrides,
})

// Convert a `Record<string, string>` to the BFF's `{ name, value }[]`
// shape so call sites can express settings as plain string maps.
const buildSettings = (
  settings: Record<string, string>,
): HomeAtaDeviceData['settings'] =>
  Object.entries(settings).map(([name, value]) => ({ name, value }))

export interface HomeDeviceDataOverrides {
  readonly capabilities?: Partial<HomeAtaDeviceCapabilities>
  readonly frostProtection?: HomeFrostProtection | null
  readonly holidayMode?: HomeHolidayMode | null
  readonly id?: string
  readonly isConnected?: boolean
  readonly name?: string
  readonly overheatProtection?: HomeOverheatProtection | null
  readonly rssi?: number
  readonly settings?: Record<string, string>
}

const homeDeviceData = (
  overrides: HomeDeviceDataOverrides = {},
): HomeAtaDeviceData =>
  mock<HomeAtaDeviceData>({
    capabilities: homeDeviceCapabilities(overrides.capabilities),
    frostProtection: overrides.frostProtection ?? null,
    givenDisplayName: overrides.name ?? 'Home device',
    holidayMode: overrides.holidayMode ?? null,
    id: overrides.id ?? 'home-device-1',
    isConnected: overrides.isConnected ?? true,
    overheatProtection: overrides.overheatProtection ?? null,
    rssi: overrides.rssi ?? DEFAULT_RSSI_DBM,
    settings: buildSettings(overrides.settings ?? {}),
  })

export const homeBuildingRef = (
  overrides: Partial<HomeBuildingRef> = {},
): HomeBuildingRef => ({
  id: overrides.id ?? 'home-building-1',
  name: overrides.name ?? 'Home Building',
})

interface HomeDeviceFixtureOptions {
  building?: HomeBuildingRef
  isOwner?: boolean
}

// Facades resolve their model by id through `api.registry` on every
// access, so device fixtures self-register here and test API mocks
// plug this in as their registry (last-created wins per id, matching
// the facade-under-test's own device).
const registeredHomeDevices = new Map<string, HomeDevice>()

// Vitest isolates module state per FILE; within a file, entries would
// otherwise accumulate across tests and an id reused by a later test
// could resolve an earlier test's device. Every consumer builds its
// devices inside test bodies and opens its describe with
// `beforeEach(resetHomeDevices)`, keeping each test's registrations to
// itself.
export const resetHomeDevices = (): void => {
  registeredHomeDevices.clear()
}

// Fixture-side control: drop a registered device so availability tests
// can model a pruned id — pruning is the fixture's affair, not part of
// the registry surface the facades consume.
export const pruneHomeDevice = (id: string): boolean =>
  registeredHomeDevices.delete(id)

// The double implements exactly the resolution slice the facades under
// test exercise (`getById`); the `cast` is this module's single
// widening boundary to the adapter's `HomeRegistry` — extend the
// double rather than widening a call site.
const homeTestRegistry: HomeRegistry = cast({
  getById: (id: string): HomeDevice | undefined =>
    registeredHomeDevices.get(id),
})

const registerHomeDevice = <T extends HomeDevice>(device: T): T => {
  registeredHomeDevices.set(device.id, device)
  return device
}

// ATA-shaped payloads carry the ATA type tag by construction; ATW entries
// come from the dedicated creators below so fixtures stay representative.
export const homeDevice = (
  overrides: HomeDeviceDataOverrides = {},
  options: HomeDeviceFixtureOptions = {},
): HomeDevice<HomeAtaDeviceData> =>
  registerHomeDevice(
    new HomeDevice({
      building: options.building ?? homeBuildingRef(),
      device: homeDeviceData(overrides),
      isOwner: options.isOwner ?? true,
      type: HomeDeviceType.Ata,
    }),
  )

export const typedHomeDeviceData = (
  overrides: HomeDeviceDataOverrides = {},
  options: HomeDeviceFixtureOptions = {},
): TypedHomeDeviceData => ({
  building: options.building ?? homeBuildingRef(),
  device: homeDeviceData(overrides),
  isOwner: options.isOwner ?? true,
  type: HomeDeviceType.Ata,
})

export const defaultHomeAtwCapabilities: HomeAtwDeviceCapabilities = {
  ftcModel: 3,
  hasBoiler: true,
  hasDemandSideControl: true,
  hasDualRoomTemperature: false,
  hasEstimatedEnergyConsumption: true,
  hasEstimatedEnergyProduction: true,
  hasHalfDegrees: true,
  hasHeatZone1: true,
  hasHeatZone2: false,
  hasHotWater: true,
  hasMeasuredEnergyConsumption: false,
  hasMeasuredEnergyProduction: false,
  hasThermostatZone1: true,
  hasThermostatZone2: false,
  hasWirelessRemote: true,
  hasZone2: false,
  immersionHeaterCapacity: 0,
  maxHeatOutput: 0,
  maxImportPower: 0,
  maxSetTankTemperature: 60,
  maxSetTemperature: 30,
  minSetTankTemperature: 40,
  minSetTemperature: 10,
  refridgerentAddress: 0,
  temperatureIncrement: 0.5,
  temperatureIncrementOverride: '2',
  temperatureUnit: '',
}

export interface HomeAtwDeviceDataOverrides {
  readonly capabilities?: Partial<HomeAtwDeviceCapabilities>
  readonly frostProtection?: HomeFrostProtection | null
  readonly holidayMode?: HomeHolidayMode | null
  readonly id?: string
  readonly isConnected?: boolean
  readonly name?: string
  readonly rssi?: number
  readonly settings?: Record<string, string>
}

export const homeAtwDeviceData = (
  overrides: HomeAtwDeviceDataOverrides = {},
): HomeAtwDeviceData =>
  mock<HomeAtwDeviceData>({
    capabilities: { ...defaultHomeAtwCapabilities, ...overrides.capabilities },
    // The wire always carries these keys (the schema requires them,
    // nullable but present), so the fixture must too: an absent key is a
    // shape the BFF cannot produce and the salvage pass would drop.
    frostProtection: overrides.frostProtection ?? null,
    givenDisplayName: overrides.name ?? 'Home ATW device',
    holidayMode: overrides.holidayMode ?? null,
    id: overrides.id ?? 'home-atw-1',
    isConnected: overrides.isConnected ?? true,
    overheatProtection: null,
    rssi: overrides.rssi ?? DEFAULT_RSSI_DBM,
    settings: buildSettings(overrides.settings ?? {}),
  })

export const homeAtwDevice = (
  overrides: HomeAtwDeviceDataOverrides = {},
  isOwner = true,
  building: HomeBuildingRef = homeBuildingRef(),
): HomeDevice<HomeAtwDeviceData> =>
  registerHomeDevice(
    new HomeDevice({
      building,
      device: homeAtwDeviceData(overrides),
      isOwner,
      type: HomeDeviceType.Atw,
    }),
  )

export const typedHomeAtwDeviceData = (
  overrides: HomeAtwDeviceDataOverrides = {},
  options: HomeDeviceFixtureOptions = {},
): TypedHomeDeviceData => ({
  building: options.building ?? homeBuildingRef(),
  device: homeAtwDeviceData(overrides),
  isOwner: options.isOwner ?? true,
  type: HomeDeviceType.Atw,
})

/**
 * One `(x, y)` report sample in the wire's single-letter point shape.
 * @param time - Sample timestamp (UTC wall-clock ISO).
 * @param value - Sample value.
 * @returns The wire-shaped point.
 */
export const homeReportPoint = (
  time: string,
  value: number,
): HomeReportPoint => ({
  /* eslint-disable id-length -- match the wire point shape */
  x: time,
  y: value,
  /* eslint-enable id-length */
})

/**
 * Wrap one measure series into the telemetry wire envelope
 * (`{ measureData: [{ type, values }] }`) shared by the energy and
 * signal endpoints.
 * @param type - Wire measure name (e.g. `rssi`, `interval_energy_consumed`).
 * @param values - Time-stamped wire samples of the series.
 * @returns The wire-shaped envelope.
 */
export const homeEnergyEnvelope = (
  type: string,
  values: readonly HomeEnergyPoint[],
): HomeEnergyData => ({ measureData: [{ type, values: [...values] }] })

// Every adapter call stubbed and the shared test registry plugged in;
// overrides spread last so call sites can replace any of them.
export const createMockHomeApi = (
  overrides: Partial<HomeAPIAdapter> = {},
): HomeAPIAdapter =>
  mock<HomeAPIAdapter>({
    getAtwInternalTemperatures:
      vi.fn<HomeAPIAdapter['getAtwInternalTemperatures']>(),
    getEnergy: vi.fn<HomeAPIAdapter['getEnergy']>(),
    getErrorLog: vi.fn<HomeAPIAdapter['getErrorLog']>(),
    getSignal: vi.fn<HomeAPIAdapter['getSignal']>(),
    getTemperatures: vi.fn<HomeAPIAdapter['getTemperatures']>(),
    registry: homeTestRegistry,
    updateFrostProtection: vi.fn<HomeAPIAdapter['updateFrostProtection']>(),
    updateHolidayMode: vi.fn<HomeAPIAdapter['updateHolidayMode']>(),
    updateOverheatProtection:
      vi.fn<HomeAPIAdapter['updateOverheatProtection']>(),
    updateValues: vi.fn<HomeAPIAdapter['updateValues']>().mockResolvedValue(),
    ...overrides,
  })

// ---------------------------------------------------------------------------
// `/context` wire fixtures — the payload the BFF answers, as opposed to the
// entity-level doubles above. Shared by `home-api.test.ts` (which drives the
// dialect end to end) and the cross-dialect session-lifecycle kernel.
// ---------------------------------------------------------------------------

// The context payload declares slightly different capabilities from the
// entity defaults (whole-degree steps, a narrower automatic range, no hot
// water): stated as deltas so the two fixtures cannot drift apart on the
// two dozen fields they share.
const contextAtaCapabilities: HomeAtaDeviceCapabilities = {
  ...defaultHomeAtaCapabilities,
  hasHalfDegreeIncrements: false,
  maxTempAutomatic: 30,
  maxTempCoolDry: 30,
  maxTempHeat: 30,
  minTempAutomatic: 10,
  minTempCoolDry: 10,
}

const contextAtwCapabilities: HomeAtwDeviceCapabilities = {
  ...defaultHomeAtwCapabilities,
  hasHotWater: false,
}

// The fields the schema requires of every unit, whatever its type.
const contextDeviceFields = {
  displayIcon: 'Office',
  frostProtection: null,
  holidayMode: null,
  isConnected: true,
  isInError: false,
  overheatProtection: null,
  schedule: [],
  scheduleEnabled: false,
  timeZone: 'Europe/Paris',
} as const

export const homeContextBuilding: HomeBuilding = {
  airToAirUnits: [
    {
      ...contextDeviceFields,
      capabilities: contextAtaCapabilities,
      connectedInterfaceIdentifier: 'FE0000060403388D3DFFFE000000000000',
      connectedInterfaceType: 'fourthGenWifi',
      givenDisplayName: 'Test ClassicDevice',
      id: 'device-1',
      rssi: -50,
      settings: [{ name: 'Power', value: 'True' }],
      systemId: null,
      unitSettings: null,
    },
  ],
  airToWaterUnits: [
    {
      ...contextDeviceFields,
      capabilities: contextAtwCapabilities,
      ftcModel: 'ftC6',
      givenDisplayName: 'ATW ClassicDevice',
      id: 'device-2',
      macAddress: 'FE0000060403388D3DFFFE000000000001',
      rssi: -55,
      settings: [],
    },
  ],
  id: 'building-1',
  name: 'Home',
  timezone: 'Europe/Paris',
}

/**
 * The `/context` payload. Devices land in `guestBuildings` by default —
 * the registry then tags them as shared; pass `buildings` to model an
 * owned home.
 * @param overrides - Fields to replace on the default payload.
 * @returns The wire-shaped context.
 */
export const homeContextData = (
  overrides: Partial<HomeContext> = {},
): HomeContext => ({
  buildings: [],
  country: 'FR',
  email: 'test@example.com',
  firstname: 'Test',
  guestBuildings: [homeContextBuilding],
  id: 'user-1',
  language: 'fr',
  lastname: 'User',
  numberOfBuildingsAllowed: 2,
  numberOfDevicesAllowed: 10,
  numberOfGuestDevicesAllowed: 10,
  numberOfGuestUsersAllowedPerUnit: 5,
  scenes: [],
  ...overrides,
})

// ---------------------------------------------------------------------------
// OIDC staging — the token-auth module speaks to the global `fetch`, not to
// the BFF HttpClient, so the sign-in dance is scripted on a `fetch` double.
// ---------------------------------------------------------------------------

export const homeTokenResponse = {
  access_token: 'test-access-token',
  expires_in: 3600,
  id_token: 'test-id-token',
  refresh_token: 'test-refresh-token',
  scope: 'openid profile email offline_access IdentityServerApi',
  token_type: 'Bearer',
}

/**
 * The Cognito credential form, as the hosted login page serves it.
 * @param action - Form action the credential POST targets.
 * @param csrf - Hidden `_csrf` token the form carries.
 * @returns The HTML page body.
 */
export const homeCognitoLoginPage = (
  action = '/login?client_id=test&amp;state=abc',
  csrf = 'csrf-token',
): string =>
  `<form action="${action}" method="POST">` +
  `<input type="hidden" name="_csrf" value="${csrf}"/>` +
  '<input type="hidden" name="cognitoAsfData" value=""/>' +
  '</form>'

/**
 * Queue the scripted OIDC dance on a `fetch` double, up to (and
 * excluding) the token exchange. Order matches the runtime flow: PAR,
 * redirect chain, credential submission, callback resolution. Each
 * caller stages its own token-exchange outcome next — see
 * {@link stageHomeTokenExchange} for the accepted one.
 * @param fetchMock - The `fetch` double to queue the hops on.
 */
export const stageHomeOidcDance = (
  fetchMock: ReturnType<typeof vi.fn<typeof fetch>>,
): void => {
  const cognito = 'https://live-melcloudhome.auth.eu-west-1.amazoncognito.com'
  const authBase = 'https://auth.melcloudhome.com'
  const callbackUrl = `${authBase}/signin-oidc-meu?code=abc&state=xyz`

  fetchMock
    // 1. PAR
    .mockResolvedValueOnce(
      mockFetchResponse(
        { request_uri: 'urn:ietf:params:oauth:request_uri:test' },
        {},
        200,
      ),
    )
    // 2. Redirect chain to the Cognito login page
    .mockResolvedValueOnce(
      mockFetchResponse('', { location: `${authBase}/connect/redirect` }, 302),
    )
    .mockResolvedValueOnce(
      mockFetchResponse(
        '',
        { location: `${cognito}/oauth2/authorize?client_id=test` },
        302,
      ),
    )
    .mockResolvedValueOnce(
      mockFetchResponse(
        '',
        { location: `${cognito}/login?client_id=test` },
        302,
      ),
    )
    .mockResolvedValueOnce(mockFetchResponse(homeCognitoLoginPage(), {}, 200))
    // 3. Credential POST → 302 to the callback
    .mockResolvedValueOnce(
      mockFetchResponse('', { location: callbackUrl }, 302),
    )
    // 4. Callback chain → JS redirect page → melcloudhome://?code=...
    .mockResolvedValueOnce(
      mockFetchResponse(
        '',
        { location: `${authBase}/ExternalLogin/Callback` },
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
}

/**
 * Queue the accepted token exchange that closes the dance.
 * @param fetchMock - The `fetch` double to queue the exchange on.
 */
export const stageHomeTokenExchange = (
  fetchMock: ReturnType<typeof vi.fn<typeof fetch>>,
): void => {
  fetchMock.mockResolvedValueOnce(mockFetchResponse(homeTokenResponse, {}, 200))
}
