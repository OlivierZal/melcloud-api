import {
  type AggregatedHolidayModeState,
  type HolidayModeState,
  type HolidayModeUpdate,
  aggregateHolidayModeStates,
} from '../holiday-mode.ts'
import {
  type AggregatedProtectionState,
  type ProtectionState,
  type ProtectionUpdate,
  aggregateProtectionStates,
} from '../protection.ts'
import { type Result, mapResult } from '../types/index.ts'
import { settleReads } from './settle-reads.ts'
import { settleWrites } from './settle-writes.ts'

/**
 * The settings contract every target answers — every Classic facade,
 * both dialects' device facades and the Home building facade: frost
 * protection and holiday mode, each read as one state, as a per-field
 * fold (`null` the mixed marker) or as `null` when never configured.
 * @category Facades
 */
export interface SettingsTarget {
  /**
   * Reads the frost protection the target holds: one state, a fold of
   * its members' or `null` when never configured.
   */
  readonly getFrostProtection: () => Promise<
    Result<AggregatedProtectionState | ProtectionState | null>
  >
  /**
   * Reads the holiday-mode window the target holds, on the caller's
   * clock: one state, a fold of its members' or `null` when never
   * configured.
   */
  readonly getHolidayMode: () => Promise<
    Result<AggregatedHolidayModeState | HolidayModeState | null>
  >
  /**
   * Applies frost-protection settings to everything the target covers.
   */
  readonly updateFrostProtection: (update: ProtectionUpdate) => Promise<void>
  /**
   * Turns holiday mode on over a window given on the caller's clock,
   * or off, for everything the target covers.
   */
  readonly updateHolidayMode: (update: HolidayModeUpdate) => Promise<void>
}

/**
 * Combines several settings targets into one that answers the same
 * contract: one house split across the two MELCloud accounts, say, its
 * frost protection and its holiday mode read and written as one. The
 * targets are read concurrently, and a read fails closed — the first
 * failed result, in target order, comes back unchanged, never a fold of
 * the targets that did answer; otherwise the states fold field by
 * field, a field the targets disagree on reading `null`, the mixed
 * marker, and a target never configured reading as off. A write sends
 * the same update to every target at once, and a failed target never
 * stops the others. The combination holds no client and makes no wire
 * call of its own.
 * @param targets - The targets to combine; their order is the order of
 * the failures.
 * @returns The combined target. Its reads reject, at once and whatever
 * its place, with what a target's read throws where a failed read
 * answers a result. Its writes rethrow a single target failure as
 * itself and bundle several into one `AggregateError`, in target order.
 * @category Facades
 */
export const combineSettingsTargets = (
  targets: readonly SettingsTarget[],
): SettingsTarget => ({
  getFrostProtection: async () =>
    mapResult(
      await settleReads(
        targets.map(async (target) => target.getFrostProtection()),
      ),
      aggregateProtectionStates,
    ),
  getHolidayMode: async () =>
    mapResult(
      await settleReads(targets.map(async (target) => target.getHolidayMode())),
      aggregateHolidayModeStates,
    ),
  updateFrostProtection: async (update) =>
    settleWrites(
      targets.map(async (target) => target.updateFrostProtection(update)),
      'Frost protection update failed on targets',
    ),
  updateHolidayMode: async (update) =>
    settleWrites(
      targets.map(async (target) => target.updateHolidayMode(update)),
      'Holiday mode update failed on targets',
    ),
})
