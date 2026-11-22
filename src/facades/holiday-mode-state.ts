import type { HolidayModeState } from '../holiday-mode.ts'
import { Temporal } from '../temporal.ts'
import { toEpochMs, toZonedWallClock } from '../utils.ts'

// A holiday window as a wire holds it, under the neutral field names:
// both bounds on the wire's own wall clock, the flag as the wire says
// it.
interface WireHolidayWindow {
  readonly endDate: string | null
  readonly isEnabled: boolean
  readonly startDate: string | null
}

// An end the wire left unset, or one that cannot be read, closes
// nothing: the wire's flag then stands alone.
const hasEnded = (endDate: string | null, timeZone: string): boolean => {
  const endEpochMs = endDate === null ? null : toEpochMs(endDate, timeZone)
  return (
    endEpochMs !== null &&
    endEpochMs <= Temporal.Now.instant().epochMilliseconds
  )
}

const toCallerClock = (
  wallClock: string | null,
  zones: { from: string; to?: string | undefined },
): string | null =>
  wallClock === null ? null : toZonedWallClock(wallClock, zones)

/**
 * Maps a wire's holiday window onto the cross-dialect read state, the
 * one place that says what "on" means for both wires: a window is on
 * until its end, and off from it, whatever flag the wire still holds
 * then. MELCloud Home keeps its flag after a window has closed, and
 * what MELCloud Classic keeps is not measured (CLAUDE.md, the
 * holiday-window entry). The end is judged on the wire's own clock,
 * where it was written, and both bounds come back projected onto the
 * caller's.
 * @param window - The wire's window.
 * @param window.endDate - Its end on the wire's clock, `null` when
 * unset.
 * @param window.isEnabled - The wire's flag.
 * @param window.startDate - Its start on the wire's clock, `null` when
 * unset.
 * @param zones - The two clocks.
 * @param zones.from - IANA timezone the wire's wall clock belongs to.
 * @param zones.to - The caller's IANA timezone; host zone when omitted.
 * @returns The neutral holiday-mode state.
 */
export const toHolidayModeState = (
  { endDate, isEnabled, startDate }: WireHolidayWindow,
  zones: { from: string; to?: string | undefined },
): HolidayModeState => ({
  endDate: toCallerClock(endDate, zones),
  isEnabled: isEnabled && !hasEnded(endDate, zones.from),
  startDate: toCallerClock(startDate, zones),
})
