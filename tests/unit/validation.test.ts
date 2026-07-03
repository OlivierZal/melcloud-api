import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { ClassicDeviceType } from '../../src/constants.ts'
import { ValidationError } from '../../src/errors/index.ts'
import {
  ClassicBuildingListSchema,
  ClassicEnergyDataAtaSchema,
  ClassicEnergyDataAtwSchema,
  ClassicEnergyDataSchema,
  ClassicLoginDataSchema,
  HomeContextSchema,
  HomeTokenResponseSchema,
  parseOrThrow,
} from '../../src/validation/index.ts'
import {
  defaultHomeAtaCapabilities,
  defaultHomeAtwCapabilities,
} from '../home-fixtures.ts'

const buildingWithDeviceType = (type: unknown): unknown => [
  {
    ID: 1,
    Name: 'B1',
    Structure: {
      Areas: [],
      Devices: [
        {
          AreaID: null,
          BuildingID: 1,
          Device: {},
          DeviceID: 1,
          DeviceName: 'D1',
          FloorID: null,
          Type: type,
        },
      ],
      Floors: [],
    },
  },
]

const baseCommonDeviceFields = {
  displayIcon: 'Office',
  frostProtection: null,
  givenDisplayName: 'D',
  holidayMode: null,
  id: 'd1',
  isConnected: true,
  isInError: false,
  overheatProtection: null,
  rssi: -42,
  schedule: [],
  scheduleEnabled: false,
  settings: [],
  timeZone: 'UTC',
}
const baseHomeAtaDevice = {
  ...baseCommonDeviceFields,
  connectedInterfaceIdentifier: 'mac',
  connectedInterfaceType: 'fourthGenWifi',
  systemId: null,
  unitSettings: null,
}
const baseHomeAtwDevice = {
  ...baseCommonDeviceFields,
  ftcModel: 'ftC6',
  macAddress: 'mac',
}
const baseHomeBuilding = {
  airToAirUnits: [],
  airToWaterUnits: [],
  id: 'b1',
  name: 'B',
  timezone: 'UTC',
}
const validClassicEnergyAta = {
  Auto: [0, 0.5, 1],
  Cooling: [0, 0.5, 1],
  Dry: [0, 0.5, 1],
  Fan: [0, 0.5, 1],
  Heating: [0, 0.5, 1],
  Other: [0, 0.5, 1],
  TotalAutoConsumed: 1.5,
  TotalCoolingConsumed: 1.5,
  TotalDryConsumed: 1.5,
  TotalFanConsumed: 1.5,
  TotalHeatingConsumed: 1.5,
  TotalOtherConsumed: 1.5,
  UsageDisclaimerPercentages: '100, 100',
}
const validClassicEnergyAtw = {
  CoP: [2.5, 3.1],
  TotalCoolingConsumed: 0,
  TotalCoolingProduced: 0,
  TotalHeatingConsumed: 10.2,
  TotalHeatingProduced: 30.4,
  TotalHotWaterConsumed: 5.1,
  TotalHotWaterProduced: 12.3,
}

// Drops the key entirely — unlike spreading `{ key: undefined }`, which
// leaves a present-but-undefined property that JSON payloads never carry.
const omitKey = (
  payload: Record<string, unknown>,
  key: string,
): Record<string, unknown> =>
  Object.fromEntries(Object.entries(payload).filter(([name]) => name !== key))

const buildHomeContext = (overrides: Record<string, unknown>): unknown => ({
  buildings: [],
  country: 'FR',
  email: 'a@b',
  firstname: 'A',
  guestBuildings: [],
  id: 'u1',
  language: 'en',
  lastname: 'B',
  numberOfBuildingsAllowed: 2,
  numberOfDevicesAllowed: 10,
  numberOfGuestDevicesAllowed: 10,
  numberOfGuestUsersAllowedPerUnit: 5,
  scenes: [],
  ...overrides,
})

describe('validation/schemas', () => {
  describe(parseOrThrow, () => {
    it('returns parsed data on success', () => {
      const result = parseOrThrow(
        z.object({ value: z.number() }),
        { value: 1 },
        'ctx',
      )

      expect(result).toStrictEqual({ value: 1 })
    })

    it('throws a ValidationError whose message interpolates the context', () => {
      expect(() =>
        parseOrThrow(z.object({ value: z.number() }), { value: 'x' }, 'ctx'),
      ).toThrow(ValidationError)
      expect(() =>
        parseOrThrow(z.object({ value: z.number() }), { value: 'x' }, 'ctx'),
      ).toThrow(/Invalid API response shape \(ctx\)/u)
    })
  })

  describe('classicLoginDataSchema', () => {
    it('accepts a valid response with LoginData', () => {
      const parsed = ClassicLoginDataSchema.parse({
        LoginData: { ContextKey: 'k', Expiry: '2099-01-01T00:00:00Z' },
      })

      expect(parsed.LoginData?.ContextKey).toBe('k')
    })

    it('accepts null LoginData (failed auth envelope)', () => {
      expect(ClassicLoginDataSchema.parse({ LoginData: null })).toStrictEqual({
        LoginData: null,
      })
    })

    it('rejects missing ContextKey', () => {
      expect(() =>
        ClassicLoginDataSchema.parse({ LoginData: { Expiry: 'x' } }),
      ).toThrow(/ContextKey/u)
    })
  })

  describe('homeTokenResponseSchema', () => {
    it('accepts a minimal valid token payload', () => {
      const parsed = HomeTokenResponseSchema.parse({
        access_token: 'a',
        expires_in: 3600,
        scope: 'openid',
        token_type: 'Bearer',
      })

      expect(parsed.access_token).toBe('a')
    })

    it('rejects empty access_token', () => {
      expect(() =>
        HomeTokenResponseSchema.parse({
          access_token: '',
          expires_in: 3600,
          scope: 'openid',
          token_type: 'Bearer',
        }),
      ).toThrow(/access_token/u)
    })

    it('rejects non-Bearer token_type', () => {
      expect(() =>
        HomeTokenResponseSchema.parse({
          access_token: 'a',
          expires_in: 3600,
          scope: 'openid',
          token_type: 'Mac',
        }),
      ).toThrow(/token_type/u)
    })
  })

  describe('homeContextSchema device capabilities', () => {
    it('accepts a fully-populated ATA capabilities payload in airToAirUnits', () => {
      expect(() =>
        HomeContextSchema.parse(
          buildHomeContext({
            buildings: [
              {
                ...baseHomeBuilding,
                airToAirUnits: [
                  {
                    ...baseHomeAtaDevice,
                    capabilities: defaultHomeAtaCapabilities,
                  },
                ],
              },
            ],
          }),
        ),
      ).not.toThrow()
    })

    it('accepts a fully-populated ATW capabilities payload in airToWaterUnits', () => {
      expect(() =>
        HomeContextSchema.parse(
          buildHomeContext({
            buildings: [
              {
                ...baseHomeBuilding,
                airToWaterUnits: [
                  {
                    ...baseHomeAtwDevice,
                    capabilities: defaultHomeAtwCapabilities,
                  },
                ],
              },
            ],
          }),
        ),
      ).not.toThrow()
    })

    it('rejects ATA capabilities missing a required field', () => {
      const incomplete = {
        ...defaultHomeAtaCapabilities,
        numberOfFanSpeeds: undefined,
      }

      expect(() =>
        HomeContextSchema.parse(
          buildHomeContext({
            buildings: [
              {
                ...baseHomeBuilding,
                airToAirUnits: [
                  { ...baseHomeAtaDevice, capabilities: incomplete },
                ],
              },
            ],
          }),
        ),
      ).toThrow(/numberOfFanSpeeds/u)
    })

    it('rejects ATW capabilities missing a required field', () => {
      const incomplete = { ...defaultHomeAtwCapabilities, ftcModel: undefined }

      expect(() =>
        HomeContextSchema.parse(
          buildHomeContext({
            buildings: [
              {
                ...baseHomeBuilding,
                airToWaterUnits: [
                  { ...baseHomeAtwDevice, capabilities: incomplete },
                ],
              },
            ],
          }),
        ),
      ).toThrow(/ftcModel/u)
    })

    it('rejects non-object capabilities', () => {
      expect(() =>
        HomeContextSchema.parse(
          buildHomeContext({
            buildings: [
              {
                ...baseHomeBuilding,
                airToWaterUnits: [
                  { ...baseHomeAtwDevice, capabilities: 'invalid' },
                ],
              },
            ],
          }),
        ),
      ).toThrow(/capabilities/u)
    })
  })

  describe('classicBuildingListSchema device Type narrowing', () => {
    it.each([
      ClassicDeviceType.Ata,
      ClassicDeviceType.Atw,
      ClassicDeviceType.Erv,
    ])('accepts known device Type %d', (type) => {
      expect(() =>
        ClassicBuildingListSchema.parse(buildingWithDeviceType(type)),
      ).not.toThrow()
    })

    it.each([
      { label: 'numeric out-of-range', value: 999 },
      { label: 'object', value: { nested: 'v' } },
      { label: 'string', value: 'Ata' },
    ])('rejects unsupported device Type ($label)', ({ value }) => {
      expect(() =>
        ClassicBuildingListSchema.parse(buildingWithDeviceType(value)),
      ).toThrow(/Type/u)
    })
  })

  describe('classicEnergyDataSchemas', () => {
    it('accepts a valid ATA energy payload', () => {
      expect(() =>
        ClassicEnergyDataAtaSchema.parse(validClassicEnergyAta),
      ).not.toThrow()
    })

    it('accepts a valid ATW energy payload', () => {
      expect(() =>
        ClassicEnergyDataAtwSchema.parse(validClassicEnergyAtw),
      ).not.toThrow()
    })

    it('rejects an ATA payload missing a total', () => {
      expect(() =>
        ClassicEnergyDataAtaSchema.parse(
          omitKey(validClassicEnergyAta, 'TotalHeatingConsumed'),
        ),
      ).toThrow(/TotalHeatingConsumed/u)
    })

    it.each([
      { label: 'undefined', value: undefined },
      { label: 'null', value: null },
      { label: 'a string', value: '1.5' },
      { label: 'Infinity', value: Number.POSITIVE_INFINITY },
      { label: 'NaN', value: Number.NaN },
    ])('rejects an ATA payload whose total is $label', ({ value }) => {
      expect(() =>
        ClassicEnergyDataAtaSchema.parse({
          ...validClassicEnergyAta,
          TotalHeatingConsumed: value,
        }),
      ).toThrow(/TotalHeatingConsumed/u)
    })

    it('rejects an ATA payload with a non-finite hourly entry', () => {
      expect(() =>
        ClassicEnergyDataAtaSchema.parse({
          ...validClassicEnergyAta,
          Heating: [0, Number.NaN, 1],
        }),
      ).toThrow(/Heating/u)
    })

    it('rejects an ATW payload missing a total', () => {
      expect(() =>
        ClassicEnergyDataAtwSchema.parse(
          omitKey(validClassicEnergyAtw, 'TotalHotWaterProduced'),
        ),
      ).toThrow(/TotalHotWaterProduced/u)
    })

    it.each([
      { label: 'undefined', value: undefined },
      { label: 'null', value: null },
      { label: 'a string', value: '1.5' },
      { label: 'Infinity', value: Number.POSITIVE_INFINITY },
      { label: 'NaN', value: Number.NaN },
    ])('rejects an ATW payload whose total is $label', ({ value }) => {
      expect(() =>
        ClassicEnergyDataAtwSchema.parse({
          ...validClassicEnergyAtw,
          TotalHotWaterProduced: value,
        }),
      ).toThrow(/TotalHotWaterProduced/u)
    })

    it('rejects an ATW payload with a non-finite CoP entry', () => {
      expect(() =>
        ClassicEnergyDataAtwSchema.parse({
          ...validClassicEnergyAtw,
          CoP: [2.5, Number.NaN],
        }),
      ).toThrow(/CoP/u)
    })

    it('resolves the union for both device shapes', () => {
      expect(() =>
        ClassicEnergyDataSchema.parse(validClassicEnergyAta),
      ).not.toThrow()
      expect(() =>
        ClassicEnergyDataSchema.parse(validClassicEnergyAtw),
      ).not.toThrow()
    })

    it('rejects a payload matching neither device shape', () => {
      expect(
        ClassicEnergyDataSchema.safeParse({ Unrelated: true }).success,
      ).toBe(false)
    })
  })
})
