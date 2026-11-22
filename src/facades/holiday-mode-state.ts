import type { HolidayModeState } from '../holiday-mode.ts'
import { Temporal } from '../temporal.ts'
import { toZonedWallClock } from '../utils.ts'

// A holiday window as a wire holds it, under the neutral field names:
// both bounds on the wire's own wall clock, the flag as the wire says
// it.
interface WireHolidayWindow {
  readonly endDate: string | null
  readonly isEnabled: boolean
  readonly startDate: string | null
}

// The end is read as the projection reads it (`toZonedWallClock`): the
// same parse, the same pass of an hour its clock repeats. One the wire
// left unset, or one that cannot be read, the value or its clock,
// closes nothing: the wire's flag then stands alone.
const hasEnded = (endDate: string | null, timeZone: string): boolean => {
  if (endDate === null) {
    return false
  }
  try {
    return (
      Temporal.PlainDateTime.from(endDate).toZonedDateTime(timeZone)
        .epochMilliseconds <= Temporal.Now.instant().epochMilliseconds
    )
  } catch {
    return false
  }
}

const toCallerClock = (
  wallClock: string | null,
  zones: { from: string; to?: string | undefined },
): string | null =>
  wallClock === null ? null : toZonedWallClock(wallClock, zones)

/**
 * Maps a wire's holiday window onto the cross-dialect read state, the
 * one place that says what "on" means for both wires: the wire's flag
 * until the window's end, and off from it, whatever flag the wire
 * still holds then. MELCloud Home keeps its flag after a window has
 * closed, and what MELCloud Classic keeps is not measured (CLAUDE.md,
 * the holiday-window entry). The end is judged on the wire's own
 * clock, where it was written, and both bounds come back projected
 * onto the caller's.
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
