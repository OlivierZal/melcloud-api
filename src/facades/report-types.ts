/**
 * One background band over a line chart, expressed as an inclusive
 * `[from, to]` index range on the `labels` grid — e.g. an ATW
 * operation-mode span. Only Home ATW temperature charts carry bands;
 * every other chart omits the field.
 * @category Facades
 */
export interface ReportChartBand {
  /** Index of the first covered label. */
  readonly from: number
  /** Band name (Classic operation-mode vocabulary, e.g. `'HotWater'`). */
  readonly label: string
  /** Index of the last covered label. */
  readonly to: number
}

/**
 * Line chart data with named series and a measurement unit.
 * @category Facades
 */
export interface ReportChartLineOptions extends ReportChartOptions {
  readonly series: readonly {
    readonly data: (number | null)[]
    readonly name: string
  }[]
  /** Measurement unit label (e.g. `'°C'`, `'dBm'`). */
  readonly unit: string
  /** Background bands (operation modes); absent on most charts. */
  readonly bands?: readonly ReportChartBand[] | undefined
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

/**
 * Pie chart data with labeled segments.
 * @category Facades
 */
export interface ReportChartPieOptions extends ReportChartOptions {
  /** Numeric values for each pie segment. */
  readonly series: number[]
}

/**
 * Date range query for report endpoints.
 * @category Facades
 */
export interface ReportQuery {
  /** Start date in ISO 8601 format. Defaults to `'1970-01-01'`. */
  readonly from?: string | undefined
  /** End date in ISO 8601 format. Defaults to now. */
  readonly to?: string | undefined
}
