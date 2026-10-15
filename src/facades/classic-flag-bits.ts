import { CLASSIC_FLAG_UNCHANGED } from '../constants.ts'

// `EffectiveFlags` is a bitfield wider than 32 bits, so both operations
// run on BigInt — the number operators truncate to 32 bits — and they
// live here, the one module that spells a bit operator; every other site
// names the operation instead.

/**
 * Folds field flags into one `EffectiveFlags` value.
 * @param flags - The flags of the fields a write carries.
 * @returns The combined bitfield, as the wire's number.
 */
export const combineFlags = (flags: readonly number[]): number =>
  Number(
    flags.reduce(
      // eslint-disable-next-line no-bitwise -- the bitfield's one OR
      (combined, flag) => combined | BigInt(flag),
      BigInt(CLASSIC_FLAG_UNCHANGED),
    ),
  )

/**
 * Whether an `EffectiveFlags` value carries a field's flag.
 * @param effectiveFlags - The bitfield a write echoed.
 * @param flag - The field's flag.
 * @returns `true` when the field was flagged.
 */
export const hasFlag = (effectiveFlags: bigint, flag: number): boolean =>
  // eslint-disable-next-line no-bitwise -- the bitfield's one AND
  Boolean(effectiveFlags & BigInt(flag))
