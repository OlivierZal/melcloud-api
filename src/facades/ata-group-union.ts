import { tolerateNoChanges } from '../errors/index.ts'
import { mapResult } from '../types/index.ts'
import type { ClassicZoneFacade } from './classic-types.ts'
import { aggregateClassicAtaGroupStates } from './home-ata-group.ts'
import { settleReads } from './settle-reads.ts'
import { settleWrites } from './settle-writes.ts'

/**
 * The ATA group contract every group target answers — the Classic
 * building, floor and area facades, both dialects' ATA device facades
 * (each a group of one) and the Home building facade — in the one
 * Classic-numbered group vocabulary, `null` the shared mixed and
 * leave-unchanged marker.
 * @category Facades
 */
export type AtaGroup = Pick<
  ClassicZoneFacade,
  'getGroup' | 'getMemberOperationModes' | 'updateGroupState'
>

/**
 * Combines several ATA groups into one that answers the same contract:
 * one house split across the two MELCloud accounts, say, read and
 * written as one group. The groups are read concurrently, and the read
 * fails closed — the first failed result, in group order, comes back
 * unchanged, never a fold of the groups that did answer; otherwise the
 * states fold field by field, a field the groups disagree on reading
 * `null`, the mixed marker. Member modes concatenate in group order. A
 * write sends the same delta to every group at once: a group's
 * `NoChangesError` counts as success, as on the members of one group,
 * and a failed group never stops the others. The combination holds no
 * client and makes no wire call of its own.
 * @param groups - The groups to combine; their order is the order of
 * the member modes and of the failures.
 * @returns The combined group. Its write rethrows a single group failure
 * as itself and bundles several into one `AggregateError`, in group
 * order.
 * @category Facades
 */
export const combineAtaGroups = (groups: readonly AtaGroup[]): AtaGroup => ({
  getGroup: async () =>
    mapResult(
      await settleReads(groups.map(async (group) => group.getGroup())),
      aggregateClassicAtaGroupStates,
    ),
  getMemberOperationModes: (options) =>
    groups.flatMap((group) => group.getMemberOperationModes(options)),
  updateGroupState: async (state) =>
    settleWrites(
      groups.map(async (group) =>
        tolerateNoChanges(async () => group.updateGroupState(state)),
      ),
      'Group update failed on groups',
    ),
})
