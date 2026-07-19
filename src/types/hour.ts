/**
 * Integer hour of the day in 24-hour form (0 through 23).
 * @category Types
 */
export type Hour =
  | 0
  | 1
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 2
  | 20
  | 21
  | 22
  | 23
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9

const LAST_HOUR = 23

const isHour = (value: number): value is Hour =>
  Number.isSafeInteger(value) && value >= 0 && value <= LAST_HOUR

/**
 * Every {@link Hour} in chronological order — the fan-out base for
 * day-spanning hourly charts.
 * @category Types
 */
export const HOURS: readonly Hour[] = Array.from(
  { length: LAST_HOUR + 1 },
  (_unused, index) => index,
).filter((value) => isHour(value))
