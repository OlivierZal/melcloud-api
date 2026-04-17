import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { ClassicDeviceType } from '../../src/constants.ts'
import { ValidationError } from '../../src/errors/index.ts'
import {
  ClassicBuildingListSchema,
  ClassicLoginDataSchema,
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
