import type { HomeAPIAdapter } from '../api/index.ts'
import type { HolidayModeUpdate } from '../holiday-mode.ts'
import type { HomeProtectionUnits } from '../types/index.ts'
import {
  type ProtectionUpdate,
  clampFrostProtection,
  clampOverheatProtection,
} from '../protection.ts'
import { toUtcWallClock } from '../utils.ts'

// A write scoped to no unit at all is a semantic no-op: resolve without
// a wire call (the same skip the overheat push applies to an
// ATA-less bucket) instead of POSTing empty units the BFF never sees
// from the official app.
const isEmptyUnits = ({ ATA: ata, ATW: atw }: HomeProtectionUnits): boolean =>
  ata === undefined && atw === undefined

/**
 * Issues one frost-protection write for the given unit buckets, bounds
 * clamped into range — the single wire funnel shared by the manager's
 * id-list batches and the per-target facade writes.
 * @param api - Home API client.
 * @param units - Device ids grouped by connection type.
 * @param update - The new frost-protection settings.
 * @param update.isEnabled - Whether frost protection is on.
 * @param update.max - Upper bound, in °C (clamped to [6, 16]).
 * @param update.min - Lower bound, in °C (clamped to [4, 14]).
 */
export const pushHomeFrostProtection = async (
  api: HomeAPIAdapter,
  units: HomeProtectionUnits,
  { isEnabled, max, min }: ProtectionUpdate,
): Promise<void> => {
  if (isEmptyUnits(units)) {
    return
  }
  await api.updateFrostProtection({
    enabled: isEnabled,
    ...clampFrostProtection(min, max),
    units,
  })
}

/**
 * Issues one holiday-mode write for the given unit buckets. The caller
 * speaks its own wall clock, the wire stores UTC (see CLAUDE.md,
 * live-probed); a disabled window's dates are ignored and pass through
 * unprojected.
 * @param api - Home API client.
 * @param units - Device ids grouped by connection type.
 * @param update - The new holiday-mode window.
 * @param update.endDate - Window end, ISO 8601 wall-clock.
 * @param update.isEnabled - Whether holiday mode is on.
 * @param update.startDate - Window start, ISO 8601 wall-clock.
 */
export const pushHomeHolidayMode = async (
  api: HomeAPIAdapter,
  units: HomeProtectionUnits,
  { endDate, isEnabled, startDate }: HolidayModeUpdate,
): Promise<void> => {
  if (isEmptyUnits(units)) {
    return
  }
  await api.updateHolidayMode({
    enabled: isEnabled,
    endDate: isEnabled
      ? toUtcWallClock(endDate, api.timezone).toString()
      : endDate,
    startDate: isEnabled
      ? toUtcWallClock(startDate, api.timezone).toString()
      : startDate,
    units,
  })
}

/**
 * Issues one overheat-protection write for the given unit buckets,
 * keeping only the ATA ids (the feature is ATA-only — the official app
 * never sends ATW ids) and resolving without a wire call when none
 * remain. Bounds are clamped into range.
 * @param api - Home API client.
 * @param units - Device ids grouped by connection type (ATW ids are dropped).
 * @param update - The new overheat-protection settings.
 * @param update.isEnabled - Whether overheat protection is on.
 * @param update.max - Upper bound, in °C (clamped to [33, 40]).
 * @param update.min - Lower bound, in °C (clamped to [31, 38]).
 */
export const pushHomeOverheatProtection = async (
  api: HomeAPIAdapter,
  units: HomeProtectionUnits,
  { isEnabled, max, min }: ProtectionUpdate,
): Promise<void> => {
  const { ATA: ata } = units
  if (ata === undefined) {
    return
  }
  await api.updateOverheatProtection({
    enabled: isEnabled,
    ...clampOverheatProtection(min, max),
    units: { ATA: ata },
  })
}

/**
 * Splits device ids into the wire's per-type buckets, skipping ids the
 * registry does not know (a device from another account or a stale id).
 * @param api - Home API client (carries the device registry).
 * @param deviceIds - Device ids to bucket.
 * @returns The per-type unit buckets, empty buckets omitted.
 */
export const toHomeProtectionUnits = (
  api: HomeAPIAdapter,
  deviceIds: readonly string[],
): HomeProtectionUnits => {
  const ata: string[] = []
  const atw: string[] = []
  for (const id of deviceIds) {
    const device = api.registry.getById(id)
    if (device?.isAta() === true) {
      ata.push(id)
    } else if (device?.isAtw() === true) {
      atw.push(id)
    }
  }
  return {
    ...(ata.length > 0 && { ATA: ata }),
    ...(atw.length > 0 && { ATW: atw }),
  }
}
