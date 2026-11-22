import { cast, mockTemporalNowZoned } from '@olivierzal/api-core/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ReportChartLineOptions,
  ReportQuery,
} from '../../src/facades/report-types.ts'
import { ClassicOperationMode } from '../../src/constants.ts'
import { EntityNotFoundError, NoChangesError } from '../../src/errors/index.ts'
import { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import { Temporal } from '../../src/temporal.ts'
import { type HomeAtaDeviceCapabilities, ok } from '../../src/types/index.ts'
import { okValue, onHost } from '../helpers.ts'
import {
  createMockHomeApi,
  homeDevice,
  homeEnergyEnvelope,
  homeReportPoint,
  pruneHomeDevice,
  resetHomeDevices,
} from '../home-fixtures.ts'

const createModel = (
  settings: Record<string, string> = {},
  capabilities: Partial<HomeAtaDeviceCapabilities> = {},
  rssi = -50,
): ReturnType<typeof homeDevice> =>
  homeDevice({
    capabilities,
    id: 'device-1',
    name: 'Test ClassicDevice',
    rssi,
    settings,
  })

// Stage a consumption series behind the telemetry read and chart it
// over `range`: the mechanism the energy-report cases share, each
// pinning its own bucket-policy assertions at the call site. The series
// answers the FIRST chunk and an idle bundle every other one: a window
// is read in several requests, and one answer served to each would
// count its buckets once per chunk.
const chartEnergyReport = async (
  range: ReportQuery,
  values: Parameters<typeof homeEnergyEnvelope>[1],
  api: ReturnType<typeof createMockHomeApi> = createMockHomeApi(),
): Promise<ReportChartLineOptions> => {
  vi.mocked(api.getAtaEnergy)
    .mockResolvedValue(ok({ measureData: [] }))
    .mockResolvedValueOnce(
      ok(
        homeEnergyEnvelope(
          'cumulative_energy_consumed_since_last_upload',
          values,
        ),
      ),
    )
  const facade = new HomeDeviceAtaFacade(api, createModel())
  return okValue(await facade.getEnergyReport(range))
}

// The telemetry requests a read made, one `[from, to, interval]` per
// request in call order: a window is read chunk by chunk, and where the
// chunks fall is what the cases pin.
const requestedChunks = (
  api: ReturnType<typeof createMockHomeApi>,
): string[][] =>
  vi
    .mocked(api.getAtaEnergy)
    .mock.calls.map(([, { from, interval, to }]) => [from, to, interval])

describe('home device ata facade', () => {
  beforeEach(resetHomeDevices)

  // The raw wire flag, for comparison with the official app — never the
  // availability contract, which only flips after a day of `false`.
  describe('raw connectivity flag', () => {
    it('reads the wire flag verbatim, independently of availability', () => {
      const device = homeDevice({ id: 'device-1', isConnected: false })
      const facade = new HomeDeviceAtaFacade(createMockHomeApi(), device)

      expect(facade.isConnected).toBe(false)
      expect(facade.isAvailable).toBe(true)

      device.sync({ ...device.data, isConnected: true }, true, device.building)

      expect(facade.isConnected).toBe(true)
    })
  })

  describe('protection accessors', () => {
    it('keeps a freshly disconnected unit available within the persistence window', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        homeDevice({ id: 'device-1', isConnected: false }),
      )

      expect(facade.isAvailable).toBe(true)
    })

    it('reports the unit unavailable after a day of continuous disconnection, then clears on reconnect', () => {
      const device = homeDevice({ id: 'device-1', isConnected: false })
      const facade = new HomeDeviceAtaFacade(createMockHomeApi(), device)
      const later = Temporal.Now.plainDateTimeISO('UTC').add({ hours: 25 })
      const spy = vi
        .spyOn(Temporal.Now, 'plainDateTimeISO')
        .mockReturnValue(later)

      expect(facade.isAvailable).toBe(false)

      device.sync({ ...device.data, isConnected: true }, true, device.building)

      expect(facade.isAvailable).toBe(true)

      spy.mockRestore()
    })

    it('resolves the registry model by id, never a pinned snapshot', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        homeDevice({ id: 'device-1', isConnected: false }),
      )
      homeDevice({ id: 'device-1', isConnected: true })

      expect(facade.isAvailable).toBe(true)
    })

    it('reports existence and throws once the registry drops the id', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        homeDevice({ id: 'device-gone' }),
      )

      expect(facade.exists).toBe(true)

      pruneHomeDevice('device-gone')

      expect(facade.exists).toBe(false)
      expect(facade.id).toBe('device-gone')
      expect(() => facade.isAvailable).toThrow(EntityNotFoundError)
    })

    it('returns null when protection is not configured', async () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        homeDevice({ id: 'device-1' }),
      )

      expect(okValue(await facade.getFrostProtection())).toBeNull()
      expect(okValue(await facade.getHolidayMode())).toBeNull()
      expect(okValue(await facade.getOverheatProtection())).toBeNull()
    })
  })

  describe('settings accessors', () => {
    it('should read operation mode from settings', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        createModel({ OperationMode: 'Heat' }),
      )

      expect(facade.operationMode).toBe('Heat')
    })

    it('should read power as boolean', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        createModel({ Power: 'True' }),
      )

      expect(facade.power).toBe(true)
    })

    it('should read standby as boolean', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        createModel({ InStandbyMode: 'True', Power: 'True' }),
      )

      expect(facade.inStandbyMode).toBe(true)
    })

    it('should read temperatures as numbers', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        createModel({ RoomTemperature: '21.5', SetTemperature: '20' }),
      )

      expect(facade.roomTemperature).toBe(21.5)
      expect(facade.setTemperature).toBe(20)
    })

    it('should read fan speed and vane directions from settings', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        createModel({
          SetFanSpeed: 'Auto',
          VaneHorizontalDirection: 'Centre',
          VaneVerticalDirection: 'Swing',
        }),
      )

      expect(facade.setFanSpeed).toBe('Auto')
      expect(facade.vaneHorizontalDirection).toBe('Centre')
      expect(facade.vaneVerticalDirection).toBe('Swing')
    })

    it('should normalize numeric fan speed string from Home API', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        createModel({ SetFanSpeed: '0' }),
      )

      expect(facade.setFanSpeed).toBe('Auto')
    })

    it('should read rssi from device data', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        createModel({}, {}, -42),
      )

      expect(facade.rssi).toBe(-42)
    })

    it('should return defaults for missing settings', () => {
      const facade = new HomeDeviceAtaFacade(createMockHomeApi(), createModel())

      expect(facade.operationMode).toBe('')
      expect(facade.power).toBe(false)
      expect(facade.roomTemperature).toBe(0)
      expect(facade.setFanSpeed).toBe('Auto')
      expect(facade.vaneHorizontalDirection).toBe('')
      expect(facade.vaneVerticalDirection).toBe('')
    })

    it('should read device name', () => {
      const facade = new HomeDeviceAtaFacade(createMockHomeApi(), createModel())

      expect(facade.name).toBe('Test ClassicDevice')
    })

    it('should expose device capabilities', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        createModel({}, { minTempHeat: 8 }),
      )

      expect(facade.capabilities.minTempHeat).toBe(8)
    })
  })

  describe('updateValues validation', () => {
    it('should throw on empty values', async () => {
      const facade = new HomeDeviceAtaFacade(createMockHomeApi(), createModel())

      await expect(facade.updateValues({})).rejects.toThrow(
        new NoChangesError('device-1'),
      )
    })

    it('should treat explicitly-undefined values as absent', async () => {
      const facade = new HomeDeviceAtaFacade(createMockHomeApi(), createModel())

      await expect(
        facade.updateValues(cast({ setTemperature: undefined })),
      ).rejects.toThrow(new NoChangesError('device-1'))
    })

    it('should drop undefined-valued keys before forwarding', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(api, createModel())

      await facade.updateValues(
        cast({ power: true, setTemperature: undefined }),
      )

      expect(vi.mocked(api.updateValues).mock.lastCall?.[1]).toStrictEqual({
        power: true,
      })
    })
  })

  describe('updatePower', () => {
    it('forwards a power-only payload, defaulting to on', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(api, createModel())

      await facade.updatePower()

      expect(api.updateValues).toHaveBeenCalledWith('device-1', { power: true })
    })

    it('powers off when passed false', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(api, createModel())

      await facade.updatePower(false)

      expect(api.updateValues).toHaveBeenCalledWith('device-1', {
        power: false,
      })
    })
  })

  describe('temperature range and step', () => {
    it('should read the per-mode range from the device capabilities', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        createModel(
          { OperationMode: 'Heat' },
          { maxTempHeat: 31, minTempHeat: 10 },
        ),
      )

      expect(facade.getTemperatureRange()).toStrictEqual({ max: 31, min: 10 })

      expect(facade.getTemperatureRange('Cool')).toStrictEqual({
        max: 31,
        min: 16,
      })

      // The cross-dialect widening: a Classic numeric mode resolves
      // through the total bijection to the same range as its Home twin,
      // and an out-of-vocabulary number degrades to no-clamp.
      expect(
        facade.getTemperatureRange(ClassicOperationMode.cool),
      ).toStrictEqual({ max: 31, min: 16 })
      expect(facade.getTemperatureRange(cast(99))).toBeNull()

      expect(facade.getTemperatureRange(cast('Unknown'))).toBeNull()
    })

    // Mutation guard: the range follows the dialect fixture, so a bound
    // changed at the source changes what consumers render.
    it('should follow the advertised bounds', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        createModel(
          { OperationMode: 'Heat' },
          { maxTempHeat: 28, minTempHeat: 12 },
        ),
      )

      expect(facade.getTemperatureRange()).toStrictEqual({ max: 28, min: 12 })
    })

    it('should step by a half degree when the unit advertises it', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        createModel({}, { hasHalfDegreeIncrements: true }),
      )

      expect(facade.temperatureStep).toBe(0.5)
    })

    it('should step by a whole degree otherwise', () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        createModel({}, { hasHalfDegreeIncrements: false }),
      )

      expect(facade.temperatureStep).toBe(1)
    })
  })

  describe('temperature clamping', () => {
    it('should clamp temperature to heat range', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(
        api,
        createModel(
          { OperationMode: 'Heat' },
          { maxTempHeat: 31, minTempHeat: 10 },
        ),
      )
      await facade.updateValues({ setTemperature: 5 })

      expect(api.updateValues).toHaveBeenCalledWith('device-1', {
        setTemperature: 10,
      })
    })

    it('should clamp temperature to cool range', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(
        api,
        createModel(
          { OperationMode: 'Cool' },
          { maxTempCoolDry: 31, minTempCoolDry: 16 },
        ),
      )
      await facade.updateValues({ setTemperature: 35 })

      expect(api.updateValues).toHaveBeenCalledWith('device-1', {
        setTemperature: 31,
      })
    })

    it('should clamp temperature to automatic range', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(
        api,
        createModel(
          { OperationMode: 'Automatic' },
          { maxTempAutomatic: 31, minTempAutomatic: 16 },
        ),
      )
      await facade.updateValues({ setTemperature: 10 })

      expect(api.updateValues).toHaveBeenCalledWith('device-1', {
        setTemperature: 16,
      })
    })

    it('should clamp temperature to dry range', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(
        api,
        createModel(
          { OperationMode: 'Dry' },
          { maxTempCoolDry: 31, minTempCoolDry: 16 },
        ),
      )
      await facade.updateValues({ setTemperature: 10 })

      expect(api.updateValues).toHaveBeenCalledWith('device-1', {
        setTemperature: 16,
      })
    })

    it('should use requested operation mode for clamping when changing both', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(
        api,
        createModel(
          { OperationMode: 'Heat' },
          { maxTempCoolDry: 31, minTempCoolDry: 16 },
        ),
      )
      await facade.updateValues({ operationMode: 'Cool', setTemperature: 10 })

      expect(api.updateValues).toHaveBeenCalledWith('device-1', {
        operationMode: 'Cool',
        setTemperature: 16,
      })
    })

    it('should pass through temperature when no clamping needed', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(
        api,
        createModel({ OperationMode: 'Heat' }),
      )
      await facade.updateValues({ setTemperature: 21 })

      expect(api.updateValues).toHaveBeenCalledWith('device-1', {
        setTemperature: 21,
      })
    })

    it('should not modify values without temperature', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(
        api,
        createModel({ OperationMode: 'Heat' }),
      )
      await facade.updateValues({ power: true })

      expect(api.updateValues).toHaveBeenCalledWith('device-1', { power: true })
    })

    it('should pass through temperature for unknown operation mode', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(
        api,
        createModel({ OperationMode: '' }),
      )
      await facade.updateValues({ setTemperature: 5 })

      expect(api.updateValues).toHaveBeenCalledWith('device-1', {
        setTemperature: 5,
      })
    })
  })

  describe('api delegation', () => {
    it('should delegate getEnergy to the telemetry read with device id', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(api, createModel())
      const params = { from: '2026-03-01', interval: 'Day', to: '2026-03-02' }
      await facade.getEnergy(params)

      expect(api.getAtaEnergy).toHaveBeenCalledWith('device-1', params)
    })

    it('normalizes the hourly energy series to kWh from the ATA watt-hour wire', async () => {
      const api = createMockHomeApi()
      vi.mocked(api.getAtaEnergy).mockResolvedValue(
        ok(
          homeEnergyEnvelope('cumulative_energy_consumed_since_last_upload', [
            { time: '2026-07-18 07:00:00.000000000', value: '571.0' },
          ]),
        ),
      )
      const facade = new HomeDeviceAtaFacade(api, createModel())

      const series = okValue(
        await facade.getEnergySeries({
          from: '2026-07-18T00:00:00Z',
          to: '2026-07-19T00:00:00Z',
        }),
      )

      expect(api.getAtaEnergy).toHaveBeenCalledExactlyOnceWith('device-1', {
        from: '2026-07-18T00:00:00Z',
        interval: 'Hour',
        to: '2026-07-19T00:00:00Z',
      })
      // The live-probed bucket: `571.0` watt-hours is 0.571 kWh.
      expect(series).toStrictEqual({
        consumed: [
          {
            atEpochMs: Temporal.Instant.from('2026-07-18T07:00:00Z')
              .epochMilliseconds,
            kilowattHours: 0.571,
          },
        ],
      })
    })

    // The wire no longer applies `to` (live-probed 2026-11-21): a
    // one-hour window a day old came back with the 24 buckets that
    // follow its `from`. The series stops where its window does.
    it('drops the buckets the wire answers past the window', async () => {
      const api = createMockHomeApi()
      vi.mocked(api.getAtaEnergy).mockResolvedValue(
        ok(
          homeEnergyEnvelope(
            'cumulative_energy_consumed_since_last_upload',
            ['05', '06', '07', '08'].map((hour) => ({
              time: `2026-07-18 ${hour}:00:00.000000000`,
              value: '100.0',
            })),
          ),
        ),
      )
      const facade = new HomeDeviceAtaFacade(api, createModel())

      const { consumed } = okValue(
        await facade.getEnergySeries({
          from: '2026-07-18T05:20:00Z',
          to: '2026-07-18T07:00:00Z',
        }),
      )

      // The 05:00 bucket holds the start; the 07:00 one starts on the
      // end, which is exclusive.
      expect(consumed.map(({ atEpochMs }) => atEpochMs)).toStrictEqual(
        ['2026-07-18T05:00:00Z', '2026-07-18T06:00:00Z'].map(
          (instant) => Temporal.Instant.from(instant).epochMilliseconds,
        ),
      )
    })

    // The wire does not apply `to` today. It did before it was
    // narrowed, to the minute, and may again: a window that ends inside
    // a bucket is asked up to the end of that bucket, where a bound cut
    // to the minute would leave out the bucket that starts on it.
    it('asks up to the end of the bucket that holds the end of the window', async () => {
      const api = createMockHomeApi()
      vi.mocked(api.getAtaEnergy).mockResolvedValue(
        ok(
          homeEnergyEnvelope('cumulative_energy_consumed_since_last_upload', [
            { time: '2026-07-18 17:00:00.000000000', value: '900.0' },
            { time: '2026-07-18 18:00:00.000000000', value: '100.0' },
          ]),
        ),
      )
      const facade = new HomeDeviceAtaFacade(api, createModel())

      const { consumed } = okValue(
        await facade.getEnergySeries({
          from: '2026-07-18T16:00:00Z',
          to: '2026-07-18T17:00:05Z',
        }),
      )

      expect(requestedChunks(api)).toStrictEqual([
        ['2026-07-18T16:00:00Z', '2026-07-18T18:00:00Z', 'Hour'],
      ])
      // The 17:00 bucket started five seconds before the end and is the
      // window's; the 18:00 one, which the widened bound lets in, is not.
      expect(consumed.map(({ kilowattHours }) => kilowattHours)).toStrictEqual([
        0.9,
      ])
    })

    it.each([
      { shape: 'an empty', to: '2026-07-18T10:30:00Z' },
      { shape: 'an inverted', to: '2026-07-18T09:00:00Z' },
    ])('answers $shape window without a request', async ({ to }) => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(api, createModel())

      await expect(
        facade.getEnergySeries({ from: '2026-07-18T10:30:00Z', to }),
      ).resolves.toStrictEqual(ok({ consumed: [] }))
      expect(api.getAtaEnergy).not.toHaveBeenCalled()
    })

    // An hourly response carries the 24 buckets that follow `from` and
    // no more (live-probed 2026-11-21): a longer window is read chunk
    // by chunk, from the hour that holds `from` — a start inside an hour
    // does not answer that hour whole.
    it('reads a window longer than a day in 24-hour chunks, oldest first', async () => {
      const api = createMockHomeApi()
      vi.mocked(api.getAtaEnergy)
        .mockResolvedValueOnce(
          ok(
            homeEnergyEnvelope('cumulative_energy_consumed_since_last_upload', [
              { time: '2026-07-18 06:00:00.000000000', value: '100.0' },
            ]),
          ),
        )
        .mockResolvedValueOnce(
          ok(
            homeEnergyEnvelope('cumulative_energy_consumed_since_last_upload', [
              { time: '2026-07-19 07:00:00.000000000', value: '200.0' },
            ]),
          ),
        )
      const facade = new HomeDeviceAtaFacade(api, createModel())

      const { consumed } = okValue(
        await facade.getEnergySeries({
          from: '2026-07-18T06:38:00Z',
          to: '2026-07-19T08:00:00Z',
        }),
      )

      expect(requestedChunks(api)).toStrictEqual([
        ['2026-07-18T06:00:00Z', '2026-07-19T06:00:00Z', 'Hour'],
        ['2026-07-19T06:00:00Z', '2026-07-19T08:00:00Z', 'Hour'],
      ])
      expect(consumed.map(({ kilowattHours }) => kilowattHours)).toStrictEqual([
        0.1, 0.2,
      ])
    })

    it('answers the failure of a chunk for the whole series', async () => {
      const api = createMockHomeApi()
      const failure = { error: { kind: 'server' as const }, ok: false as const }
      vi.mocked(api.getAtaEnergy)
        .mockResolvedValueOnce(ok({ measureData: [] }))
        .mockResolvedValueOnce(cast(failure))
      const facade = new HomeDeviceAtaFacade(api, createModel())

      await expect(
        facade.getEnergySeries({
          from: '2026-07-18T00:00:00Z',
          to: '2026-07-19T12:00:00Z',
        }),
      ).resolves.toBe(failure)
    })

    it('flattens every measure series of the bundle in wire order', async () => {
      const api = createMockHomeApi()
      vi.mocked(api.getAtaEnergy).mockResolvedValue(
        ok({
          measureData: [
            {
              type: 'cumulative_energy_consumed_since_last_upload',
              values: [{ time: '2026-07-18 07:00:00.000000000', value: '100' }],
            },
            {
              type: 'cumulative_energy_consumed_since_last_upload',
              values: [{ time: '2026-07-18 06:00:00.000000000', value: '200' }],
            },
          ],
        }),
      )
      const facade = new HomeDeviceAtaFacade(api, createModel())

      const { consumed } = okValue(
        await facade.getEnergySeries({
          from: '2026-07-18T00:00:00Z',
          to: '2026-07-19T00:00:00Z',
        }),
      )

      expect(consumed.map(({ kilowattHours }) => kilowattHours)).toStrictEqual([
        0.1, 0.2,
      ])
    })

    it.each([
      {
        nulledField: 'atEpochMs',
        point: { time: 'not-a-date', value: '100' },
        reason: 'a garbled stamp',
      },
      {
        nulledField: 'kilowattHours',
        point: { time: '2026-07-18 07:00:00.000000000', value: 'garbage' },
        reason: 'a garbled value',
      },
      {
        nulledField: 'kilowattHours',
        point: { time: '2026-07-18 07:00:00.000000000', value: ' ' },
        reason: 'an empty value',
      },
    ] as const)(
      'degrades $reason to null and keeps the entry',
      async ({ nulledField, point }) => {
        const api = createMockHomeApi()
        vi.mocked(api.getAtaEnergy).mockResolvedValue(
          ok(
            homeEnergyEnvelope('cumulative_energy_consumed_since_last_upload', [
              point,
            ]),
          ),
        )
        const facade = new HomeDeviceAtaFacade(api, createModel())

        const { consumed } = okValue(
          await facade.getEnergySeries({
            from: '2026-07-18T00:00:00Z',
            to: '2026-07-19T00:00:00Z',
          }),
        )

        expect(consumed).toHaveLength(1)
        expect(consumed[0]?.[nulledField]).toBeNull()
      },
    )

    it('delegates the protection writes with its own ATA unit bucket', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(api, createModel())

      await facade.updateFrostProtection({ isEnabled: true, max: 20, min: 2 })
      await facade.updateHolidayMode({
        endDate: '2026-08-05T00:00:00',
        isEnabled: false,
        startDate: '2026-08-01T00:00:00',
      })
      await facade.updateOverheatProtection({
        isEnabled: true,
        max: 37,
        min: 35,
      })

      expect(api.updateFrostProtection).toHaveBeenCalledWith({
        enabled: true,
        max: 16,
        min: 4,
        units: { ATA: ['device-1'] },
      })
      expect(api.updateHolidayMode).toHaveBeenCalledWith({
        enabled: false,
        endDate: '2026-08-05T00:00:00',
        startDate: '2026-08-01T00:00:00',
        units: { ATA: ['device-1'] },
      })
      expect(api.updateOverheatProtection).toHaveBeenCalledWith({
        enabled: true,
        max: 37,
        min: 35,
        units: { ATA: ['device-1'] },
      })
      expect(facade.supportsOverheat).toBe(true)
    })

    // A window of the far future needs no clock: nothing about it
    // depends on when the suite runs.
    it("writes an enabled holiday window on the unit's own clock", async () => {
      const api = createMockHomeApi({ timezone: 'Europe/Paris' })
      const facade = new HomeDeviceAtaFacade(
        api,
        homeDevice({ id: 'device-1', timeZone: 'Europe/London' }),
      )

      await facade.updateHolidayMode({
        endDate: '2099-08-05T00:00:00',
        isEnabled: true,
        startDate: '2099-08-01T00:00:00',
      })

      // Midnight in Paris is 23:00 the day before in London.
      expect(api.updateHolidayMode).toHaveBeenCalledExactlyOnceWith({
        enabled: true,
        endDate: '2099-08-04T23:00:00',
        startDate: '2099-07-31T23:00:00',
        units: { ATA: ['device-1'] },
      })
    })

    // The host sits in Tokyo, which is never on UTC, and the unit in
    // Paris: neither a read on UTC nor one on the unit's own clock
    // gives the caller's.
    it("reads a holiday window back on the host's clock when the API names none", async () => {
      const facade = new HomeDeviceAtaFacade(
        createMockHomeApi(),
        homeDevice({
          holidayMode: {
            enabled: true,
            endDate: '2099-08-05T00:00:00',
            startDate: '2099-08-01T00:00:00',
          },
          id: 'device-1',
          timeZone: 'Europe/Paris',
        }),
      )

      // Midnight in a Paris summer is 07:00 in Tokyo.
      await expect(
        onHost('Asia/Tokyo', async () => facade.getHolidayMode()),
      ).resolves.toStrictEqual({
        ok: true,
        value: {
          endDate: '2099-08-05T07:00:00',
          isEnabled: true,
          startDate: '2099-08-01T07:00:00',
        },
      })
    })

    it('refuses to enable holiday mode on a unit the registry no longer holds', async () => {
      const api = createMockHomeApi({ timezone: 'Europe/Paris' })
      const facade = new HomeDeviceAtaFacade(api, createModel())
      pruneHomeDevice('device-1')

      // The window is written on the unit's clock, which only the
      // registry's model tells.
      await expect(
        facade.updateHolidayMode({
          endDate: '2099-08-05T00:00:00',
          isEnabled: true,
          startDate: '2099-08-01T00:00:00',
        }),
      ).rejects.toThrow(EntityNotFoundError)
      expect(api.updateHolidayMode).not.toHaveBeenCalled()
    })

    it('still disables holiday mode on a unit the registry no longer holds', async () => {
      const api = createMockHomeApi({ timezone: 'Europe/Paris' })
      const facade = new HomeDeviceAtaFacade(api, createModel())
      pruneHomeDevice('device-1')

      await facade.updateHolidayMode({
        endDate: '2099-08-05T00:00:00',
        isEnabled: false,
        startDate: '2099-08-01T00:00:00',
      })

      expect(api.updateHolidayMode).toHaveBeenCalledExactlyOnceWith({
        enabled: false,
        endDate: '2099-08-05T00:00:00',
        startDate: '2099-08-01T00:00:00',
        units: { ATA: ['device-1'] },
      })
    })

    it('should delegate getErrorLog and project the neutral entries', async () => {
      const api = createMockHomeApi()
      vi.mocked(api.getErrorLog).mockResolvedValue(
        ok([
          {
            clearedTimestamp: null,
            errorCode: 'E202',
            errorReason: 'Communication error',
            timestamp: '2026-03-01T06:00:00Z',
          },
        ]),
      )
      const facade = new HomeDeviceAtaFacade(api, createModel())
      const value = okValue(await facade.getErrorLog())

      expect(api.getErrorLog).toHaveBeenCalledWith('device-1')
      expect(value).toStrictEqual([
        {
          at: '2026-03-01T06:00:00Z',
          atEpochMs: Temporal.Instant.from('2026-03-01T06:00:00Z')
            .epochMilliseconds,
          code: 'E202',
          deviceId: 'device-1',
          message: 'Communication error',
        },
      ])
    })

    it('should delegate getSignal with device id', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(api, createModel())
      const params = { from: '2026-03-01', to: '2026-03-02' }
      await facade.getSignal(params)

      expect(api.getSignal).toHaveBeenCalledWith('device-1', params)
    })

    it('builds the temperature chart from the trend-summary report', async () => {
      const api = createMockHomeApi()
      vi.mocked(api.getTemperatures).mockResolvedValue(
        ok([
          {
            datasets: [
              {
                data: [homeReportPoint('2026-03-01T01:00:00', 21)],
                id: 'room_temperature',
                label: 'ignored',
              },
            ],
            reportPeriod: 'hourly',
          },
        ]),
      )
      const facade = new HomeDeviceAtaFacade(api, createModel())

      const value = okValue(
        await facade.getTemperatures({
          from: '2026-03-01T00:00:00Z',
          to: '2026-03-02T00:00:00Z',
        }),
      )

      expect(api.getTemperatures).toHaveBeenCalledWith('device-1', {
        from: '2026-03-01T00:00:00Z',
        period: 'Hourly',
        to: '2026-03-02T00:00:00Z',
      })
      expect(value.unit).toBe('°C')
      expect(value.labels).toHaveLength(25)
      expect(value.series[0]?.name).toBe('RoomTemperature')
      // The report stamps its samples on the unit's own clock: 01:00 in
      // Paris is 00:00 UTC, the first slot of this UTC day. Read as UTC
      // it would chart an hour late.
      expect(value.series[0]?.data.slice(0, 2)).toStrictEqual([21, 21])
    })

    // The unit's zone lives on its registry model: an id the registry
    // dropped has no clock to read the report on.
    it('answers not-found for a report of an id the registry no longer holds', async () => {
      const api = createMockHomeApi()
      const facade = new HomeDeviceAtaFacade(api, createModel())
      pruneHomeDevice('device-1')

      await expect(facade.getTemperatures()).resolves.toStrictEqual({
        error: { entityId: 'device-1', kind: 'not-found' },
        ok: false,
      })
      expect(api.getTemperatures).not.toHaveBeenCalled()
    })

    it('propagates a trend-summary failure untouched', async () => {
      const api = createMockHomeApi()
      const failure = { ok: false as const, status: 500 }
      vi.mocked(api.getTemperatures).mockResolvedValue(cast(failure))
      const facade = new HomeDeviceAtaFacade(api, createModel())

      await expect(facade.getTemperatures()).resolves.toBe(failure)
    })

    it('charts a multi-day energy report in local-day kWh buckets', async () => {
      const api = createMockHomeApi()
      const value = await chartEnergyReport(
        { from: '2026-03-01T00:00:00Z', to: '2026-03-03T00:00:00Z' },
        [{ time: '2026-03-01 00:00:00.000000000', value: '571.0' }],
        api,
      )

      // Up to a week, day buckets aggregate hourly wire buckets per
      // display-timezone calendar day, read one day per request.
      expect(requestedChunks(api)).toStrictEqual([
        ['2026-03-01T00:00:00Z', '2026-03-02T00:00:00Z', 'Hour'],
        ['2026-03-02T00:00:00Z', '2026-03-03T00:00:00Z', 'Hour'],
      ])
      expect(value.unit).toBe('kWh')
      expect(value.series[0]?.name).toBe('Consumed')
      expect(value.series[0]?.data[0]).toBeCloseTo(0.571)
    })

    it('lands evening UTC buckets on the next local calendar day', async () => {
      const value = await chartEnergyReport(
        { from: '2026-02-28T23:00:00Z', to: '2026-03-02T22:00:00Z' },
        // 23:30 UTC = 00:30 the next day in winter Paris time.
        [{ time: '2026-03-01 23:30:00.000000000', value: '100.0' }],
        // Pin the label locale: the runner's default is not ours.
        createMockHomeApi({ locale: 'fr-FR', timezone: 'Europe/Paris' }),
      )

      expect(value.labels).toStrictEqual(['1 mars', '2 mars'])
      expect(value.series[0]?.data).toStrictEqual([0, 0.1])
    })

    // The hour buckets a response carries past `to` are not the
    // window's: summed into days, they would fill the last bar with
    // hours nobody asked for.
    it('sums into a day only the hours its window holds', async () => {
      const api = createMockHomeApi()
      vi.mocked(api.getAtaEnergy)
        .mockResolvedValueOnce(ok({ measureData: [] }))
        .mockResolvedValueOnce(
          ok(
            homeEnergyEnvelope('cumulative_energy_consumed_since_last_upload', [
              { time: '2026-03-02 10:00:00.000000000', value: '500.0' },
              { time: '2026-03-02 20:00:00.000000000', value: '250.0' },
            ]),
          ),
        )
      const facade = new HomeDeviceAtaFacade(api, createModel())

      const value = okValue(
        await facade.getEnergyReport({
          from: '2026-03-01T00:00:00Z',
          to: '2026-03-02T18:00:00Z',
        }),
      )

      expect(value.series[0]?.data).toStrictEqual([0, 0.5])
    })

    it('switches a one-day energy report to hourly buckets', async () => {
      const api = createMockHomeApi()
      const value = await chartEnergyReport(
        { from: '2026-03-01T00:00:00Z', to: '2026-03-02T00:00:00Z' },
        [{ time: '2026-03-01 09:00:00.000000000', value: '200.0' }],
        api,
      )

      // One day: hourly wire buckets, matching the Classic report.
      expect(api.getAtaEnergy).toHaveBeenCalledExactlyOnceWith('device-1', {
        from: '2026-03-01T00:00:00Z',
        interval: 'Hour',
        to: '2026-03-02T00:00:00Z',
      })
      expect(value.labels).toHaveLength(25)
      expect(value.series[0]?.data[9]).toBeCloseTo(0.2)
    })

    // The grain follows the span asked for, never the time of day. A
    // host that anchors its "2 days" on local midnight asks for one to
    // two days: with the cutoff at a day and a half, that one choice
    // charted hours before noon and days after.
    it.each([
      { to: '2026-03-02T08:00:00Z', what: 'before noon' },
      { to: '2026-03-02T14:00:00Z', what: 'after noon' },
    ])(
      'charts a window opened on the midnight before in days, $what',
      async ({ to }) => {
        const value = await chartEnergyReport(
          { from: '2026-02-28T23:00:00Z', to },
          [{ time: '2026-03-01 09:00:00.000000000', value: '200.0' }],
          createMockHomeApi({ locale: 'fr-FR', timezone: 'Europe/Paris' }),
        )

        expect(value.labels).toStrictEqual(['1 mars', '2 mars'])
      },
    )

    it('charts a garbled energy as an idle bucket', async () => {
      const value = await chartEnergyReport(
        { from: '2026-03-01T00:00:00Z', to: '2026-03-02T00:00:00Z' },
        [
          { time: 'not-a-date', value: '300.0' },
          { time: '2026-03-01 09:00:00.000000000', value: 'garbage' },
        ],
      )

      expect(value.series[0]?.data.every((energy) => energy === 0)).toBe(true)
    })

    // Beyond a week the wire's own UTC day buckets are charted, asked
    // 30 days at a time from the midnight that holds `from`: the wire
    // answered a month whole and three months empty (live-probed
    // 2026-11-21).
    it('reads a window beyond a week in 30-day chunks of day buckets', async () => {
      const api = createMockHomeApi()
      const value = await chartEnergyReport(
        { from: '2026-01-01T08:00:00Z', to: '2026-03-01T00:00:00Z' },
        [{ time: '2026-01-02 00:00:00.000000000', value: '1500.0' }],
        api,
      )

      expect(requestedChunks(api)).toStrictEqual([
        ['2026-01-01T00:00:00Z', '2026-01-31T00:00:00Z', 'Day'],
        ['2026-01-31T00:00:00Z', '2026-03-01T00:00:00Z', 'Day'],
      ])
      expect(value.labels).toHaveLength(60)
      expect(value.series[0]?.data.slice(0, 3)).toStrictEqual([0, 1.5, 0])
    })

    // A `Day` response runs 31 days from `from` whatever `to` says
    // (live-probed 2026-11-21): the day two 30-day chunks meet on is
    // answered by both, and charted once.
    it('charts once a bucket two chunks both answer', async () => {
      const api = createMockHomeApi()
      const boundaryDay = {
        time: '2026-01-31 00:00:00.000000000',
        value: '3700.0',
      }
      vi.mocked(api.getAtaEnergy)
        .mockResolvedValueOnce(
          ok(
            homeEnergyEnvelope('cumulative_energy_consumed_since_last_upload', [
              { time: '2026-01-30 00:00:00.000000000', value: '1000.0' },
              boundaryDay,
            ]),
          ),
        )
        .mockResolvedValueOnce(
          ok(
            homeEnergyEnvelope('cumulative_energy_consumed_since_last_upload', [
              boundaryDay,
              { time: '2026-02-01 00:00:00.000000000', value: '4000.0' },
            ]),
          ),
        )
      const facade = new HomeDeviceAtaFacade(api, createModel())

      const value = okValue(
        await facade.getEnergyReport({
          from: '2026-01-01T00:00:00Z',
          to: '2026-03-01T00:00:00Z',
        }),
      )

      // 30 January, 31 January, 1 February.
      expect(value.series[0]?.data.slice(29, 32)).toStrictEqual([1, 3.7, 4])
    })

    // The caller stamps `from` a beat before the library stamps `to`:
    // the window stays on hour buckets, and the hour `to` falls in is
    // the second chunk's, asked whole.
    it('keeps a one-day window drifting by milliseconds on hour buckets', async () => {
      const api = createMockHomeApi()
      vi.mocked(api.getAtaEnergy).mockResolvedValue(ok({ measureData: [] }))
      const facade = new HomeDeviceAtaFacade(api, createModel())

      okValue(
        await facade.getEnergyReport({
          from: '2026-03-01T00:00:00Z',
          to: '2026-03-02T00:00:00.250Z',
        }),
      )

      expect(requestedChunks(api)).toStrictEqual([
        ['2026-03-01T00:00:00Z', '2026-03-02T00:00:00Z', 'Hour'],
        ['2026-03-02T00:00:00Z', '2026-03-02T01:00:00Z', 'Hour'],
      ])
    })
  })

  describe('signal chart', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(
        Temporal.Instant.from('2026-03-01T12:00:00Z').epochMilliseconds,
      )
      mockTemporalNowZoned()
    })

    afterEach(() => {
      vi.mocked(Temporal.Now.zonedDateTimeISO).mockRestore()
      vi.useRealTimers()
    })

    it('builds the signal chart over the requested hour', async () => {
      const api = createMockHomeApi()
      vi.mocked(api.getSignal).mockResolvedValue(
        ok(
          homeEnergyEnvelope('rssi', [
            { time: '2026-03-01 09:05:00.000000000', value: '-66' },
          ]),
        ),
      )
      const facade = new HomeDeviceAtaFacade(api, createModel())

      const value = okValue(await facade.getSignalStrength(9))

      expect(api.getSignal).toHaveBeenCalledWith('device-1', {
        from: '2026-03-01T09:00:00Z',
        to: '2026-03-01T10:00:00Z',
      })
      expect(value.unit).toBe('dBm')
      expect(value.labels).toHaveLength(61)
      expect(value.series[0]?.name).toBe('Test ClassicDevice')
      expect(value.series[0]?.data.at(-1)).toBe(-66)
    })

    it('covers today on a five-minute grid when no hour is given', async () => {
      const api = createMockHomeApi()
      vi.mocked(api.getSignal).mockResolvedValue(
        ok(
          homeEnergyEnvelope('rssi', [
            { time: '2026-03-01 00:02:00.000000000', value: '-70' },
          ]),
        ),
      )
      const facade = new HomeDeviceAtaFacade(api, createModel())

      const value = okValue(await facade.getSignalStrength())

      // Pinned to 12:00 UTC: the whole day on 5-minute slots, blank
      // after now.
      expect(api.getSignal).toHaveBeenCalledWith('device-1', {
        from: '2026-03-01T00:00:00Z',
        to: '2026-03-02T00:00:00Z',
      })
      expect(value.labels).toHaveLength(289)
      expect(value.series[0]?.data[1]).toBe(-70)
      expect(value.series[0]?.data[144]).toBe(-70)
      expect(value.series[0]?.data[145]).toBeNull()
      expect(value.series[0]?.data.at(-1)).toBeNull()
    })
  })
})
