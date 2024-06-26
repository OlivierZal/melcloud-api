import { DateTime } from 'luxon'

export const YEAR_1970 = '1970-01-01'
export const nowISO = (): string =>
  DateTime.now().toISO({ includeOffset: false })
