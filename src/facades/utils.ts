import { DateTime } from 'luxon'

export const DEFAULT_YEAR = '1970-01-01'
export const nowISO = (): string =>
  DateTime.now().toISO({ includeOffset: false })
