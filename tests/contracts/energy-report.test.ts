import { cast, defined } from '@olivierzal/api-core/testing'
import { describe, expect, it, vi } from 'vitest'

import type { ClassicAPIAdapter } from '../../src/api/classic-types.ts'
import type { HomeAPIAdapter } from '../../src/api/home-types.ts'
import type { ClassicRegistry } from '../../src/entities/index.ts'
import type { ReportChartLineOptions } from '../../src/facades/report-types.ts'
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
  populatedClassicRegistry,
} from '../classic-fixtures.ts'
import { okValue } from '../helpers.ts'
import {
  createMockHomeApi,
  homeAtwDevice,
  homeDevice,
  homeEnergyEnvelope,
  homeEnergyReport,
} from '../home-fixtures.ts'

// The one window every dialect is asked about: explicit bounds, so no
// clock is involved and no host timezone can leak in.
const WINDOW = { from: '2026-03-01T00:00:00Z', to: '2026-03-03T00:00:00Z' }

const classicRegistry = (): ClassicRegistry => {
  const registry = populatedClassicRegistry({
    buildings: [classicBuildingData()],
    devices: [classicAtaDevice(), classicAtwDevice(), classicErvDevice()],
  })
  return registry
}

// One response body satisfying BOTH Classic extractors: the ATA buckets
// (Heating/Cooling/Auto/Dry/Fan/Other) and the ATW stack
// (Heating/Cooling/HotWater/Produced*) simply coexist as keys.
const classicEnergyApi = (registry: ClassicRegistry): ClassicAPIAdapter =>
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
    registry,
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
    classicEnergyApi(registry),
    defined(registry.devices.getById(1000)),
  )
  return facade.getEnergyReport(WINDOW)
})

describeEnergyReportContract('Classic ATW device', async () => {
  const registry = classicRegistry()
  const facade = new ClassicDeviceAtwFacade(
    classicEnergyApi(registry),
    defined(registry.devices.getById(1001)),
  )
  return facade.getEnergyReport(WINDOW)
})

const homeEnergyValues = [
  { time: '2026-03-01 06:00:00.000000000', value: '571.0' },
  { time: '2026-03-02 06:00:00.000000000', value: '229.0' },
]

const homeAtaEnergyResponse = ok(
  homeEnergyEnvelope(
    'cumulative_energy_consumed_since_last_upload',
    homeEnergyValues,
  ),
)

describeEnergyReportContract('Home ATA device', async () => {
  const facade = new HomeDeviceAtaFacade(
    createMockHomeApi({
      getAtaEnergy: vi
        .fn<HomeAPIAdapter['getAtaEnergy']>()
        .mockResolvedValue(homeAtaEnergyResponse),
      timezone: 'UTC',
    }),
    homeDevice({ id: 'contract-energy-ata' }),
  )
  return facade.getEnergyReport(WINDOW)
})

// The air-to-water wire is another endpoint altogether — one report
// carrying both directions, labelled on the unit's own clock.
const homeAtwEnergyPoints = [
  ['2026-03-01T00:00:00', 0.571],
  ['2026-03-02T00:00:00', 0.229],
] as const

const homeAtwEnergyResponse = ok([
  homeEnergyReport({
    interval_energy_consumed: homeAtwEnergyPoints,
    interval_energy_produced: homeAtwEnergyPoints,
  }),
])

describeEnergyReportContract('Home ATW device', async () => {
  const facade = new HomeDeviceAtwFacade(
    createMockHomeApi({
      getAtwEnergy: vi
        .fn<HomeAPIAdapter['getAtwEnergy']>()
        .mockResolvedValue(homeAtwEnergyResponse),
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
    const registry = classicRegistry()
    const api = classicEnergyApi(registry)
    const facade = new ClassicDeviceErvFacade(
      api,
      defined(registry.devices.getById(1002)),
    )
    const value = okValue(await facade.getEnergyReport(WINDOW))

    expect(value.series).toStrictEqual([])
    expect(value.unit).toBe('kWh')
    expect(api.getEnergy).not.toHaveBeenCalled()
  })

  it('refuses the raw energy read before any I/O', async () => {
    const registry = classicRegistry()
    const api = classicEnergyApi(registry)
    const facade = new ClassicDeviceErvFacade(
      api,
      defined(registry.devices.getById(1002)),
    )

    await expect(facade.getEnergy(WINDOW)).rejects.toThrow(
      'No energy report exists for this device type',
    )
    expect(api.getEnergy).not.toHaveBeenCalled()
  })
})
