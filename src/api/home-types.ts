import type { HomeRegistry } from '../entities/home-registry.ts'
import type {
  HomeAtaValues,
  HomeAtwValues,
  HomeBuilding,
  HomeEnergyData,
  HomeErrorLogEntry,
  HomeReportData,
  HomeSystemInvite,
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
 * reference methods safely (`expect(api.updateValues)`,
 * `mock<HomeAPIAdapter>({...})`) without triggering `unbound-method`
 * lint — the class has real methods that carry `this`, whereas this
 * interface declares them as plain functions with no implicit
 * binding.
 * @category Configuration
 */
export interface HomeAPIAdapter {
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
  /** Fetch the comfort-graph (room/outside/setpoint) for an ATW unit. */
  readonly getComfortGraph: (
    id: string,
    params: { from: string; period: string; to: string },
  ) => Promise<Result<HomeReportData[]>>
  /** Fetch energy consumption data for an ATA unit. */
  readonly getEnergy: (
    id: string,
    params: { from: string; interval: string; to: string },
  ) => Promise<Result<HomeEnergyData>>
  /** Fetch consumed/produced interval-energy telemetry for an ATW unit. */
  readonly getEnergyAtw: (
    id: string,
    params: {
      from: string
      interval: string
      measure: 'consumed' | 'produced'
      to: string
    },
  ) => Promise<Result<HomeEnergyData>>
  /** Fetch the error log for an ATA unit. */
  readonly getErrorLog: (id: string) => Promise<Result<HomeErrorLogEntry[]>>
  /** Fetch the error log for an ATW unit. */
  readonly getErrorLogAtw: (id: string) => Promise<Result<HomeErrorLogEntry[]>>
  /** Fetch the internal-temperatures report (flow/return/tank) for an ATW unit. */
  readonly getInternalTemperatures: (
    id: string,
    params: { from: string; period: string; to: string },
  ) => Promise<Result<HomeReportData[]>>
  /** Fetch WiFi signal strength (RSSI) telemetry for a device. */
  readonly getSignal: (
    id: string,
    params: { from: string; to: string },
  ) => Promise<Result<HomeEnergyData>>
  /** Fetch the systems shared with the authenticated user (guest invites). */
  readonly getSystemInvites: () => Promise<Result<HomeSystemInvite[]>>
  /** Fetch the trend-summary report (room/set temperature) for an ATA unit. */
  readonly getTemperatures: (
    id: string,
    params: { from: string; period: string; to: string },
  ) => Promise<Result<HomeReportData[]>>
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
  /** Push an ATW setpoint update and refresh device data via list(). */
  readonly updateAtwValues: (
    id: string,
    values: HomeAtwValues,
  ) => Promise<boolean>
  /** Push an ATA setpoint update and refresh device data via list(). */
  readonly updateValues: (id: string, values: HomeAtaValues) => Promise<boolean>
}

/**
 * Configuration options for the MELCloud Home API.
 * @category Configuration
 */
export interface HomeAPIConfig extends BaseAPIConfig {
  /** Base URL of the MELCloud Home BFF server. */
  readonly baseURL?: string
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
