import { describe, expect, it, vi } from 'vitest'

import type { ClassicAPIAdapter } from '../../src/api/classic-types.ts'
import type { HomeAPIAdapter } from '../../src/api/home-types.ts'
import type { ReportChartLineOptions } from '../../src/facades/report-types.ts'
import { ClassicRegistry } from '../../src/entities/index.ts'
import { ClassicDeviceAtaFacade } from '../../src/facades/classic-device-ata.ts'
import { ClassicDeviceAtwFacade } from '../../src/facades/classic-device-atw.ts'
import { ClassicDeviceErvFacade } from '../../src/facades/classic-device-erv.ts'
import { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import { HomeDeviceAtwFacade } from '../../src/facades/home-device-atw.ts'
import { type Result, ok } from '../../src/types/index.ts'
import {
  classicAtaDevice,
  classicAtwDevice,
  classicBuildingData,
  classicErvDevice,
  createMockClassicApi,
} from '../classic-fixtures.ts'
import { cast, defined, mock, okValue } from '../helpers.ts'
import {
  homeAtwDevice,
  homeDevice,
  homeTestRegistry,
} from '../home-fixtures.ts'

// The one window every dialect is asked about: explicit bounds, so no
// clock is involved and no host timezone can leak in.
const WINDOW = { from: '2026-03-01T00:00:00Z', to: '2026-03-03T00:00:00Z' }

const classicRegistry = (): ClassicRegistry => {
  const registry = new ClassicRegistry()
  registry.syncBuildings([classicBuildingData()])
  registry.syncDevices([
    classicAtaDevice(),
    classicAtwDevice(),
    classicErvDevice(),
  ])
  return registry
}

// One response body satisfying BOTH Classic extractors: the ATA buckets
// (Heating/Cooling/Auto/Dry/Fan/Other) and the ATW stack
// (Heating/Cooling/HotWater/Produced*) simply coexist as keys.
const classicEnergyApi = (): ClassicAPIAdapter =>
  createMockClassicApi({
    getEnergy: vi
      .fn<ClassicAPIAdapter['getEnergy']>()
      .mockResolvedValue(
        ok(
          cast({
            Auto: [0],
            Cooling: [1],
            Dry: [0],
            Fan: [0],
            Heating: [2],
            HotWater: [3],
            Labels: [1],
            LabelType: 2,
            Other: [0],
            ProducedCooling: [0],
            ProducedHeating: [1],
            ProducedHotWater: [1],
          }),
        ),
      ),
  })

// One energy-report contract for every dialect and type that has an
// energy wire: the same query shape in, the same chart shape out, the
// same unit — so a consumer charts any of them without branching.
const describeEnergyReportContract = (
  name: string,
  read: () => Promise<Result<ReportChartLineOptions>>,
): void => {
  describe(`energyReport — ${name}`, () => {
    it('answers the shared chart shape in kWh', async () => {
      expect.assertions(3)

      const value = okValue(await read())
      const seriesNames = value.series.map(({ name: seriesName }) => seriesName)

      expect(value.unit).toBe('kWh')
      expect(value.series.length).toBeGreaterThan(0)
      expect(seriesNames).not.toContain('')
    })
  })
}

describeEnergyReportContract('Classic ATA device', async () => {
  const registry = classicRegistry()
  const facade = new ClassicDeviceAtaFacade(
    classicEnergyApi(),
    registry,
    defined(registry.devices.getById(1000)),
  )
  return facade.getEnergyReport(WINDOW)
})

describeEnergyReportContract('Classic ATW device', async () => {
  const registry = classicRegistry()
  const facade = new ClassicDeviceAtwFacade(
    classicEnergyApi(),
    registry,
    defined(registry.devices.getById(1001)),
  )
  return facade.getEnergyReport(WINDOW)
})

const homeEnergyValues = [
  { time: '2026-03-01 06:00:00.000000000', value: '571.0' },
  { time: '2026-03-02 06:00:00.000000000', value: '229.0' },
]

describeEnergyReportContract('Home ATA device', async () => {
  const facade = new HomeDeviceAtaFacade(
    mock<HomeAPIAdapter>({
      getEnergy: vi
        .fn<HomeAPIAdapter['getEnergy']>()
        .mockResolvedValue(
          ok({
            measureData: [
              {
                type: 'cumulative_energy_consumed_since_last_upload',
                values: homeEnergyValues,
              },
            ],
          }),
        ),
      registry: homeTestRegistry,
      timezone: 'UTC',
    }),
    homeDevice({ id: 'contract-energy-ata' }),
  )
  return facade.getEnergyReport(WINDOW)
})

describeEnergyReportContract('Home ATW device', async () => {
  const facade = new HomeDeviceAtwFacade(
    mock<HomeAPIAdapter>({
      getEnergy: vi.fn<HomeAPIAdapter['getEnergy']>().mockResolvedValue(
        ok({
          measureData: [
            { type: 'interval_energy_consumed', values: homeEnergyValues },
            { type: 'interval_energy_produced', values: homeEnergyValues },
          ],
        }),
      ),
      registry: homeTestRegistry,
      timezone: 'UTC',
    }),
    homeAtwDevice({ id: 'contract-energy-atw' }),
  )
  return facade.getEnergyReport(WINDOW)
})

// Only Classic can express this: ERV has no energy wire at all, and the
// contract there is an EMPTY chart with no wire call — plus the raw
// read refusing before any I/O.
describe('energyReport — Classic ERV (no energy wire)', () => {
  it('resolves an empty chart without touching the wire', async () => {
    const api = classicEnergyApi()
    const registry = classicRegistry()
    const facade = new ClassicDeviceErvFacade(
      api,
      registry,
      defined(registry.devices.getById(1002)),
    )
    const value = okValue(await facade.getEnergyReport(WINDOW))

    expect(value.series).toStrictEqual([])
    expect(value.unit).toBe('kWh')
    expect(api.getEnergy).not.toHaveBeenCalled()
  })

  it('refuses the raw energy read before any I/O', async () => {
    const api = classicEnergyApi()
    const registry = classicRegistry()
    const facade = new ClassicDeviceErvFacade(
      api,
      registry,
      defined(registry.devices.getById(1002)),
    )

    await expect(facade.getEnergy(WINDOW)).rejects.toThrow(
      'No energy report exists for this device type',
    )
    expect(api.getEnergy).not.toHaveBeenCalled()
  })
})
