// `allSettled` reasons are `unknown`; non-Error rejections (possible
// from plain-JS callers) wrap so the throw sites stay Error-typed.
const toError = (reason: unknown): Error =>
  reason instanceof Error ? reason : new Error(JSON.stringify(reason))

/**
 * The fan-out failure policy shared by the multi-target writes: every
 * write runs to its end — a failed one never stops the others — then
 * the single failure surfaces as itself and several as one
 * `AggregateError`, in write order. The thrown error is the fan-out's
 * only outcome channel.
 * @param writes - The writes, already started.
 * @param failureMessage - Message of the `AggregateError` that bundles
 * several failures.
 * @throws The single failure, or an `AggregateError` bundling every
 * failure when more than one write rejects.
 */
export const settleWrites = async (
  writes: readonly Promise<void>[],
  failureMessage: string,
): Promise<void> => {
  const outcomes = await Promise.allSettled(writes)
  const failures = outcomes
    .filter((outcome) => outcome.status === 'rejected')
    .map(({ reason }) => toError(reason))
  const [firstFailure] = failures
  if (firstFailure !== undefined && failures.length === 1) {
    throw firstFailure
  }
  if (failures.length > 1) {
    throw new AggregateError(failures, failureMessage)
  }
}
