import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClassicAPIAdapter } from '../../src/api/classic-types.ts'
import type { HomeAPIAdapter } from '../../src/api/home-types.ts'
import type { ReportChartLineOptions } from '../../src/facades/report-types.ts'
import { ClassicRegistry } from '../../src/entities/index.ts'
import { ClassicBuildingFacade } from '../../src/facades/classic-building.ts'
import { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import { Temporal } from '../../src/temporal.ts'
import { type Hour, type Result, ok } from '../../src/types/index.ts'
import {
  classicAtaDevice,
  classicBuildingData,
  classicReportData,
  createMockClassicApi,
} from '../classic-fixtures.ts'
import { defined, mock, mockTemporalNowZoned, okValue } from '../helpers.ts'
import { homeDevice, homeTestRegistry } from '../home-fixtures.ts'

// Both dialects are asked about the same pinned moment, so neither the
// host clock nor its timezone can shape the answer.
const NOW = '2026-03-01T12:00:00Z'

const classicSignalFacade = (): ClassicBuildingFacade => {
  const registry = new ClassicRegistry()
  registry.syncBuildings([classicBuildingData()])
  registry.syncDevices([classicAtaDevice()])
  const api = createMockClassicApi({
    getSignal: vi
      .fn<ClassicAPIAdapter['getSignal']>()
      .mockResolvedValue(ok(classicReportData({ Data: [[-66]] }))),
  })
  return new ClassicBuildingFacade(
    api,
    registry,
    defined(registry.buildings.getById(1)),
  )
}

const homeSignalFacade = (): HomeDeviceAtaFacade => {
  const api = mock<HomeAPIAdapter>({
    getSignal: vi
      .fn<HomeAPIAdapter['getSignal']>()
      .mockResolvedValue(
        ok({
          measureData: [
            {
              type: 'rssi',
              values: [{ time: '2026-03-01 12:05:00.000000000', value: '-66' }],
            },
          ],
        }),
      ),
    registry: homeTestRegistry,
    timezone: 'UTC',
  })
  return new HomeDeviceAtaFacade(api, homeDevice({ id: 'contract-signal' }))
}

// The de-facto signal contract, now pinned: same method name, same
// signature, same chart shape, same dBm unit on every dialect — the
// mechanics underneath (Classic's hour-by-hour fan-out over a zone,
// Home's five-minute single fetch) are not part of the contract.
const describeSignalStrengthContract = (
  name: string,
  read: (hour: Hour) => Promise<Result<ReportChartLineOptions>>,
): void => {
  describe(`signalStrength — ${name}`, () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(Temporal.Instant.from(NOW).epochMilliseconds)
      mockTemporalNowZoned()
    })

    afterEach(() => {
      vi.mocked(Temporal.Now.zonedDateTimeISO).mockRestore()
      vi.useRealTimers()
    })

    it('answers the shared chart shape in dBm', async () => {
      const value = okValue(await read(12))

      expect(value.unit).toBe('dBm')
      expect(value.series.length).toBeGreaterThan(0)
      expect(value.series[0]?.data).toContain(-66)
      expect(value.labels.length).toBeGreaterThan(0)
    })
  })
}

describeSignalStrengthContract('Classic zone', async (hour) =>
  classicSignalFacade().getSignalStrength(hour),
)

describeSignalStrengthContract('Home ATA device', async (hour) =>
  homeSignalFacade().getSignalStrength(hour),
)
