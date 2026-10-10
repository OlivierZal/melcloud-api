import {
  APICallRequestData,
  APICallResponseData,
  createAPICallErrorData,
  REDACTED,
} from '@olivierzal/api-core'
import { defined } from '@olivierzal/api-core/testing'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { ClassicDeviceType } from '../../src/constants.ts'
import { HttpError } from '../../src/http/index.ts'
import { redaction } from '../../src/observability/context.ts'
import {
  type ClassicBaseListDevice,
  type ClassicBuildingData,
  toClassicBuildingId,
  toClassicDeviceId,
} from '../../src/types/index.ts'
import { homeContextBuilding, homeContextData } from '../home-fixtures.ts'

// Thin VOCABULARY suite: the redaction and log-shell MECHANISMS (and
// their mutation-checked suites) live in @olivierzal/api-core, and
// since the SessionAPI adoption the core constructs the shells itself,
// seated with the engine `BaseAPI`'s super() options inject (the live
// dispatch path is pinned by `base-api.test.ts`'s wiring clauses).
// What this file pins is the MELCloud layer's own obligation — its
// sensitive-key vocabulary, and that the one bound engine carries it
// into the core's seats: each shell below is constructed the way the
// core seats it, with the bound `redaction` engine.

const jsonRecord = z.record(z.string(), z.unknown())

const logShape = z.object({
  headers: jsonRecord.optional(),
  requestData: jsonRecord.optional(),
})

const parseLog = (value: string): z.infer<typeof logShape> => {
  const raw: unknown = JSON.parse(value)
  return logShape.parse(raw)
}

const parseResponseDump = (call: APICallResponseData): unknown => {
  const raw: unknown = JSON.parse(call.toString())
  return z.object({ responseData: z.unknown() }).parse(raw).responseData
}

describe.concurrent('the MELCloud vocabulary', () => {
  it.each([
    'access_token',
    'client_secret',
    'code',
    'code_verifier',
    'contextkey',
    'id_token',
    'owneremail',
    'refresh_token',
    'x-mitscontextkey',
  ])('marks the protocol key %s sensitive in any casing', (key) => {
    expect(redaction.isSensitive(key)).toBe(true)
    expect(redaction.isSensitive(key.toUpperCase())).toBe(true)
  })

  it.each(['authorization', 'cookie', 'password', 'token', 'username'])(
    'keeps the core base key %s sensitive',
    (key) => {
      expect(redaction.isSensitive(key)).toBe(true)
    },
  )

  it('leaves non-credential keys alone', () => {
    expect(redaction.isSensitive('retry-after')).toBe(false)
    expect(redaction.isSensitive('x-trace')).toBe(false)
  })

  it('deep-redacts protocol keys through the bound engine', () => {
    expect(
      redaction.redactValue({ nested: { ContextKey: 'ctx', safe: 'ok' } }),
    ).toStrictEqual({ nested: { ContextKey: REDACTED, safe: 'ok' } })
  })

  it('redacts the OAuth code riding a URL query', () => {
    expect(redaction.redactUrl('/callback?code=auth-code&state=xyz')).toBe(
      `/callback?code=${REDACTED}&state=xyz`,
    )
  })
})

// The personal-data tier (api-core 1.10.0): the user-entered strings
// either wire carries, declared apart from the credentials and blanked
// the same way. The list below IS the declaration under test — a key
// added to `PERSONAL_DATA_KEYS` without a line here is unproven, and a
// line here without the key fails.
describe.concurrent('the personal-data tier', () => {
  it.each([
    'AddressLine1',
    'AddressLine2',
    'AreaName',
    'BuildingName',
    'City',
    'DeviceName',
    'District',
    'firstname',
    'FloorName',
    'givenDisplayName',
    'lastname',
    'Latitude',
    'Longitude',
    'OwnerName',
    'Postcode',
    'Zone1Name',
    'Zone2Name',
  ])('marks the personal-data key %s sensitive in any casing', (key) => {
    expect(redaction.isSensitive(key)).toBe(true)
    expect(redaction.isSensitive(key.toLowerCase())).toBe(true)
    expect(redaction.isSensitive(key.toUpperCase())).toBe(true)
  })

  // The exclusions are verdicts, pinned so a future "blank everything
  // that looks personal" sweep has to argue with them: `name` is a
  // Home setting's key before it is a building's, and the hardware
  // identifiers are how a report names a unit.
  it.each([
    'name',
    'Name',
    'MacAddress',
    'macAddress',
    'SerialNumber',
    'LocalIPAddress',
    'TimeZoneCity',
    'DeviceID',
    'id',
  ])('leaves the setting or identifier key %s alone', (key) => {
    expect(redaction.isSensitive(key)).toBe(false)
  })

  it('blanks the display names and the account holder in a Home /context dump, never a setting name', () => {
    const call = new APICallResponseData(
      {
        data: homeContextData({
          buildings: [homeContextBuilding],
          guestBuildings: [],
        }),
        headers: {},
        status: 200,
      },
      undefined,
      redaction,
    )

    expect(parseResponseDump(call)).toMatchObject({
      buildings: [
        {
          airToAirUnits: [
            {
              givenDisplayName: REDACTED,
              id: 'device-1',
              // The trade: a setting's `name` is the key a diagnosis reads.
              settings: [{ name: 'Power', value: 'True' }],
            },
          ],
          airToWaterUnits: [
            {
              givenDisplayName: REDACTED,
              id: 'device-2',
              macAddress: 'FE0000060403388D3DFFFE000000000001',
            },
          ],
          id: 'building-1',
          // The trade's other face: the building name rides the same key.
          name: 'Home',
        },
      ],
      email: REDACTED,
      firstname: REDACTED,
      id: 'user-1',
      lastname: REDACTED,
    })
  })

  it('blanks the device name and the postal address in a Classic /User/ListDevices dump', () => {
    const device = {
      AreaName: 'Upstairs',
      BuildingName: 'Chalet',
      DeviceID: toClassicDeviceId(1),
      DeviceName: 'Living room',
      FloorName: 'Ground',
      LocalIPAddress: '192.168.1.20',
      MacAddress: 'aa:bb:cc:dd:ee:ff',
      OwnerEmail: 'owner@example.com',
      OwnerName: 'Jane Doe',
      SerialNumber: 'SN-1',
      Type: ClassicDeviceType.Ata,
      Zone1Name: 'Bedroom',
      Zone2Name: null,
    } satisfies Partial<ClassicBaseListDevice>
    const building = {
      AddressLine1: '1 rue de la Paix',
      AddressLine2: null,
      City: 'Paris',
      District: null,
      ID: toClassicBuildingId(1),
      Latitude: 48.87,
      Longitude: 2.33,
      Name: 'Chalet',
      Postcode: '75002',
    } satisfies Partial<ClassicBuildingData>
    const call = new APICallResponseData(
      {
        data: [
          {
            ...building,
            Structure: { Devices: [device], Floors: [{ Name: 'Ground' }] },
          },
        ],
        headers: {},
        status: 200,
      },
      undefined,
      redaction,
    )

    expect(parseResponseDump(call)).toStrictEqual([
      {
        AddressLine1: REDACTED,
        AddressLine2: REDACTED,
        City: REDACTED,
        District: REDACTED,
        ID: 1,
        Latitude: REDACTED,
        Longitude: REDACTED,
        // The bare `Name` key stays, by the Home setting-name trade.
        Name: 'Chalet',
        Postcode: REDACTED,
        Structure: {
          Devices: [
            {
              AreaName: REDACTED,
              BuildingName: REDACTED,
              DeviceID: 1,
              DeviceName: REDACTED,
              FloorName: REDACTED,
              LocalIPAddress: '192.168.1.20',
              MacAddress: 'aa:bb:cc:dd:ee:ff',
              // The credential tier's, since before this tier existed.
              OwnerEmail: REDACTED,
              OwnerName: REDACTED,
              SerialNumber: 'SN-1',
              Type: ClassicDeviceType.Ata,
              Zone1Name: REDACTED,
              Zone2Name: REDACTED,
            },
          ],
          Floors: [{ Name: 'Ground' }],
        },
      },
    ])
  })

  it('blanks the HttpError snapshot the same way', () => {
    const error = new HttpError('boom', {
      config: { method: 'GET', url: '/context' },
      redaction,
      response: {
        data: {
          buildings: [
            {
              airToAirUnits: [
                {
                  givenDisplayName: 'Living room',
                  id: 'device-1',
                  settings: [{ name: 'Power', value: 'True' }],
                },
              ],
              id: 'building-1',
              name: 'Home',
            },
          ],
          firstname: 'Jane',
          id: 'user-1',
          lastname: 'Doe',
        },
        headers: {},
        status: 500,
      },
    })

    expect(error.response.data).toStrictEqual({
      buildings: [
        {
          airToAirUnits: [
            {
              givenDisplayName: REDACTED,
              id: 'device-1',
              settings: [{ name: 'Power', value: 'True' }],
            },
          ],
          id: 'building-1',
          name: 'Home',
        },
      ],
      firstname: REDACTED,
      id: 'user-1',
      lastname: REDACTED,
    })
  })
})

describe.concurrent('the bound engine reaches the core shells', () => {
  it('aPICallRequestData redacts a protocol header through the seated engine', () => {
    const call = new APICallRequestData(
      {
        headers: {
          'Content-Type': 'application/json',
          'X-MitsContextKey': 'abc123',
        },
        method: 'post',
        url: '/x',
      },
      redaction,
    )
    const headers = defined(parseLog(call.toString()).headers)

    expect(headers['X-MitsContextKey']).toBe(REDACTED)
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('aPICallResponseData redacts the account address the list echoes', () => {
    const call = new APICallResponseData(
      {
        data: { Structure: { OwnerEmail: 'user@example.com', Zone: 'kept' } },
        headers: {},
        status: 200,
      },
      undefined,
      redaction,
    )

    expect(parseResponseDump(call)).toStrictEqual({
      Structure: { OwnerEmail: REDACTED, Zone: 'kept' },
    })
  })

  it('createAPICallErrorData redacts through the same vocabulary', () => {
    // The error below is built WITHOUT the MELCloud engine (only the
    // core base applies at construction), so the context key survives
    // into the snapshot — the serialization pass through the seated
    // engine must still blank it. Both locks carry the same
    // vocabulary; this clause pins the second one.
    const error = new HttpError('boom', {
      config: { url: '/x' },
      response: {
        data: null,
        headers: { 'x-mitscontextkey': 'ctx', 'x-trace': 'keep' },
        status: 500,
      },
    })
    const data = createAPICallErrorData(error, redaction)
    const headers = defined(parseLog(data.toString()).headers)

    expect(data.errorMessage).toBe('boom')
    expect(data.dataType).toBe('API response')
    expect(headers['x-mitscontextkey']).toBe(REDACTED)
    expect(headers['x-trace']).toBe('keep')
  })

  it('createAPICallErrorData falls back to request data on a plain Error', () => {
    const data = createAPICallErrorData(new Error('Network Error'), redaction)

    expect(data.errorMessage).toBe('Network Error')
    expect(data.dataType).toBe('API request')
  })
})
