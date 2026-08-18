import { describe, expect, it, vi } from 'vitest'

import type { ClassicAPIAdapter } from '../../src/api/classic-types.ts'
import type { HomeAPIAdapter } from '../../src/api/home-types.ts'
import type { ErrorLogEntry } from '../../src/error-log.ts'
import { ClassicDeviceAtaFacade } from '../../src/facades/classic-device-ata.ts'
import { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import { HomeDeviceAtwFacade } from '../../src/facades/home-device-atw.ts'
import { type Result, ok } from '../../src/types/index.ts'
import {
  classicAtaDevice,
  classicBuildingData,
  createMockClassicApi,
  populatedClassicRegistry,
} from '../classic-fixtures.ts'
import { defined, okValue } from '../helpers.ts'
import {
  createMockHomeApi,
  homeAtwDevice,
  homeDevice,
} from '../home-fixtures.ts'

// One neutral entry shape on every dialect: `at` and `deviceId` always,
// `message` when the wire carries a text, `code`/`clearedAt` only where
// the wire has them. The Classic page wrapper (chained window bounds —
// pinned in classic-api.test.ts with the wire fixtures) and the Home
// bare list are dialect mechanics, not the contract. The Classic leg
// mocks its adapter at the same seam the sibling kernels do; the wire
// projection behind it is classic-api.test.ts's job.
const describeErrorLogContract = (
  name: string,
  read: () => Promise<Result<readonly ErrorLogEntry[]>>,
): void => {
  describe(`errorLog — ${name}`, () => {
    it('answers neutral entries with a timestamp and a device id', async () => {
      expect.assertions(3)

      const entries = okValue(await read())
      const [entry] = entries

      expect(entries.length).toBeGreaterThan(0)
      expect(entry?.at).not.toBe('')
      expect(entry?.deviceId).toBeDefined()
    })
  })
}

describeErrorLogContract('Classic ATA device', async () => {
  const registry = populatedClassicRegistry({
    buildings: [classicBuildingData()],
    devices: [classicAtaDevice()],
  })
  const api = createMockClassicApi({
    getErrorLog: vi
      .fn<ClassicAPIAdapter['getErrorLog']>()
      .mockResolvedValue(
        ok({
          entries: [
            {
              at: '2026-03-01T06:00:00',
              deviceId: 1000,
              message: 'Fan speed abnormality',
            },
          ],
          fromDate: '2026-03-01',
          nextFromDate: '2026-01-31',
          nextToDate: '2026-02-28',
        }),
      ),
  })
  const facade = new ClassicDeviceAtaFacade(
    api,
    registry,
    defined(registry.devices.getById(1000)),
  )
  const page = await facade.getErrorLog({ to: '2026-03-02' })
  return page.ok ? ok(page.value.entries) : page
})

describeErrorLogContract('Home ATA device', async () => {
  const facade = new HomeDeviceAtaFacade(
    homeErrorApi(),
    homeDevice({ id: 'contract-errors-ata' }),
  )
  return facade.getErrorLog()
})

describeErrorLogContract('Home ATW device', async () => {
  const facade = new HomeDeviceAtwFacade(
    homeErrorApi(),
    homeAtwDevice({ id: 'contract-errors-atw' }),
  )
  return facade.getErrorLog()
})

const homeErrorApi = (): HomeAPIAdapter =>
  createMockHomeApi({
    getErrorLog: vi
      .fn<HomeAPIAdapter['getErrorLog']>()
      .mockResolvedValue(
        ok([
          {
            clearedTimestamp: null,
            errorCode: 'E202',
            errorReason: 'Communication error',
            timestamp: '2026-03-01T06:00:00Z',
          },
        ]),
      ),
  })
