import { ClassicDeviceType } from '../constants.ts'
import { type Result, mapResult } from '../types/index.ts'
import type { ReportChartPieOptions, ReportQuery } from './report-types.ts'
import { BaseDeviceFacade } from './classic-base-device.ts'
import { classicErvFlags } from './classic-flags.ts'

const isRelevantVentilationMode = (label?: string): boolean =>
  label !== undefined &&
  (label === 'Power' ||
    (label.startsWith('Actual') && !label.endsWith('OperationMode')))

/** Facade for Energy Recovery Ventilation (ERV) devices with filtered ventilation mode reporting. */
export class ClassicDeviceErvFacade extends BaseDeviceFacade<
  typeof ClassicDeviceType.Erv
> {
  public readonly flags: typeof classicErvFlags = classicErvFlags

  public readonly type: typeof ClassicDeviceType.Erv = ClassicDeviceType.Erv

  protected readonly temperaturesLegend: readonly (string | undefined)[] = [
    undefined,
    'RoomTemperature',
    undefined,
    'OutdoorTemperature',
  ]

  public override async getOperationModes(
    query?: ReportQuery,
    shouldUseExactRange = true,
  ): Promise<Result<ReportChartPieOptions>> {
    return mapResult(
      await super.getOperationModes(query, shouldUseExactRange),
      ({ labels, series, ...options }) => {
        // Filter labels and series together to keep indices in sync
        const filtered = labels
          .map((label, index) => ({ label, value: series[index] }))
          .filter((item): item is { label: string; value: number } =>
            isRelevantVentilationMode(item.label),
          )

        return {
          ...options,
          labels: filtered.map(({ label }) => label),
          series: filtered.map(({ value }) => value),
        }
      },
    )
  }
}
