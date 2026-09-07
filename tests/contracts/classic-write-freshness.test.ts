import {
  cast,
  createMockHttpClient,
  createServerError,
  createSettingStore,
  defined,
  mock,
} from '@olivierzal/api-core/testing'
import { describe, expect, it, onTestFinished } from 'vitest'

import type { SettingManager } from '../../src/api/types.ts'
import type { ClassicDeviceAtaFacade } from '../../src/facades/classic-types.ts'
import { ClassicAPI } from '../../src/api/classic.ts'
import {
  CLASSIC_FLAG_UNCHANGED,
  ClassicDeviceType,
  ClassicOperationMode,
  ClassicVertical,
} from '../../src/constants.ts'
import { NoChangesError, StateReadError } from '../../src/errors/index.ts'
import { classicAtaFlags } from '../../src/facades/classic-flags.ts'
import { ClassicFacadeManager } from '../../src/facades/classic-manager.ts'
import { isClassicAtaFacade } from '../../src/facades/index.ts'
import {
  type HttpRequestConfig,
  type HttpResponse,
  HttpClient,
} from '../../src/http/index.ts'
import {
  type ClassicBuildingWithStructure,
  type ClassicGetDeviceData,
  type ClassicListDevice,
  type ClassicSetDevicePostData,
  toClassicBuildingId,
  toClassicDeviceId,
} from '../../src/types/index.ts'
import {
  CLASSIC_LIST_PATH,
  classicAtaDeviceData,
  classicBuildingData,
  classicLoginResponse,
  stageClassicWire,
} from '../classic-fixtures.ts'

// A Classic write posts the unit's FULL state: the set endpoints apply
// the whole body they receive — `EffectiveFlags` is decorative, and a
// partial body zero-fills what it omits (live-probed 2026-09-05 on
// `/Device/SetAta`). So the only question a write can get wrong is
// which state it merges the delta onto, and until 56.0.0 that was the
// last sync's snapshot, up to a sync interval old: a temperature write
// re-imposed the vane and mode another writer had changed since (the
// "vane keeps resetting to Auto" field report). The contract is that
// a stale snapshot never reaches the wire — the base is a live read
// taken immediately before the post, and a read that fails refuses
// the write rather than falling back. Pinned on the REAL Classic leg,
// wire to wire, because the mock adapter suites cannot tell a live
// base from a snapshot one. Home is out of scope: its PUT is a delta.

type Ata = typeof ClassicDeviceType.Ata

const BASE_URL = 'https://app.melcloud.com/Mitsubishi.Wifi.Client'
const GET_PATH = '/Device/Get'
const SET_PATH = '/Device/SetAta'
const DEVICE_ID = 1000
const OK_STATUS = 200
const SERVER_ERROR_STATUS = 500
const REQUESTED_TEMPERATURE = 20

// What the last sync saw, and what the unit holds when the write
// arrives: every field the write does not name differs between the two,
// so a snapshot base has to show in the body.
const SNAPSHOT = {
  OperationMode: ClassicOperationMode.cool,
  SetTemperature: 24,
  VaneVerticalDirection: ClassicVertical.swing,
} as const

const LIVE = {
  OperationMode: ClassicOperationMode.heat,
  SetTemperature: 24,
  VaneVertical: ClassicVertical.auto,
} as const

const listing = (): ClassicBuildingWithStructure[] => [
  mock<ClassicBuildingWithStructure>({
    ...classicBuildingData(),
    Structure: {
      Areas: [],
      Devices: [
        mock<ClassicListDevice<Ata>>({
          AreaID: null,
          BuildingID: toClassicBuildingId(1),
          Device: classicAtaDeviceData(SNAPSHOT),
          DeviceID: toClassicDeviceId(DEVICE_ID),
          DeviceName: 'Kernel',
          FloorID: null,
          Type: ClassicDeviceType.Ata,
        }),
      ],
      Floors: [],
    },
  }),
]

const liveState = (
  overrides: Partial<ClassicGetDeviceData<Ata>> = {},
): ClassicGetDeviceData<Ata> =>
  mock<ClassicGetDeviceData<Ata>>({
    DeviceType: ClassicDeviceType.Ata,
    EffectiveFlags: CLASSIC_FLAG_UNCHANGED,
    Power: true,
    SetFanSpeed: 3,
    VaneHorizontal: 0,
    ...LIVE,
    ...overrides,
  })

interface Wire {
  readonly live: ClassicGetDeviceData<Ata>
  readonly readOutcome: 'ok' | 'server-error'
}

const route = (config: HttpRequestConfig, wire: Wire): HttpResponse => {
  if (config.url === CLASSIC_LIST_PATH) {
    return { data: listing(), headers: {}, status: OK_STATUS }
  }
  if (config.url === GET_PATH) {
    if (wire.readOutcome === 'server-error') {
      throw createServerError(SERVER_ERROR_STATUS, GET_PATH)
    }
    return { data: wire.live, headers: {}, status: OK_STATUS }
  }
  if (config.url === SET_PATH) {
    // MELCloud echoes the state it applied.
    return { data: config.data, headers: {}, status: OK_STATUS }
  }
  throw new Error(`Unstaged route: ${String(config.url)}`)
}

const { client, requestSpy } = createMockHttpClient(HttpClient, BASE_URL)

// A persisted session so `create()` runs the reuse probe — the registry
// sync that carries the snapshot in — without a sign-in round-trip.
const persistedSession = (): SettingManager =>
  createSettingStore({ contextKey: 'ctx', expiry: '2099-12-31T00:00:00' })
    .settingManager

const createFacade = async (wire: Wire): Promise<ClassicDeviceAtaFacade> => {
  stageClassicWire(requestSpy, {
    login: () => classicLoginResponse(),
    rest: (config) => route(config, wire),
  })
  const api = await ClassicAPI.create({
    settingManager: persistedSession(),
    syncIntervalMinutes: false,
    transport: client,
  })
  onTestFinished(() => {
    api[Symbol.dispose]()
  })
  const manager = new ClassicFacadeManager(api)
  const facade = manager.get(defined(api.registry.devices.getById(DEVICE_ID)))
  if (!isClassicAtaFacade(facade)) {
    throw new TypeError('The kernel device is staged as ATA')
  }
  return facade
}

const wireUrls = (): (string | undefined)[] =>
  requestSpy.mock.calls.map(([config]) => config.url)

const postedBody = (): ClassicSetDevicePostData<Ata> =>
  cast(
    defined(
      requestSpy.mock.calls.find(([config]) => config.url === SET_PATH),
    )[0].data,
  )

describe('updateValues — Classic live-state merge', () => {
  // Guards the guard: the clauses below prove nothing if the two states
  // agree on the fields the write leaves alone.
  it('stages a snapshot the unit has moved away from', () => {
    expect(SNAPSHOT.OperationMode).not.toBe(LIVE.OperationMode)
    expect(SNAPSHOT.VaneVerticalDirection).not.toBe(LIVE.VaneVertical)
  })

  it('posts the full state merged onto the live read, never the snapshot', async () => {
    const facade = await createFacade({ live: liveState(), readOutcome: 'ok' })

    await facade.updateValues({ SetTemperature: REQUESTED_TEMPERATURE })

    const body = postedBody()

    expect(body.SetTemperature).toBe(REQUESTED_TEMPERATURE)
    expect(body.EffectiveFlags).toBe(classicAtaFlags.SetTemperature)
    // The fields the write did not name are the unit's, not the sync's.
    expect(body.OperationMode).toBe(LIVE.OperationMode)
    expect(body.VaneVertical).toBe(LIVE.VaneVertical)
  })

  it('reads the unit once, immediately before the post', async () => {
    const facade = await createFacade({ live: liveState(), readOutcome: 'ok' })

    await facade.updateValues({ SetTemperature: REQUESTED_TEMPERATURE })

    const urls = wireUrls()

    expect(urls.filter((url) => url === GET_PATH)).toHaveLength(1)
    expect(urls.slice(-2)).toStrictEqual([GET_PATH, SET_PATH])
  })

  it('refuses the write when the live read fails, sending nothing', async () => {
    const facade = await createFacade({
      live: liveState(),
      readOutcome: 'server-error',
    })

    const attempt = facade.updateValues({
      SetTemperature: REQUESTED_TEMPERATURE,
    })

    await expect(attempt).rejects.toBeInstanceOf(StateReadError)
    // The read's own classification rides along, so a caller can tell a
    // transport blip from a refused session.
    await expect(attempt).rejects.toMatchObject({
      entityId: DEVICE_ID,
      failure: { kind: 'server', status: SERVER_ERROR_STATUS },
    })
    expect(wireUrls()).not.toContain(SET_PATH)
  })

  it('judges "nothing to change" against the unit, not the snapshot', async () => {
    // The snapshot still says 24; the unit already holds the request.
    const facade = await createFacade({
      live: liveState({ SetTemperature: REQUESTED_TEMPERATURE }),
      readOutcome: 'ok',
    })

    await expect(
      facade.updateValues({ SetTemperature: REQUESTED_TEMPERATURE }),
    ).rejects.toThrow(NoChangesError)

    expect(wireUrls()).not.toContain(SET_PATH)
    // The read was not wasted: the snapshot caught up with the unit.
    expect(facade.data.SetTemperature).toBe(REQUESTED_TEMPERATURE)
  })

  it('spends no wire call on a change set with nothing in it', async () => {
    const facade = await createFacade({ live: liveState(), readOutcome: 'ok' })
    requestSpy.mockClear()

    await expect(facade.updateValues({})).rejects.toThrow(NoChangesError)

    expect(requestSpy).not.toHaveBeenCalled()
  })
})
