import {
  createMockHttpClient,
  defined,
  mockHttpResponse,
} from '@olivierzal/api-core/testing'
import { beforeEach, describe, expect, it } from 'vitest'

import type {
  ClassicBuildingFacade,
  ClassicDeviceFacade,
} from '../../src/facades/classic-types.ts'
import { ClassicAPI } from '../../src/api/classic.ts'
import { ClassicDeviceType } from '../../src/constants.ts'
import { NoChangesError } from '../../src/errors/index.ts'
import { ClassicFacadeManager } from '../../src/facades/classic-manager.ts'
import { type HttpRequestConfig, HttpClient } from '../../src/http/index.ts'
import {
  assertClassicDeviceType,
  CLASSIC_LIST_PATH,
  classicAtaDeviceData,
  classicBuildingId,
  classicBuildingWithStructure,
  classicDeviceId,
  classicLoginResponse,
  classicRawDevice,
  stageClassicWire,
} from '../classic-fixtures.ts'

// A MELCloud Classic write to a unit (its state, its power, its group)
// is ONE request on the wire, the POST, and a write that would change
// nothing is none. The POST's answer is all the model needs: the
// fields its flags mark for a device write, what was sent for the two
// writes MELCloud only acknowledges. No read confirms a write, before
// it or after it: once a POST has landed, the listing answers the
// value just written until the unit has communicated, so a read there
// learns nothing and a host taking it for the unit's state is wrong
// for minutes. The clauses count what leaves the transport rather than
// which adapter method ran, so a read added by any route (a decorator,
// a helper, a new adapter call) fails them.
const { client, requestSpy } = createMockHttpClient(
  HttpClient,
  'https://app.melcloud.com/Mitsubishi.Wifi.Client',
)

const DEVICE_WRITE_PATH = '/Device/SetAta'
const GROUP_WRITE_PATH = '/Group/SetAta'
const POWER_WRITE_PATH = '/Device/Power'

const BUILDING_ID = 1
const UNIT_ID = 7
const SYNCED_FAN_SPEED = 3
const SYNCED_SETPOINT = 21
const ANSWERED_FAN_SPEED = 5
const ANSWERED_SETPOINT = 23.5

// Built afresh for each answer: the registry keeps what a listing
// hands it, and a write then updates it in place.
const listing = (): unknown => [
  classicBuildingWithStructure({
    ID: classicBuildingId(BUILDING_ID),
    Structure: {
      Areas: [],
      Devices: [
        classicRawDevice({
          BuildingID: BUILDING_ID,
          Device: classicAtaDeviceData({
            FanSpeed: SYNCED_FAN_SPEED,
            SetTemperature: SYNCED_SETPOINT,
          }),
          DeviceID: UNIT_ID,
        }),
      ],
      Floors: [],
    },
  }),
]

// The wire as MELCloud answers it: the listing, a group write
// acknowledged, a power write answering whether it was taken, a
// device write echoing the body it received.
const answer = ({ data, url }: HttpRequestConfig): unknown => {
  if (url === CLASSIC_LIST_PATH) {
    return listing()
  }
  if (url === GROUP_WRITE_PATH) {
    return { AttributeErrors: null, Success: true }
  }
  return url === POWER_WRITE_PATH ? true : data
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const sentRequests = (): string[] =>
  requestSpy.mock.calls.map(
    ([{ method, url }]) => `${String(method)} ${String(url)}`,
  )

const facades = async (): Promise<{
  building: ClassicBuildingFacade
  unit: ClassicDeviceFacade<typeof ClassicDeviceType.Ata>
}> => {
  const api = await ClassicAPI.create({
    password: 'pass',
    syncIntervalMinutes: false,
    transport: client,
    username: 'user',
  })
  await api.fetch()
  const manager = new ClassicFacadeManager(api)
  const unit = defined(api.registry.devices.getById(classicDeviceId(UNIT_ID)))
  assertClassicDeviceType(unit, ClassicDeviceType.Ata)
  const building = defined(
    api.registry.buildings.getById(classicBuildingId(BUILDING_ID)),
  )
  // What signing in and listing sent belongs to the session, not to
  // the write under test.
  requestSpy.mockClear()
  return { building: manager.get(building), unit: manager.get(unit) }
}

describe('a MELCloud Classic write on the wire', () => {
  beforeEach(() => {
    stageClassicWire(requestSpy, {
      login: () => classicLoginResponse(),
      rest: (config) => mockHttpResponse(answer(config)),
    })
  })

  it('sends a device write as one POST and reads nothing', async () => {
    const { unit } = await facades()

    await unit.updateValues({ SetTemperature: SYNCED_SETPOINT + 1 })

    expect(sentRequests()).toStrictEqual([`post ${DEVICE_WRITE_PATH}`])
  })

  it('sends a group write as one POST and reads nothing', async () => {
    const { building } = await facades()

    await building.updateGroupState({ SetTemperature: SYNCED_SETPOINT + 1 })

    expect(sentRequests()).toStrictEqual([`post ${GROUP_WRITE_PATH}`])
  })

  it('sends a power write as one POST and reads nothing', async () => {
    const { building } = await facades()

    await building.updatePower(false)

    expect(sentRequests()).toStrictEqual([`post ${POWER_WRITE_PATH}`])
  })

  // MELCloud answers a device write with every field of the body it
  // received, and its flags say which of them the unit took. This
  // answer carries another setpoint than the one sent and another fan
  // speed than the unit's, under the flags of the request: the
  // setpoint alone.
  it('takes from the answer the fields its flags mark, and no other', async () => {
    const { unit } = await facades()
    stageClassicWire(requestSpy, {
      login: () => classicLoginResponse(),
      rest: ({ data }) =>
        mockHttpResponse({
          ...(isRecord(data) && data),
          SetFanSpeed: ANSWERED_FAN_SPEED,
          SetTemperature: ANSWERED_SETPOINT,
        }),
    })

    await unit.updateValues({ SetTemperature: SYNCED_SETPOINT + 1 })

    expect(unit.data).toMatchObject({
      FanSpeed: SYNCED_FAN_SPEED,
      SetTemperature: ANSWERED_SETPOINT,
    })
  })

  it('sends nothing for a write the synced state already holds', async () => {
    const { unit } = await facades()

    await expect(
      unit.updateValues({ SetTemperature: SYNCED_SETPOINT }),
    ).rejects.toThrow(NoChangesError)

    expect(sentRequests()).toStrictEqual([])
  })
})
