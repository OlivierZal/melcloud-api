import { type Result, ok } from '../types/index.ts'

/**
 * The fan-out read policy shared by the combinations: the reads run at
 * once and the answer FAILS CLOSED — the first failed result, in read
 * order, comes back unchanged, never the values of the reads that did
 * answer, which would show part of a whole as the whole.
 * @template T - What each read answers.
 * @param reads - The reads, already started.
 * @returns Every value, in read order, or the first failure.
 */
export const settleReads = async <T>(
  reads: readonly Promise<Result<T>>[],
): Promise<Result<T[]>> => {
  const results = await Promise.all(reads)
  const values: T[] = []
  for (const result of results) {
    if (!result.ok) {
      return result
    }
    values.push(result.value)
  }
  return ok(values)
}
