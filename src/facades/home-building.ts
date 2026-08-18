import type { HomeAPIAdapter } from '../api/index.ts'
import type { HomeDevice } from '../entities/home-device.ts'
import { tolerateNoChanges } from '../errors/index.ts'
import {
  type AggregatedHolidayModeState,
  type HolidayModeUpdate,
  aggregateHolidayModeStates,
} from '../holiday-mode.ts'
import {
  type AggregatedProtectionState,
  type ProtectionUpdate,
  aggregateProtectionStates,
} from '../protection.ts'
import {
  type ClassicGroupState,
  type HomeAtaDeviceData,
  type HomeProtectionUnits,
  type Result,
  ok,
} from '../types/index.ts'
import type { HomeDeviceAtaFacade } from './home-device-ata.ts'
import {
  aggregateClassicAtaGroupStates,
  toClassicAtaGroupState,
  toHomeAtaValues,
} from './home-ata-group.ts'
import {
  toHolidayModeState,
  toHomeProtectionState,
} from './home-base-device.ts'
import {
  pushHomeFrostProtection,
  pushHomeHolidayMode,
  pushHomeOverheatProtection,
} from './home-protection.ts'

// `allSettled` reasons are `unknown`; non-Error rejections (possible
// from plain-JS callers) wrap so the throw sites stay Error-typed.
const toError = (reason: unknown): Error =>
  reason instanceof Error ? reason : new Error(JSON.stringify(reason))

/**
 * Resolves the cached ATA device facade for a registry model — supplied by
 * the facade manager so building facades reuse its per-device cache.
 * @internal
 */
export type HomeAtaFacadeResolver = (
  model: HomeDevice<HomeAtaDeviceData>,
) => HomeDeviceAtaFacade

/**
 * Facade for one `/context` building: the account-level multi-device
 * target. MELCloud Home has no building endpoint, so the per-target
 * contract is emulated over the members — reads aggregate the synced
 * member states (fields where members diverge fold to `null`, the
 * mixed marker) and writes fan out to every member, or ride the batch
 * protection endpoints with the members' ids. The ATA group contract
 * (`getGroup`/`updateGroupState`) covers the ATA members only, like
 * the official app's group screen.
 * @category Facades
 */
export class HomeBuildingFacade {
  public readonly id: string

  /**
   * The building's devices as currently registered, both connection
   * types; re-resolved on every access so syncs (units added, removed
   * or re-homed) are followed.
   * @returns The member device models.
   */
  public get devices(): HomeDevice[] {
    return this.#api.registry
      .getDevices()
      .filter((device) => device.building.id === this.id)
  }

  /**
   * Display name of the building, as of the latest sync that still holds
   * one of its devices; the last observed name once emptied.
   * @returns The user-facing label of the account's building.
   */
  public get name(): string {
    const [device] = this.devices
    if (device !== undefined) {
      this.#name = device.building.name
    }
    return this.#name
  }

  /**
   * Whether any member can hold an overheat protection — the feature is
   * ATA-only, so a building without ATA members has nothing to protect.
   * @returns `true` when at least one member is an ATA unit.
   */
  public get supportsOverheat(): boolean {
    return this.#ataDevices.length > 0
  }

  readonly #api: HomeAPIAdapter

  readonly #getFacade: HomeAtaFacadeResolver

  #name: string

  get #ataDevices(): HomeDevice<HomeAtaDeviceData>[] {
    return this.devices.filter(
      (device): device is HomeDevice<HomeAtaDeviceData> => device.isAta(),
    )
  }

  get #memberUnits(): HomeProtectionUnits {
    const ata: string[] = []
    const atw: string[] = []
    for (const device of this.devices) {
      if (device.isAta()) {
        ata.push(device.id)
      } else {
        atw.push(device.id)
      }
    }
    return {
      ...(ata.length > 0 && { ATA: ata }),
      ...(atw.length > 0 && { ATW: atw }),
    }
  }

  /**
   * Builds a facade for one `/context` building.
   * @param api - Home API client (carries the device registry).
   * @param building - Identity of the `/context` building.
   * @param building.id - Identifier the target is keyed on.
   * @param building.name - Display name captured at build time.
   * @param getFacade - Resolver returning the cached device facade for an
   * ATA member model (the group contract's clamping path).
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
   * Reads the members' aggregated frost protection: fields every member
   * agrees on carry the shared value, diverging fields fold to `null`.
   * No wire call — the synced `/context` states are reused.
   * @returns A success result wrapping the aggregated state.
   */
  // Pure aggregation of cached data; the `await Promise.resolve(...)`
  // shape satisfies the cross-dialect async contract without an eslint
  // disable (see `getGroup`).
  public async getFrostProtection(): Promise<
    Result<AggregatedProtectionState>
  > {
    const members = await Promise.resolve(this.devices)
    return ok(
      aggregateProtectionStates(
        members.map(({ data }) => toHomeProtectionState(data.frostProtection)),
      ),
    )
  }

  /**
   * Read the building's aggregated ATA group state: fields where every
   * ATA member agrees carry the shared value, diverging fields fold to
   * `null` (the wire's mixed marker). No wire call — members' synced
   * states are reused.
   * @returns A success result wrapping the aggregated group state.
   */
  public async getGroup(): Promise<Result<ClassicGroupState>> {
    const members = await Promise.resolve(this.#ataDevices)
    return ok(
      aggregateClassicAtaGroupStates(
        members.map((device) =>
          toClassicAtaGroupState(this.#getFacade(device)),
        ),
      ),
    )
  }

  /**
   * Reads the members' aggregated holiday-mode window, both bounds
   * projected onto the caller's clock. Same fold as
   * {@link getFrostProtection}; no wire call.
   * @returns A success result wrapping the aggregated state.
   */
  public async getHolidayMode(): Promise<Result<AggregatedHolidayModeState>> {
    const members = await Promise.resolve(this.devices)
    return ok(
      aggregateHolidayModeStates(
        members.map(({ data }) =>
          toHolidayModeState(data.holidayMode, this.#api.timezone),
        ),
      ),
    )
  }

  /**
   * Reads the ATA members' aggregated overheat protection (the feature
   * is ATA-only — ATW members hold none and are left out of the fold).
   * Same fold as {@link getFrostProtection}; no wire call.
   * @returns A success result wrapping the aggregated state.
   */
  public async getOverheatProtection(): Promise<
    Result<AggregatedProtectionState>
  > {
    const members = await Promise.resolve(this.#ataDevices)
    return ok(
      aggregateProtectionStates(
        members.map(({ data }) =>
          toHomeProtectionState(data.overheatProtection),
        ),
      ),
    )
  }

  /**
   * Updates every member's frost protection in one batch write, bounds
   * clamped into range.
   * @param update - The new frost-protection settings.
   */
  public async updateFrostProtection(update: ProtectionUpdate): Promise<void> {
    await pushHomeFrostProtection(this.#api, this.#memberUnits, update)
  }

  /**
   * Apply a Classic group state to every ATA member device. The delta is
   * translated to the Home vocabulary once, then fanned out; members
   * already matching it (a tolerated `NoChangesError` from their
   * update) are fine by definition and do not fail the group write.
   * @param state - Partial Classic group state to push to the members.
   * @throws The single member failure, or an `AggregateError` bundling
   * every member failure when more than one PUT rejects.
   */
  public async updateGroupState(state: ClassicGroupState): Promise<void> {
    const values = toHomeAtaValues(state)
    if (Object.keys(values).length === 0) {
      return
    }
    await settleMemberWrites(
      this.#ataDevices.map(async (device) =>
        tolerateNoChanges(async () =>
          this.#getFacade(device).updateValues(values),
        ),
      ),
      'Group update failed on members',
    )
  }

  /**
   * Updates every member's holiday-mode window in one batch write; an
   * enabled window's bounds are projected from the caller's clock onto
   * the wire's UTC.
   * @param update - The new holiday-mode window.
   */
  public async updateHolidayMode(update: HolidayModeUpdate): Promise<void> {
    await pushHomeHolidayMode(this.#api, this.#memberUnits, update)
  }

  /**
   * Updates the ATA members' overheat protection in one batch write
   * (ATW members are dropped — the feature is ATA-only); resolves
   * without a wire call when the building has no ATA member.
   * @param update - The new overheat-protection settings.
   */
  public async updateOverheatProtection(
    update: ProtectionUpdate,
  ): Promise<void> {
    await pushHomeOverheatProtection(this.#api, this.#memberUnits, update)
  }

  /**
   * Powers every member on or off — the per-target fan-out mirror of
   * the device facades' `updatePower`.
   * @param isOn - `true` to power on, `false` to power off.
   * @throws The single member failure, or an `AggregateError` bundling
   * every member failure when more than one PUT rejects.
   */
  public async updatePower(isOn = true): Promise<void> {
    await settleMemberWrites(
      this.devices.map(async ({ id }) =>
        this.#api.updateValues(id, { power: isOn }),
      ),
      'Power update failed on members',
    )
  }
}

// The fan-out failure policy shared by the member writes: settle every
// member, then surface the single failure as itself and several as one
// AggregateError — the thrown error is the write's only outcome channel.
const settleMemberWrites = async (
  writes: readonly Promise<void>[],
  failureMessage: string,
): Promise<void> => {
  const outcomes = await Promise.allSettled(writes)
  const failures = outcomes
    .filter(
      (outcome): outcome is PromiseRejectedResult =>
        outcome.status === 'rejected',
    )
    .map(({ reason }) => toError(reason))
  const [firstFailure] = failures
  if (firstFailure !== undefined && failures.length === 1) {
    throw firstFailure
  }
  if (failures.length > 1) {
    throw new AggregateError(failures, failureMessage)
  }
}
