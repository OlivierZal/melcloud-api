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
  LoginCredentials,
  Result,
} from '../types/index.ts'
import type { BaseAPIConfig } from './types.ts'

/**
 * Injectable contract for the MELCloud Home API client.
 *
 * Mirrors the public surface of the {@link HomeAPI} class with
 * property-with-arrow syntax so facades, mocks, and tests can
 * reference methods safely (`expect(api.updateAtaValues)`,
 * `mock<HomeAPIAdapter>({...})`) without triggering `unbound-method`
 * lint — the class has real methods that carry `this`, whereas this
 * interface declares them as plain functions with no implicit
 * binding.
 *
 * Per-device-type endpoints follow a symmetric `<verb><Ata|Atw><Noun>`
 * naming convention so callers never have to guess which side of the
 * pair carries the suffix.
 * @category Configuration
 */
export interface HomeAPIAdapter {
  /**
   * Whether the upstream rate-limit gate is currently holding a pause
   * window. `true` means the SDK is intentionally failing fast to
   * honor an upstream 429 `Retry-After`.
   */
  readonly isRateLimited: boolean
  /** BCP-47 locale tag for chart labels ({@link HomeAPIConfig.locale}). */
  readonly locale: string | undefined
  /** Home device registry with stable model references across syncs. */
  readonly registry: HomeRegistry
  /** IANA timezone for chart windows ({@link HomeAPIConfig.timezone}). */
  readonly timezone: string | undefined
  /** The currently authenticated user, or `null`. */
  readonly user: HomeUser | null
  /**
   * Sign in with explicit credentials. Throws `AuthenticationError`
   * on rejection. For best-effort restore from persisted credentials,
   * use {@link resumeSession} instead.
   */
  readonly authenticate: (credentials: LoginCredentials) => Promise<void>
  /** Cancel any pending automatic sync. */
  readonly clearSync: () => void
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
  readonly isAuthenticated: () => boolean
  /**
   * Best-effort session restore from persisted credentials. Never
   * throws — returns `false` when no credentials are persisted or
   * sign-in fails (logged via the SDK logger).
   */
  readonly resumeSession: () => Promise<boolean>
  /** Update the automatic sync interval and reschedule. Pass `false` to disable. */
  readonly setSyncInterval: (minutes: number | false) => void
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
export interface HomeAPISettings {
  /** IdentityServer access token (Bearer). */
  readonly accessToken?: string | null
  /** Session expiry timestamp in ISO 8601 format. */
  readonly expiry?: string | null
  /** MELCloud Home account password. */
  readonly password?: string | null
  /** IdentityServer refresh token. */
  readonly refreshToken?: string | null
  /** MELCloud Home account username (email). */
  readonly username?: string | null
}
