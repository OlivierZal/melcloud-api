/** Line chart data with named series and a measurement unit. */
export interface ReportChartLineOptions extends ReportChartOptions {
  readonly series: readonly {
    readonly data: (number | null)[]
    readonly name: string
  }[]
  /** Measurement unit label (e.g. `'°C'`, `'dBm'`). */
  readonly unit: string
}

/** Base chart options with date range and formatted axis labels. */
export interface ReportChartOptions {
  /** Start date of the report period. */
  readonly from: string
  /** Formatted axis labels (dates, months, etc.). */
  readonly labels: readonly string[]
  /** End date of the report period. */
  readonly to: string
}

/** Pie chart data with labeled segments. */
export interface ReportChartPieOptions extends ReportChartOptions {
  /** Numeric values for each pie segment. */
  readonly series: number[]
}

/** Date range query for report endpoints. */
export interface ReportQuery {
  /** Start date in ISO 8601 format. Defaults to `'1970-01-01'`. */
  readonly from?: string
  /** End date in ISO 8601 format. Defaults to now. */
  readonly to?: string
}
