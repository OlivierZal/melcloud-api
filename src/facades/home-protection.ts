import type { HomeAPIAdapter } from '../api/index.ts'
import type { HolidayModeUpdate } from '../holiday-mode.ts'
import type {
  HomeHolidayModePostData,
  HomeProtectionUnits,
} from '../types/index.ts'
import { EntityNotFoundError } from '../errors/index.ts'
import {
  type ProtectionUpdate,
  clampFrostProtection,
  clampOverheatProtection,
} from '../protection.ts'
import { Temporal } from '../temporal.ts'
import { settleWrites } from './settle-writes.ts'

// The two instants a holiday window runs between.
interface HolidayWindow {
  readonly end: Temporal.Instant
  readonly start: Temporal.Instant
}

// How far ahead of now an enabled holiday window starts at the least.
// The Home wire arms a window AT its start and takes none that has
// begun: an enabling write whose start is not ahead of the unit's clock
// answers 404 while the window is stored, enabled, and does not arm
// (live-probed 2026-11-21 on one unit: starts of now, of ten minutes
// and of about an hour before, each refused and not armed for as long
// as it was watched, 75 s at the least; starts 20 s, 30 s, a minute and
// 3 min ahead accepted and found armed at the first read after their
// start). Over a window that is RUNNING the refusal costs more: it
// leaves the window inactive and the unit off, nothing armed to bring
// it back, where a start a minute ahead is accepted, the unit staying
// off through that minute. So "from now", and the start of a window
// already running, go out a minute ahead — inside what was measured,
// with the time a slow request, or a host clock running late, needs to
// arrive before the start it carries.
const HOLIDAY_START_LEAD = Temporal.Duration.from({ minutes: 1 })

// A write scoped to no unit at all is a semantic no-op: resolve without
// a wire call (the same skip the overheat push applies to an
// ATA-less bucket) instead of POSTing empty units the BFF never sees
// from the official app.
const isEmptyUnits = ({ ATA: ata, ATW: atw }: HomeProtectionUnits): boolean =>
  ata === undefined && atw === undefined

const toInstant = (wallClock: string, timeZone: string): Temporal.Instant =>
  Temporal.PlainDateTime.from(wallClock).toZonedDateTime(timeZone).toInstant()

// The two instants an enabled window is asked with: the caller's
// bounds, the start no closer to now than the wire can arm. A malformed
// bound throws on its parse.
const toArmableWindow = (
  { endDate, startDate }: Pick<HolidayModeUpdate, 'endDate' | 'startDate'>,
  timeZone = Temporal.Now.timeZoneId(),
): HolidayWindow => {
  const earliest = Temporal.Now.instant().add(HOLIDAY_START_LEAD)
  const given = toInstant(startDate, timeZone)
  return {
    end: toInstant(endDate, timeZone),
    start: Temporal.Instant.compare(given, earliest) < 0 ? earliest : given,
  }
}

// A bound as the wire reads it: the unit's wall clock, to the second.
const toWallClock = (
  instant: Temporal.Instant,
  timeZone: string,
): Temporal.PlainDateTime =>
  instant
    .toZonedDateTimeISO(timeZone)
    .toPlainDateTime()
    .round({ roundingMode: 'trunc', smallestUnit: 'second' })

// One clock's window, as its write carries it. The order of the bounds
// is judged HERE, on what the wire receives: it stores a window that
// ends before it starts without a word (a 200, the window enabled as
// sent, measured the same day), and two instants in order still read
// backwards on a clock in the hour it repeats, or as one second when
// less than a second apart.
const toClockWindow = (
  { end, start }: HolidayWindow,
  timeZone: string,
): Pick<HomeHolidayModePostData, 'endDate' | 'startDate'> => {
  const endDate = toWallClock(end, timeZone)
  const startDate = toWallClock(start, timeZone)
  if (Temporal.PlainDateTime.compare(endDate, startDate) <= 0) {
    throw new RangeError('The holiday-mode window ends before it can start')
  }
  return { endDate: endDate.toString(), startDate: startDate.toString() }
}

// The clock a unit's holiday window is read on: its own, which only
// the registry's model tells.
const clockOf = (api: HomeAPIAdapter, id: string): string => {
  const device = api.registry.getById(id)
  if (device === undefined) {
    throw new EntityNotFoundError('Device', { entityId: id })
  }
  return device.data.timeZone
}

// One window is one wall clock per unit clock, so the buckets are
// split by the clock their units sit on, in the order they come.
const splitByClock = (
  api: HomeAPIAdapter,
  { ATA: ata = [], ATW: atw = [] }: HomeProtectionUnits,
): [timeZone: string, units: HomeProtectionUnits][] =>
  [...Map.groupBy([...ata, ...atw], (id) => clockOf(api, id))].map(
    ([timeZone, ids]) => [timeZone, toHomeProtectionUnits(api, ids)],
  )

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
 * Writes a holiday-mode window to the given unit buckets. The caller
 * speaks its own wall clock; the wire reads a window on each unit's
 * (CLAUDE.md, the holiday-window entry, has the measures), arms it at
 * its start and closes it at its end. An enabled window therefore goes
 * out as one write per clock the units sit on, each bound the same
 * instant on that clock, and a start that is not a minute ahead of now
 * is sent a minute ahead: the wire takes no window that has begun. A
 * disabled window's dates are ignored and pass through as given, in
 * one write.
 * @param api - Home API client.
 * @param units - Device ids grouped by connection type.
 * @param update - The new holiday-mode window.
 * @param update.endDate - Window end, ISO 8601 wall-clock.
 * @param update.isEnabled - Whether holiday mode is on.
 * @param update.startDate - Window start, ISO 8601 wall-clock.
 * @throws A {@link RangeError} when an enabled window is malformed,
 * ends before it can start on a clock it is written on, or names a
 * unit whose timezone the runtime does not know; an
 * {@link EntityNotFoundError} when one of its units has left the
 * registry. All before any request. Then the single failed write, or
 * an `AggregateError` bundling every failure when more than one
 * rejects.
 */
export const pushHomeHolidayMode = async (
  api: HomeAPIAdapter,
  units: HomeProtectionUnits,
  { endDate, isEnabled, startDate }: HolidayModeUpdate,
): Promise<void> => {
  if (isEmptyUnits(units)) {
    return
  }
  if (!isEnabled) {
    await api.updateHolidayMode({ enabled: false, endDate, startDate, units })
    return
  }
  const window = toArmableWindow({ endDate, startDate }, api.timezone)
  // Every clock's write is built before the first goes out: a window
  // one clock cannot take leaves none of the others written.
  const writes = splitByClock(api, units).map(([timeZone, clockUnits]) => ({
    enabled: true,
    ...toClockWindow(window, timeZone),
    units: clockUnits,
  }))
  await settleWrites(
    writes.map(async (postData) => api.updateHolidayMode(postData)),
    'Holiday mode update failed on unit clocks',
  )
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
