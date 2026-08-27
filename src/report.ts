/**
 * The published report contract: neutral target interfaces over the
 * five cross-dialect chart reads, so a consumer charts any target
 * without knowing which API backs it. Members exist ONLY where a wire
 * answers — the Home ATA wire has no hourly-temperatures and no
 * operation-modes report, so its facade satisfies {@link ReportSurface}
 * and not {@link FullReportSurface}: absence stays absent, nothing is
 * emulated. Type-only on purpose — the module pulls no value into a
 * browser bundle.
 */
import type {
  ReportChartLineOptions,
  ReportChartPieOptions,
  ReportQuery,
} from './facades/report-types.ts'
import type { Hour, Result } from './types/index.ts'

export type {
  ReportChartBand,
  ReportChartLineOptions,
  ReportChartPieOptions,
  ReportQuery,
} from './facades/report-types.ts'

/**
 * A target answering the energy report — Classic ATA/ATW/ERV devices
 * (ERV resolves an empty chart: its wire has no energy report) and both
 * Home device facades.
 * @category Facades
 */
export interface EnergyReportTarget {
  /**
   * Fetch the energy report as line chart data (`kWh` buckets).
   */
  readonly getEnergyReport: (
    query?: ReportQuery,
  ) => Promise<Result<ReportChartLineOptions>>
}

/**
 * The full five-read surface: Classic device facades and the Home ATW
 * facade. The Home ATA facade stays on {@link ReportSurface} — its wire
 * has no hourly-temperatures and no operation-modes report.
 * @category Facades
 */
export interface FullReportSurface
  extends
    HourlyTemperaturesReportTarget,
    OperationModesReportTarget,
    ReportSurface {}

/**
 * A target answering the fine-grained temperature chart — the whole of
 * today, or one specific hour. Classic devices (non-ATW types resolve
 * an empty chart: the wire is ATW-only) and the Home ATW facade.
 * @category Facades
 */
export interface HourlyTemperaturesReportTarget {
  /**
   * Fetch the hourly temperature report as line chart data (`°C`).
   */
  readonly getHourlyTemperatures: (
    hour?: Hour,
  ) => Promise<Result<ReportChartLineOptions>>
}

/**
 * A target answering operation-mode usage as pie chart data — Classic
 * devices and the Home ATW facade, one mode vocabulary.
 * @category Facades
 */
export interface OperationModesReportTarget {
  /**
   * Fetch operation-mode usage as pie chart data.
   */
  readonly getOperationModes: (
    query?: ReportQuery,
  ) => Promise<Result<ReportChartPieOptions>>
}

/**
 * The chart reads every device-level report target answers, on either
 * dialect — the surface a consumer can rely on without branching on the
 * backing API.
 * @category Facades
 */
export interface ReportSurface
  extends
    EnergyReportTarget,
    SignalStrengthReportTarget,
    TemperaturesReportTarget {}

/**
 * A target answering the Wi-Fi signal chart — every Classic facade
 * (zones and devices) and every Home device facade.
 * @category Facades
 */
export interface SignalStrengthReportTarget {
  /**
   * Fetch the Wi-Fi signal strength report as line chart data (`dBm`).
   */
  readonly getSignalStrength: (
    hour?: Hour,
  ) => Promise<Result<ReportChartLineOptions>>
}

/**
 * A target answering the temperature history — every device facade on
 * either dialect.
 * @category Facades
 */
export interface TemperaturesReportTarget {
  /**
   * Fetch the temperature history as line chart data (`°C`).
   */
  readonly getTemperatures: (
    query?: ReportQuery,
  ) => Promise<Result<ReportChartLineOptions>>
}
