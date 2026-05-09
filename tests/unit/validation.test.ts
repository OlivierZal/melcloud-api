import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { ClassicDeviceType } from '../../src/constants.ts'
import { ValidationError } from '../../src/errors/index.ts'
import {
  ClassicBuildingListSchema,
  ClassicLoginDataSchema,
  HomeContextSchema,
  HomeTokenResponseSchema,
  parseOrThrow,
} from '../../src/validation/index.ts'

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
    const validAtaCapabilities = {
      hasAirDirection: true,
      hasAutomaticFanSpeed: true,
      hasAutoOperationMode: true,
      hasCoolOperationMode: true,
      hasDemandSideControl: true,
      hasDryOperationMode: true,
      hasEnergyConsumedMeter: true,
      hasExtendedTemperatureRange: true,
      hasHalfDegreeIncrements: true,
      hasHeatOperationMode: true,
      hasStandby: true,
      hasSwing: true,
      isLegacyDevice: false,
      isMultiSplitSystem: false,
      maxTempAutomatic: 31,
      maxTempCoolDry: 31,
      maxTempHeat: 31,
      minTempAutomatic: 16,
      minTempCoolDry: 16,
      minTempHeat: 10,
      numberOfFanSpeeds: 5,
      supportsWideVane: false,
    }

    it('accepts a fully-populated ATA capabilities payload in airToAirUnits', () => {
      expect(() =>
        HomeContextSchema.parse(
          buildHomeContext({
            buildings: [
              {
                ...baseHomeBuilding,
                airToAirUnits: [
                  { ...baseHomeAtaDevice, capabilities: validAtaCapabilities },
                ],
              },
            ],
          }),
        ),
      ).not.toThrow()
    })

    const validAtwCapabilities = {
      ftcModel: 3,
      hasBoiler: true,
      hasDemandSideControl: true,
      hasDualRoomTemperature: false,
      hasEstimatedEnergyConsumption: true,
      hasEstimatedEnergyProduction: true,
      hasHalfDegrees: true,
      hasHeatZone1: true,
      hasHeatZone2: false,
      hasHotWater: true,
      hasMeasuredEnergyConsumption: false,
      hasMeasuredEnergyProduction: false,
      hasThermostatZone1: true,
      hasThermostatZone2: false,
      hasWirelessRemote: true,
      hasZone2: false,
      immersionHeaterCapacity: 0,
      maxHeatOutput: 0,
      maxImportPower: 0,
      maxSetTankTemperature: 60,
      maxSetTemperature: 30,
      minSetTankTemperature: 40,
      minSetTemperature: 10,
      refridgerentAddress: 0,
      temperatureIncrement: 0.5,
      temperatureIncrementOverride: '2',
      temperatureUnit: '',
    }

    it('accepts a fully-populated ATW capabilities payload in airToWaterUnits', () => {
      expect(() =>
        HomeContextSchema.parse(
          buildHomeContext({
            buildings: [
              {
                ...baseHomeBuilding,
                airToWaterUnits: [
                  { ...baseHomeAtwDevice, capabilities: validAtwCapabilities },
                ],
              },
            ],
          }),
        ),
      ).not.toThrow()
    })

    it('rejects ATA capabilities missing a required field', () => {
      const incomplete = { ...validAtaCapabilities, numberOfFanSpeeds: undefined }

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
      const incomplete = { ...validAtwCapabilities, ftcModel: undefined }

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
})
