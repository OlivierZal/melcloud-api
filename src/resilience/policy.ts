/**
 * Unit of cross-cutting resilience logic around a request attempt.
 *
 * Each policy owns exactly one concern (rate-limiting, auth retry,
 * transient-error retry…) and wraps the caller's `attempt` with its
 * own semantics. Policies are **composed** via {@link CompositePolicy}
 * to build the request pipeline declaratively, replacing the prior
 * inline `makeRequestAttempt` chain whose stages were tangled across
 * `BaseAPI.request`, `makeRequestAttempt`, and `runWithEvents`.
 *
 * Implementations MUST:
 * - run the caller's `attempt` at most once per `run` invocation per
 *   success path (retries are explicit loops the policy owns);
 * - propagate errors they don't own — a policy handles only the
 *   concern it was built for; anything else flows through untouched;
 * - be stateless across `run` calls (shared state — guards, gates —
 *   goes through constructor injection so it's visible + swappable).
 */
export interface ResiliencePolicy {
  run: <T>(attempt: () => Promise<T>) => Promise<T>
}

/**
 * Compose N policies into a single pipeline. The first policy in the
 * array is the **outermost** wrapper — it sees the request before any
 * inner policy gets to decorate it, and sees the result last.
 *
 * Example: `new CompositePolicy([rate, auth, transient]).run(fetch)`
 * runs as `rate(auth(transient(fetch)))`. A transient 5xx is retried
 * first; a 401 on the last attempt triggers auth-retry; a 429 in any
 * branch hits the rate-limit gate outermost.
 *
 * An empty composite is a no-op pass-through.
 */
export class CompositePolicy implements ResiliencePolicy {
  readonly #policies: readonly ResiliencePolicy[]

  public constructor(policies: readonly ResiliencePolicy[]) {
    this.#policies = policies
  }

  public async run<T>(attempt: () => Promise<T>): Promise<T> {
    let wrapped: () => Promise<T> = attempt
    for (const policy of [...this.#policies].toReversed()) {
      const inner = wrapped
      const wrap = async (): Promise<T> => policy.run(inner)
      wrapped = wrap
    }
    return wrapped()
  }
}
