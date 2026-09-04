import type { z } from 'zod'
import { SessionAPI } from '@olivierzal/api-core'

import type { RateLimitGate } from '../resilience/index.ts'
import { AuthenticationError, RateLimitError } from '../errors/index.ts'
import {
  type HttpClientConfig,
  HttpClient,
  HttpStatus,
  isHttpError,
} from '../http/index.ts'
import { redaction } from '../observability/context.ts'
import { type ApiRequestError, type Result, err, ok } from '../types/index.ts'
import { parseOrThrow } from '../validation/index.ts'
import type { BaseAPIConfig, SyncCallback } from './types.ts'

/**
 * Classify any thrown error into the discriminated {@link ApiRequestError}
 * union surfaced by {@link BaseAPI.safeRequest}.
 *
 * Order matters: domain errors ({@link AuthenticationError}, {@link RateLimitError})
 * are checked before transport errors so a credential rejection isn't
 * misclassified as a `server` failure. Zod parse failures bubble up as
 * `Error` with `name === 'ValidationError'` from {@link parseOrThrow},
 * which is detected here and reported as the `validation` variant.
 * @param error - The thrown value to classify.
 * @returns A typed {@link ApiRequestError}.
 */
export const classifyError = (error: unknown): ApiRequestError => {
  if (error instanceof Error && error.name === 'ValidationError') {
    return { cause: error, issue: error.message, kind: 'validation' }
  }
  if (error instanceof AuthenticationError) {
    return { cause: error, kind: 'unauthorized' }
  }
  if (error instanceof RateLimitError) {
    return {
      kind: 'rate-limited',
      retryAfterMs:
        error.retryAfter === null
          ? null
          : error.retryAfter.total({ unit: 'millisecond' }),
    }
  }
  if (isHttpError(error)) {
    return error.response.status === HttpStatus.Unauthorized
      ? { cause: error, kind: 'unauthorized' }
      : { cause: error, kind: 'server', status: error.response.status }
  }
  return { cause: error, kind: 'network' }
}

/**
 * Narrow a `401 Unauthorized` surfaced by the HTTP client into the
 * shared {@link AuthenticationError} domain type. Subclass
 * `doAuthenticate` implementations call this helper so callers of
 * {@link BaseAPI.authenticate} get a stable error shape regardless of
 * whether the underlying flow was cookie-based (Classic) or
 * bearer-token (Home); any other rejection yields `null` and the
 * caller rethrows its original error.
 * @param error - The error to inspect.
 * @returns An {@link AuthenticationError} for a 401 {@link HttpError}; `null` otherwise.
 */
export const normalizeUnauthorized = (
  error: unknown,
): AuthenticationError | null =>
  isHttpError(error) && error.response.status === HttpStatus.Unauthorized
    ? new AuthenticationError('MELCloud rejected the credentials', {
        cause: error,
      })
    : null

const DEFAULT_TIMEOUT_MS = 30_000

/**
 * Subclass-internal options injected into the {@link BaseAPI}
 * constructor. Distinct from {@link BaseAPIConfig} (the user-facing
 * surface) — these capture **what the subclass knows** that the user
 * doesn't pick (baseURL, rate-limit window, default sync cadence,
 * the sync runner closure).
 */
interface BaseAPIConstructorOptions {
  /**
   * Subclass default for {@link BaseAPIConfig.syncIntervalMinutes}.
   */
  defaultSyncIntervalMinutes: number | false
  /**
   * Subclass-fixed HTTP defaults (baseURL, optional dispatcher).
   */
  httpConfig: Omit<HttpClientConfig, 'timeout'>
  /**
   * Label prefixed to every log line (e.g. `[Classic]`): the two
   * clients emit identically-worded lifecycle logs ("Session resume
   * failed", "Automatic sign-ins paused"), so a host running both
   * could not tell which account a diagnostics report was about.
   */
  logLabel: string
  /**
   * Sliding-window length the rate-limit gate observes.
   */
  rateLimitHours: number
  /**
   * Sync runner the auto-timer drives.
   */
  syncCallback: () => Promise<unknown>
}

// The sync-params vocabulary this SDK instantiates the core's session
// generic with, derived from the published `SyncCallback` alias so the
// unexported `SyncParams` interface in `./types.ts` stays unexported.
type SyncParams = Exclude<Parameters<SyncCallback>[0], undefined>

/**
 * Shared infrastructure for MELCloud API clients — the thin layer over
 * `@olivierzal/api-core`'s `SessionAPI`, which owns the session
 * lifecycle and the request pipeline (persisted credentials, the
 * login-backoff gate, the logOut-epoch protocol, single-flight
 * `ensureSession`/`resumeSession`, the policy composition around every
 * request, and the sync-cycle template). What stays here is this SDK's
 * own verdicts:
 *
 * - the zod/Result boundary ({@link requestData}, {@link safeRequest},
 *   {@link classifyError}, {@link normalizeUnauthorized}) — zod is
 *   refused entry to the core;
 * - {@link ensureAuthenticated} and {@link isRateLimited} — melcloud-only
 *   surfaces, kept off the shared class by decision;
 * - the transport RESOLUTION — deciding whether a host-supplied
 *   `transport` is a usable client or a bag of build options. The
 *   `instanceof` check binds THIS repo's {@link HttpClient} subclass on
 *   purpose: it is the thin class that seats the MELCloud redaction
 *   vocabulary, so a host-prebuilt bare core client (carrying only the
 *   base sensitive keys) is discarded and rebuilt rather than adopted.
 */
export abstract class BaseAPI extends SessionAPI<SyncParams> {
  // Narrowing redeclaration, erased at runtime: the core's rate-limit
  // rung is optional (`RateLimitGate | undefined`), but every
  // construction path in this repo passes `rateLimitHours`
  // (`BaseAPIConstructorOptions` requires it), so the gate always
  // exists here and `isRateLimited` needs no unreachable branch.
  declare protected readonly rateLimitGate: RateLimitGate

  /**
   * Whether the upstream rate-limit gate is currently holding a pause
   * window after a recent 429 `Retry-After` response.
   * @returns `true` while the SDK is intentionally failing fast.
   */
  public get isRateLimited(): boolean {
    return this.rateLimitGate.isPaused
  }

  protected constructor(
    config: BaseAPIConfig,
    {
      defaultSyncIntervalMinutes,
      httpConfig,
      logLabel,
      rateLimitHours,
      syncCallback,
    }: BaseAPIConstructorOptions,
  ) {
    const { transport } = config
    super(config, {
      defaultSyncIntervalMinutes,
      logLabel,
      rateLimitHours,
      // The ONE bound engine every redaction seat in this SDK shares
      // (`src/observability/context.ts`): without it the core's log
      // lines fall back to the base vocabulary, and the MELCloud keys
      // (`contextkey`, `access_token`, `owneremail`…) travel in clear —
      // the 2026-08-21 leak's failure class, at the dispatch seam.
      redaction,
      syncCallback,
      // The transport RESOLUTION stays in this repo on purpose (the
      // core takes the client ALREADY BUILT): `instanceof` reads THIS
      // repo's `HttpClient`, the subclass seating the MELCloud
      // redaction vocabulary, so a bare core client is rebuilt rather
      // than adopted — the same leak class, at the transport seam.
      transport:
        transport instanceof HttpClient
          ? transport
          : new HttpClient({
              ...httpConfig,
              timeout: transport?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
            }),
    })
  }

  /**
   * Sync check first; when it reads `false`, a NON-DESTRUCTIVE probe —
   * one registry sync, which exercises the persisted session without
   * touching it — and only if that still leaves us unauthenticated, the
   * best-effort {@link resumeSession} fallback. The order matters:
   * `resumeSession` runs a full sign-in, which spends a real login
   * attempt (server-side throttle counters, the local backoff on a
   * rejection) and replaces a session that may have been merely
   * unexercised (a boot-time context fetch that lost the network reads
   * unauthenticated while a perfectly valid refresh token sits in
   * storage).
   *
   * Every rung reads the RECORDED verdict, not the bare session: a
   * stored credential the server has definitively refused (see
   * {@link resumeSession}) answers `false` here even while
   * `isAuthenticated()` still reads `true` over a session the refusal
   * deliberately did not clear — only an ACCEPTED sign-in restores the
   * `true` answer.
   * @returns `true` when a session is usable afterwards.
   */
  public async ensureAuthenticated(): Promise<boolean> {
    if (this.isSessionServable()) {
      return true
    }
    if (this.hasPersistedSession()) {
      // No guard needed: `syncRegistry` is the BEST-EFFORT hook by
      // contract — it logs and swallows, which is what keeps this probe
      // non-destructive. The propagating path is `enforceRegistrySync`,
      // and only the enforced post-auth sync calls it.
      await this.syncRegistry()
      if (this.isSessionServable()) {
        return true
      }
    }
    await this.resumeSession()
    return this.isSessionServable()
  }

  /**
   * Run a request and return the unwrapped response body, throwing on
   * transport failure. Companion to {@link safeRequest} — same shape,
   * same optional Zod validation via `options.schema`, but the
   * throw-on-failure contract appropriate for mutations and required
   * sync paths (fail fast, no Result branching).
   *
   * Three-method API surface:
   * - `request` returns the full `HttpResponse<T>` (status, headers,
   *   data) — full transport access for retry policies and telemetry.
   * - `requestData` strips the envelope and throws on failure — for
   *   mutations and required sync paths.
   * - {@link safeRequest} strips the envelope and Result-wraps failure
   *   — for best-effort getters.
   * @param method - HTTP method (`get`, `post`, …).
   * @param url - Request URL relative to the API base.
   * @param options - Request config plus an optional `schema` peer key.
   * @returns The unwrapped response body, parsed by the schema if one
   * was supplied.
   */
  protected async requestData<T>(
    method: string,
    url: string,
    options: Record<string, unknown> & { readonly schema?: z.ZodType<T> } = {},
  ): Promise<T> {
    const { schema, ...config } = options
    const { data } = await this.request<T>(method, url, config)
    return schema === undefined
      ? data
      : parseOrThrow(schema, data, `${method.toUpperCase()} ${url}`)
  }

  /**
   * Run a best-effort GET/POST/… request and wrap the outcome in a
   * {@link Result}. The unwrapped response body is returned on success;
   * on failure the typed {@link ApiRequestError} variant lets callers
   * branch on the failure mode without catching opaque exceptions.
   *
   * See {@link requestData} for the throw-on-failure companion that
   * shares the same shape.
   * @param method - HTTP method (`get`, `post`, …).
   * @param url - Request URL relative to the API base.
   * @param options - Request config plus an optional `schema` peer key.
   * @returns `{ ok: true, value }` on success or `{ ok: false, error }`
   * with the classified failure mode.
   */
  protected async safeRequest<T>(
    method: string,
    url: string,
    options: Record<string, unknown> & { readonly schema?: z.ZodType<T> } = {},
  ): Promise<Result<T>> {
    try {
      return ok(await this.requestData<T>(method, url, options))
    } catch (error) {
      this.logger.error(
        `[${method.toUpperCase()} ${url}] request or validation failed:`,
        error,
      )
      return err(classifyError(error))
    }
  }
}
