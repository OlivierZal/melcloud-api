import type { HomeRegistry } from '../entities/home-registry.ts'
import type {
  HomeAtaValues,
  HomeBuilding,
  HomeEnergyData,
  HomeErrorLogEntry,
  HomeReportData,
  HomeResult,
  HomeUser,
  LoginCredentials,
} from '../types/index.ts'
import type { BaseAPIConfig } from './types.ts'

/**
 * Injectable contract for the MELCloud Home API client.
 *
 * Exists alongside the `HomeAPI` class with the same name (declaration
 * merging). This interface uses property-with-arrow syntax so facades,
 * mocks, and tests can reference methods safely (`expect(api.updateValues)`,
 * `mock<HomeAPI>({...})`) without triggering `unbound-method` lint —
 * the class has real methods that carry `this`, whereas the interface
 * shape declares them as plain functions with no implicit binding.
 */
export interface HomeAPI {
  /**
   * Whether the upstream rate-limit gate is currently holding a pause
   * window. `true` means the SDK is intentionally failing fast to
   * honor an upstream 429 `Retry-After`.
   */
  readonly isRateLimited: boolean
  /** ClassicDevice registry with stable model references across syncs. */
  readonly registry: HomeRegistry
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
  /** Fetch energy consumption data for a device. */
  readonly getEnergy: (
    id: string,
    params: { from: string; interval: string; to: string },
  ) => Promise<HomeResult<HomeEnergyData>>
  /** Fetch the error log for a device. */
  readonly getErrorLog: (id: string) => Promise<HomeResult<HomeErrorLogEntry[]>>
  /** Fetch WiFi signal strength (RSSI) telemetry for a device. */
  readonly getSignal: (
    id: string,
    params: { from: string; to: string },
  ) => Promise<HomeResult<HomeEnergyData>>
  /** Fetch temperature trend summary for a device. */
  readonly getTemperatures: (
    id: string,
    params: { from: string; period: string; to: string },
  ) => Promise<HomeResult<HomeReportData[]>>
  /** Fetch the current user's claims from the BFF. Returns `null` on failure. */
  readonly getUser: () => Promise<HomeUser | null>
  /** Whether a user is currently authenticated (session cookie valid). */
  readonly isAuthenticated: () => boolean
  /** Fetch all buildings and sync the device registry. */
  readonly list: () => Promise<HomeBuilding[]>
  /**
   * Best-effort session restore from persisted credentials. Never
   * throws — returns `false` when no credentials are persisted or
   * sign-in fails (logged via the SDK logger).
   */
  readonly resumeSession: () => Promise<boolean>
  /** Update the automatic sync interval and reschedule. Pass `false` to disable. */
  readonly setSyncInterval: (minutes: number | false) => void
  /** Update device values and refresh device data via list(). */
  readonly updateValues: (id: string, values: HomeAtaValues) => Promise<boolean>
}

/** Configuration options for the MELCloud Home API. */
export interface HomeAPIConfig extends BaseAPIConfig {
  /** Base URL of the MELCloud Home BFF server. */
  readonly baseURL?: string
}

/** Persistent settings managed by the Home API for session authentication. */
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
