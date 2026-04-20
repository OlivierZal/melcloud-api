import { Duration } from 'luxon'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import type { ClassicAPIAdapter, SyncCallback } from '../../src/api/index.ts'
import type {
  ClassicFailureData,
  ClassicGroupState,
  ClassicSetDeviceDataAta,
  ClassicSuccessData,
} from '../../src/types/index.ts'
import {
  CLASSIC_FLAG_UNCHANGED,
  ClassicDeviceType,
  ClassicOperationMode,
} from '../../src/constants.ts'
import {
  classicUpdateDevice,
  classicUpdateDevices,
  fetchDevices,
  syncDevices,
} from '../../src/decorators/index.ts'
import {
  AuthenticationError,
  NoChangesError,
  RateLimitError,
} from '../../src/errors/index.ts'
import { HttpError } from '../../src/http/index.ts'
import { validateRequest } from '../../src/validation/index.ts'
import { cast, mock } from '../helpers.ts'

const createMockFacade = (
  devices: { type: ClassicDeviceType; update: ReturnType<typeof vi.fn> }[] = [],
  id = 1,
): {
  devices: { type: ClassicDeviceType; update: ReturnType<typeof vi.fn> }[]
  id: number
} => ({
  devices,
  id,
})

const decorateUpdateDevices = (
  target: (
    ...args: unknown[]
  ) => Promise<
    boolean | ClassicFailureData | ClassicGroupState | ClassicSuccessData
  >,
  options?: { kind?: 'payload' | 'power'; type?: ClassicDeviceType },
): ReturnType<ReturnType<typeof classicUpdateDevices>> =>
  classicUpdateDevices(options)(target, mock<ClassMethodDecoratorContext>())

const ataFlags = {
  OperationMode: 0x2,
  Power: 0x1,
  SetFanSpeed: 0x8,
  SetTemperature: 0x4,
  VaneHorizontal: 0x1_00,
  VaneVertical: 0x10,
}

const ervFlags = {
  Power: 0x1,
  SetFanSpeed: 0x8,
  VentilationMode: 0x4,
}

const createAtaSetData = (
  overrides: Partial<ClassicSetDeviceDataAta> = {},
): ClassicSetDeviceDataAta =>
  mock({
    DeviceType: ClassicDeviceType.Ata,
    EffectiveFlags: 0x1,
    LastCommunication: '',
    NextCommunication: '',
    NumberOfFanSpeeds: 5,
    Offline: false,
    OperationMode: ClassicOperationMode.heat,
    Power: true,
    RoomTemperature: 22,
    SetFanSpeed: 3,
    SetTemperature: 24,
    VaneHorizontal: 0,
    VaneVertical: 0,
    ...overrides,
  })

const createErvSetData = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  DeviceType: ClassicDeviceType.Erv,
  EffectiveFlags: 0x1,
  LastCommunication: '',
  NextCommunication: '',
  NumberOfFanSpeeds: 5,
  Offline: false,
  Power: true,
  SetFanSpeed: 3,
  VentilationMode: 0,
  ...overrides,
})

const createAtaFacade = (
  update: ReturnType<typeof vi.fn>,
): {
  devices: { type: ClassicDeviceType; update: ReturnType<typeof vi.fn> }[]
  flags: typeof ataFlags
  type: ClassicDeviceType
} => ({
  devices: [{ type: ClassicDeviceType.Ata, update }],
  flags: ataFlags,
  type: ClassicDeviceType.Ata,
})

const createErvFacade = (
  update: ReturnType<typeof vi.fn>,
): {
  devices: { type: ClassicDeviceType; update: ReturnType<typeof vi.fn> }[]
  flags: typeof ervFlags
  type: ClassicDeviceType
} => ({
  devices: [{ type: ClassicDeviceType.Erv, update }],
  flags: ervFlags,
  type: ClassicDeviceType.Erv,
})

const callUpdateDevice = async (
  facade: unknown,
  setData: unknown,
): Promise<unknown> => {
  const target = vi
    .fn<(...args: unknown[]) => Promise<never>>()
    .mockResolvedValue(cast(setData))
  const decorated = classicUpdateDevice()(
    target,
    mock<ClassMethodDecoratorContext>(),
  )
  return decorated.call(facade)
}

const resolveTrue = async (): Promise<true> => {
  await Promise.resolve()
  return true
}

const resolvePowerData = async (): Promise<{ Alpha: null; Power: true }> => {
  const result = await Promise.resolve({ Alpha: null, Power: true } as const)
  return result
}

const setupFetchDevices = (
  options?: Parameters<typeof fetchDevices>[0],
): { callOrder: string[]; invoke: () => Promise<void> } => {
  const callOrder: string[] = []
  const fetchMock = vi.fn<ClassicAPIAdapter['fetch']>().mockImplementation(
    // eslint-disable-next-line @typescript-eslint/require-await -- ClassicAPIAdapter['fetch'] is async
    async () => {
      callOrder.push('fetch')
      return cast([])
    },
  )
  const target = vi
    .fn<(...args: unknown[]) => Promise<never>>()
    .mockImplementation(
      // eslint-disable-next-line @typescript-eslint/require-await -- target signature is async
      async () => {
        callOrder.push('target')
        return cast('result')
      },
    )
  const decorated = fetchDevices(options)(
    target,
    mock<ClassMethodDecoratorContext>(),
  )
  const context = { api: mock<ClassicAPIAdapter>({ fetch: fetchMock }) }
  return { callOrder, invoke: async () => decorated.call(context) }
}

describe(fetchDevices, () => {
  it.each([
    {
      expected: ['fetch', 'target'],
      label: 'default (before)',
      options: undefined,
    },
    {
      expected: ['fetch', 'target'],
      label: 'when=before',
      options: { when: 'before' as const },
    },
    {
      expected: ['target', 'fetch'],
      label: 'when=after',
      options: { when: 'after' as const },
    },
  ])(
    'invokes api.fetch and target in the correct order: $label',
    async ({ expected, options }) => {
      const { callOrder, invoke } = setupFetchDevices(options)
      await invoke()

      expect(callOrder).toStrictEqual(expected)
    },
  )

  it('prefers syncRegistry() over api.fetch() when both are exposed', async () => {
    const callOrder: string[] = []
    const syncRegistry = vi.fn<() => Promise<void>>().mockImplementation(
      // eslint-disable-next-line @typescript-eslint/require-await -- signature is async
      async () => {
        callOrder.push('syncRegistry')
      },
    )
    const fetchMock = vi.fn<ClassicAPIAdapter['fetch']>().mockImplementation(
      // eslint-disable-next-line @typescript-eslint/require-await -- signature is async
      async () => {
        callOrder.push('fetch')
        return cast([])
      },
    )
    const target = vi
      .fn<(...args: unknown[]) => Promise<never>>()
      .mockResolvedValue(cast('result'))
    const decorated = fetchDevices({ when: 'after' })(
      target,
      mock<ClassMethodDecoratorContext>(),
    )
    const context = {
      api: mock<ClassicAPIAdapter>({ fetch: fetchMock }),
      syncRegistry,
    }
    await decorated.call(context)

    expect(callOrder).toStrictEqual(['syncRegistry'])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws TypeError when host exposes neither syncRegistry nor api.fetch (when=before)', async () => {
    const target = vi
      .fn<(...args: unknown[]) => Promise<never>>()
      .mockResolvedValue(cast('result'))
    const decorated = fetchDevices({ when: 'before' })(
      target,
      mock<ClassMethodDecoratorContext>(),
    )

    await expect(decorated.call({})).rejects.toThrow(TypeError)
    expect(target).not.toHaveBeenCalled()
  })

  it('logs and swallows when host exposes neither (when=after)', async () => {
    const logError = vi.fn<(...args: unknown[]) => void>()
    const target = vi
      .fn<(...args: unknown[]) => Promise<never>>()
      .mockResolvedValue(cast('result'))
    const decorated = fetchDevices({ when: 'after' })(
      target,
      mock<ClassMethodDecoratorContext>(),
    )

    await expect(
      decorated.call({
        logger: { error: logError, log: vi.fn<(...args: unknown[]) => void>() },
      }),
    ).resolves.toBe('result')
    expect(logError).toHaveBeenCalledWith(
      'Failed to refresh registry after mutation:',
      expect.any(TypeError),
    )
  })

  it('logs via logger.error when when=after and sync throws', async () => {
    const target = vi
      .fn<(...args: unknown[]) => Promise<never>>()
      .mockResolvedValue(cast('result'))
    const syncRegistry = vi
      .fn<() => Promise<void>>()
      .mockRejectedValue(new Error('sync boom'))
    const logger = {
      error: vi.fn<(...args: unknown[]) => void>(),
      log: vi.fn<(...args: unknown[]) => void>(),
    }
    const decorated = fetchDevices({ when: 'after' })(
      target,
      mock<ClassMethodDecoratorContext>(),
    )

    await expect(decorated.call({ logger, syncRegistry })).resolves.toBe(
      'result',
    )
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to refresh registry after mutation:',
      expect.any(Error),
    )
  })
})

describe(syncDevices, () => {
  it('calls notifySync after the target method', async () => {
    const notifySync = vi.fn<SyncCallback>().mockResolvedValue()
    const target = vi
      .fn<(...args: unknown[]) => Promise<never>>()
      .mockResolvedValue(cast('result'))
    const decorated = syncDevices()(target, mock<ClassMethodDecoratorContext>())
    const context = { notifySync }
    const result = await decorated.call(context)

    expect(result).toBe('result')
    expect(notifySync).toHaveBeenCalledWith({ type: undefined })
  })

  it('passes type to notifySync', async () => {
    const notifySync = vi.fn<SyncCallback>().mockResolvedValue()
    const target = vi
      .fn<(...args: unknown[]) => Promise<never>>()
      .mockResolvedValue(cast('result'))
    const decorated = syncDevices({ type: ClassicDeviceType.Ata })(
      target,
      mock<ClassMethodDecoratorContext>(),
    )
    const context = { notifySync }
    await decorated.call(context)

    expect(notifySync).toHaveBeenCalledWith({ type: ClassicDeviceType.Ata })
  })

  it('works when notifySync is undefined', async () => {
    const target = vi
      .fn<(...args: unknown[]) => Promise<never>>()
      .mockResolvedValue(cast('result'))
    const decorated = syncDevices()(target, mock<ClassMethodDecoratorContext>())
    const context = {}
    const result = await decorated.call(context)

    expect(result).toBe('result')
  })
})

describe(classicUpdateDevices, () => {
  it('updates all devices with the arg data', async () => {
    const update = vi.fn<(data: unknown) => void>()
    const facade = createMockFacade([{ type: ClassicDeviceType.Ata, update }])
    const decorated = decorateUpdateDevices(resolveTrue)
    await decorated.call(facade, { Power: true })

    expect(update).toHaveBeenCalledWith({ Power: true })
  })

  it('throws when arg is empty object', async () => {
    const facade = createMockFacade([], 42)
    const decorated = decorateUpdateDevices(resolveTrue)

    await expect(decorated.call(facade, {})).rejects.toThrow(
      new NoChangesError(42),
    )
  })

  it('filters devices by type when specified', async () => {
    const updateAta = vi.fn<(data: unknown) => void>()
    const updateAtw = vi.fn<(data: unknown) => void>()
    const facade = createMockFacade([
      { type: ClassicDeviceType.Ata, update: updateAta },
      { type: ClassicDeviceType.Atw, update: updateAtw },
    ])
    const decorated = decorateUpdateDevices(resolveTrue, {
      type: ClassicDeviceType.Ata,
    })
    await decorated.call(facade, { Power: true })

    expect(updateAta).toHaveBeenCalledWith({ Power: true })
    expect(updateAtw).not.toHaveBeenCalled()
  })

  it('wraps a boolean arg into { Power } when kind is power', async () => {
    const update = vi.fn<(data: unknown) => void>()
    const facade = createMockFacade([{ type: ClassicDeviceType.Ata, update }])
    const decorated = decorateUpdateDevices(resolveTrue, { kind: 'power' })
    await decorated.call(facade, true)

    expect(update).toHaveBeenCalledWith({ Power: true })
  })

  it('filters null/undefined values from data with kind=payload', async () => {
    const update = vi.fn<(data: unknown) => void>()
    const facade = createMockFacade([{ type: ClassicDeviceType.Ata, update }])
    const decorated = decorateUpdateDevices(resolvePowerData)
    await decorated.call(facade, null)

    expect(update).toHaveBeenCalledWith({ Power: true })
  })
})

describe(classicUpdateDevice, () => {
  it('updates the device model with converted data', async () => {
    const update = vi.fn<(data: unknown) => void>()
    await callUpdateDevice(createAtaFacade(update), createAtaSetData())

    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.lastCall?.[0]).toHaveProperty('Power', true)
  })

  it('converts ATA set keys to list keys', async () => {
    const update = vi.fn<(data: unknown) => void>()
    await callUpdateDevice(
      createAtaFacade(update),
      createAtaSetData({ EffectiveFlags: 0x8, SetFanSpeed: 4 }),
    )

    expect(update.mock.lastCall?.[0]).toHaveProperty('FanSpeed', 4)
  })

  it('passes through non-ATA data without key conversion', async () => {
    const update = vi.fn<(data: unknown) => void>()
    await callUpdateDevice(createErvFacade(update), createErvSetData())

    expect(update.mock.lastCall?.[0]).toHaveProperty('Power', true)
  })

  it('skips update when devices array is empty', async () => {
    const facade = { devices: [], flags: ataFlags, type: ClassicDeviceType.Ata }
    const setData = createAtaSetData()
    const result = await callUpdateDevice(facade, setData)

    expect(result).toBe(setData)
  })

  it('handles CLASSIC_FLAG_UNCHANGED by including all data', async () => {
    const update = vi.fn<(data: unknown) => void>()
    await callUpdateDevice(
      createErvFacade(update),
      createErvSetData({
        EffectiveFlags: CLASSIC_FLAG_UNCHANGED,
        Power: false,
        SetFanSpeed: 2,
        VentilationMode: 1,
      }),
    )

    expect(update).toHaveBeenCalledTimes(1)
  })
})

describe(validateRequest, () => {
  const schema = z.object({ value: z.number() })

  it('returns Result.ok with the parsed payload on success', async () => {
    const operation = vi
      .fn<() => Promise<unknown>>()
      .mockResolvedValue({ value: 42 })

    await expect(
      validateRequest({ context: 'test', host: {}, operation, schema }),
    ).resolves.toStrictEqual({ ok: true, value: { value: 42 } })
  })

  it('returns Result.err(network) + logs on plain error rejection', async () => {
    const logError = vi.fn<(...args: unknown[]) => void>()
    const logger = {
      error: logError,
      log: vi.fn<(...args: unknown[]) => void>(),
    }
    const operation = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValue(new Error('boom'))

    await expect(
      validateRequest({
        context: 'ctx',
        host: { logger },
        operation,
        schema,
      }),
    ).resolves.toMatchObject({ error: { kind: 'network' }, ok: false })
    expect(logError).toHaveBeenCalledWith(
      '[ctx] request or validation failed:',
      expect.any(Error),
    )
  })

  it('returns Result.err(validation) + logs on shape mismatch', async () => {
    const logError = vi.fn<(...args: unknown[]) => void>()
    const logger = {
      error: logError,
      log: vi.fn<(...args: unknown[]) => void>(),
    }
    const operation = vi
      .fn<() => Promise<unknown>>()
      .mockResolvedValue({ value: 'not-a-number' })

    await expect(
      validateRequest({
        context: 'ctx',
        host: { logger },
        operation,
        schema,
      }),
    ).resolves.toMatchObject({ error: { kind: 'validation' }, ok: false })
    expect(logError).toHaveBeenCalledWith(
      '[ctx] request or validation failed:',
      expect.anything(),
    )
  })

  it.each([
    {
      error: new AuthenticationError('nope'),
      expected: { kind: 'unauthorized' } as const,
      label: 'AuthenticationError → unauthorized',
    },
    {
      error: new RateLimitError('paused', {
        retryAfter: Duration.fromMillis(5000),
      }),
      expected: { kind: 'rate-limited', retryAfterMs: 5000 } as const,
      label: 'RateLimitError with Duration → rate-limited',
    },
    {
      error: new RateLimitError('paused', { retryAfter: null }),
      expected: { kind: 'rate-limited', retryAfterMs: null } as const,
      label: 'RateLimitError with null Duration → rate-limited null',
    },
    {
      error: new HttpError(
        'Unauthorized',
        { data: undefined, headers: {}, status: 401 },
        { url: '/x' },
      ),
      expected: { kind: 'unauthorized' } as const,
      label: '401 HttpError → unauthorized',
    },
    {
      error: new HttpError(
        'Server error',
        { data: undefined, headers: {}, status: 500 },
        { url: '/x' },
      ),
      expected: { kind: 'server', status: 500 } as const,
      label: 'non-401 HttpError → server',
    },
  ])('classifies $label', async ({ error, expected }) => {
    const operation = vi.fn<() => Promise<unknown>>().mockRejectedValue(error)

    await expect(
      validateRequest({ context: 'ctx', host: {}, operation, schema }),
    ).resolves.toMatchObject({ error: expected, ok: false })
  })
})

/*
 * Stacking contract. The project applies `@syncDevices()` on top of
 * `@classicUpdateDevices()` for `updatePower` (classic-base.ts). If
 * the order ever silently flips, update-patch propagation would race
 * the notify — worth pinning.
 */
describe('decorator stacking order', () => {
  it('runs outer syncDevices after inner classicUpdateDevices', async () => {
    const callOrder: string[] = []
    const update = vi.fn<(data: unknown) => void>().mockImplementation(() => {
      callOrder.push('update')
    })
    const notifySync = vi.fn<SyncCallback>().mockImplementation(
      // eslint-disable-next-line @typescript-eslint/require-await -- signature is async
      async () => {
        callOrder.push('notifySync')
      },
    )
    const innerTarget = vi
      .fn<(isOn: boolean) => Promise<boolean>>()
      .mockResolvedValue(true)
    const inner = classicUpdateDevices({ kind: 'power' })(
      innerTarget,
      mock<ClassMethodDecoratorContext>(),
    )
    const outer = syncDevices()(inner, mock<ClassMethodDecoratorContext>())
    const facade = {
      devices: [{ type: ClassicDeviceType.Ata, update }],
      id: 1,
      notifySync,
    }

    await outer.call(facade, true)

    expect(callOrder).toStrictEqual(['update', 'notifySync'])
  })
})

/*
 * The `type` filter in `@classicUpdateDevices` and `@syncDevices`
 * drives which devices receive a patch / which type label rides on
 * the notifySync payload. A regression here would silently broadcast
 * the patch to unrelated device types.
 */
describe('decorator type-filter forwarding', () => {
  it('@syncDevices forwards the configured type to notifySync', async () => {
    const notifySync = vi.fn<SyncCallback>().mockResolvedValue()
    const decorated = syncDevices({ type: ClassicDeviceType.Atw })(
      // eslint-disable-next-line @typescript-eslint/require-await -- target is async
      async () => 'ok',
      mock<ClassMethodDecoratorContext>(),
    )

    await decorated.call({ notifySync })

    expect(notifySync).toHaveBeenCalledWith({ type: ClassicDeviceType.Atw })
  })
})
