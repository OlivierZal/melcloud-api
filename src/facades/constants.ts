import { DateTime } from 'luxon'

const YEAR_1970 = 1970
export const from1970 = (): string => DateTime.local(YEAR_1970).toISO() ?? ''
export const now = (): string => DateTime.now().toISO()