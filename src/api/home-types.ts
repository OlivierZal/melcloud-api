import type { HomeRegistry } from '../entities/home-registry.ts'
import type {
  HomeAtaValues,
  HomeAtwValues,
  HomeBuilding,
  HomeEnergyData,
  HomeErrorLogEntry,
  HomeFrostProtectionPostData,
  HomeHolidayModePostData,
  HomeOverheatProtectionPostData,
  HomeReportData,
  HomeUser,
  Result,
} from '../types/index.ts'
import type { BaseAPIAdapter, BaseAPIConfig, BaseAPISettings } from './types.ts'

/**
 * Injectable contract for the MELCloud Home API client.
 *
 * Mirrors the public surface of the {@link HomeAPI} class with
 * property-with-arrow syntax so facades, mocks, and tests can
 * reference methods safely (`expect(api.updateValues)`,
 * `mock<HomeAPIAdapter>({...})`) without triggering `unbound-method`
 * lint — the class has real methods that carry `this`, whereas this
 * interface declares them as plain functions with no implicit
 * binding.
 *
 * Per-unit endpoints share one verb per concept (`updateValues`,
 * `getEnergy`, `getErrorLog`, `getTemperatures`); the registry model's
 * connection type routes the wire path, so callers never pick an
 * ATA/ATW variant — `getAtwInternalTemperatures` is the one
 * deliberate exception (no ATA counterpart exists).
 * @category Configuration
 */
export interface HomeAPIAdapter extends BaseAPIAdapter {
  /** Home device registry with stable model references across syncs. */
  readonly registry: HomeRegistry
  /** The currently authenticated user, or `null`. */
  readonly user: HomeUser | null
  /** Fetch all buildings and sync the device registry — the heartbeat, mirroring Classic `fetch()`. */
  readonly fetch: () => Promise<HomeBuilding[]>
  /** Fetch the internal-temperatures report (flow/return/tank/zone) for an ATW unit. */
  readonly getAtwInternalTemperatures: (
    id: string,
    params: { from: string; period: string; to: string },
  ) => Promise<Result<HomeReportData[]>>
  /** Fetch energy telemetry for a unit; the registry's connection type selects the measure family. */
  readonly getEnergy: (
    id: string,
    params: {
      from: string
      interval: string
      to: string
      measure?: 'consumed' | 'produced'
    },
  ) => Promise<Result<HomeEnergyData>>
  /** Fetch the error log for a unit; the registry's connection type selects the unit path. */
  readonly getErrorLog: (id: string) => Promise<Result<HomeErrorLogEntry[]>>
  /** Fetch WiFi signal strength (RSSI) telemetry for a device. */
  readonly getSignal: (
    id: string,
    params: { from: string; to: string },
  ) => Promise<Result<HomeEnergyData>>
  /** Fetch the temperature report for a unit; the registry's connection type selects the endpoint. */
  readonly getTemperatures: (
    id: string,
    params: { from: string; period: string; to: string },
  ) => Promise<Result<HomeReportData[]>>
  /** Fetch the current user's claims from the BFF. Returns `null` on failure. */
  readonly getUser: () => Promise<HomeUser | null>
  /** Whether a user is currently authenticated (session cookie valid). */
  /** Update the automatic sync interval and reschedule. Pass `false` to disable. */
  /** Batch frost-protection write (device ids grouped in `units`), then refresh. */
  readonly updateFrostProtection: (
    postData: HomeFrostProtectionPostData,
  ) => Promise<void>
  /** Batch holiday-mode write (device ids grouped in `units`), then refresh. */
  readonly updateHolidayMode: (
    postData: HomeHolidayModePostData,
  ) => Promise<void>
  /** Batch overheat-protection write (ATA-only feature), then refresh. */
  readonly updateOverheatProtection: (
    postData: HomeOverheatProtectionPostData,
  ) => Promise<void>
  /** Push a setpoint update (wire path from the registry's connection type), then refresh. */
  readonly updateValues: (
    id: string,
    values: HomeAtaValues | HomeAtwValues,
  ) => Promise<void>
}

/**
 * Configuration options for the MELCloud Home API.
 * @category Configuration
 */
export interface HomeAPIConfig extends BaseAPIConfig {
  /** Base URL of the MELCloud Home BFF server. */
  readonly baseURL?: string | undefined
  /**
   * BCP-47 locale tag for report chart labels (dates, times).
   * Defaults to the runtime locale when unset.
   */
  readonly locale?: string | undefined
  /**
   * IANA timezone identifier (e.g. `'Europe/Paris'`) used to render
   * chart labels and resolve day/hour windows. The Home wire speaks
   * UTC wall-clock (live-probed 2026-07-18); this timezone only
   * affects local presentation. Defaults to UTC when unset.
   */
  readonly timezone?: string | undefined
}

/**
 * Persistent settings managed by the Home API for session authentication.
 * @category Configuration
 */
export interface HomeAPISettings extends BaseAPISettings {
  /** IdentityServer access token (Bearer). */
  readonly accessToken?: string | null
  /** IdentityServer refresh token. */
  readonly refreshToken?: string | null
}
