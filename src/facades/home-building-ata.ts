import type { HomeAPIAdapter } from '../api/index.ts'
import type { HomeDevice } from '../entities/home-device.ts'
import { HomeDeviceType } from '../constants.ts'
import { NoChangesError } from '../errors/index.ts'
import {
  type ClassicFailureData,
  type ClassicGroupState,
  type ClassicSuccessData,
  type HomeAtaDeviceData,
  type Result,
  ok,
} from '../types/index.ts'
import type { HomeDeviceAtaFacade } from './home-device-ata.ts'
import {
  aggregateClassicAtaGroupStates,
  toClassicAtaGroupState,
  toHomeAtaValues,
} from './home-ata-group.ts'

/**
 * Resolves the cached ATA device facade for a registry model — supplied by
 * the facade manager so building facades reuse its per-device cache.
 * @internal
 */
export type HomeAtaFacadeResolver = (
  model: HomeDevice<HomeAtaDeviceData>,
) => HomeDeviceAtaFacade

/**
 * Facade for one `/context` building's ATA devices — the account-level
 * group. MELCloud Home has no group endpoint, so the group contract is
 * emulated over the members: reads aggregate the devices' states (fields
 * where members diverge fold to `null`, the wire's mixed marker) and
 * writes fan out to every member.
 * @category Facades
 */
export class HomeBuildingAtaFacade {
  public readonly id: string

  /**
   * The building's ATA devices as currently registered; re-resolved on
   * every access so syncs (units added, removed or re-homed) are followed.
   * @returns The member device models.
   */
  public get devices(): HomeDevice<HomeAtaDeviceData>[] {
    return this.#api.registry
      .getByType(HomeDeviceType.Ata)
      .filter(
        (device): device is HomeDevice<HomeAtaDeviceData> =>
          device.isAta() && device.building.id === this.id,
      )
  }

  /**
   * Display name of the building, as of the latest sync that still holds
   * one of its devices; the last known name once emptied.
   * @returns The user-facing label of the account's building.
   */
  public get name(): string {
    const [device] = this.devices
    return device === undefined ? this.#name : device.building.name
  }

  readonly #api: HomeAPIAdapter

  readonly #getFacade: HomeAtaFacadeResolver

  readonly #name: string

  /**
   * Builds a facade for one building's ATA group.
   * @param api - Home API client (carries the device registry).
   * @param building - Identity of the `/context` building.
   * @param building.id - Identifier the group is keyed on.
   * @param building.name - Display name captured at build time.
   * @param getFacade - Resolver returning the cached device facade for a
   * member model.
   */
  public constructor(
    api: HomeAPIAdapter,
    building: { id: string; name: string },
    getFacade: HomeAtaFacadeResolver,
  ) {
    this.#api = api
    this.id = building.id
    this.#name = building.name
    this.#getFacade = getFacade
  }

  /**
   * Read the building's aggregated group state: fields where every member
   * agrees carry the shared value, diverging fields fold to `null` (the
   * wire's mixed marker). No wire call — members' synced states are reused.
   * @returns A success result wrapping the aggregated group state.
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- pure aggregation of cached data; async only to satisfy the group contract shared with the Classic facades
  public async getGroup(): Promise<Result<ClassicGroupState>> {
    return ok(
      aggregateClassicAtaGroupStates(
        this.devices.map((device) =>
          toClassicAtaGroupState(this.#getFacade(device)),
        ),
      ),
    )
  }

  /**
   * Apply a Classic group state to every member device. The delta is
   * translated to the Home vocabulary once, then fanned out; members
   * already matching it (a {@link NoChangesError} from their update) are
   * fine by definition and do not fail the group write.
   * @param state - Partial Classic group state to push to the members.
   * @returns The zone-shaped success outcome once every write settled.
   */
  public async updateGroupState(
    state: ClassicGroupState,
  ): Promise<ClassicFailureData | ClassicSuccessData> {
    const values = toHomeAtaValues(state)
    if (Object.keys(values).length > 0) {
      await Promise.all(
        this.devices.map(async (device) => {
          try {
            await this.#getFacade(device).updateValues(values)
          } catch (error) {
            if (!(error instanceof NoChangesError)) {
              throw error
            }
          }
        }),
      )
    }
    return { AttributeErrors: null, Success: true }
  }
}
