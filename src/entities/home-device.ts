import type {
  HomeAtaDeviceData,
  HomeAtwDeviceData,
  HomeBuildingRef,
  HomeDeviceData,
} from '../types/index.ts'
import { HomeDeviceType } from '../constants.ts'
import { Temporal } from '../temporal.ts'
import { hasOutlivedStaleWindow } from './types.ts'

/**
 * One edge of a Home unit's `isConnected` streak, as a sync reports it.
 * `disconnected` opens the streak (the first `false`, a constructing
 * payload included); `stale` fires ONCE per streak, on the first sync
 * whose streak age exceeds {@link STALE_COMMUNICATION_HOURS} — the same
 * predicate the facade's `isAvailable` reads, evaluated here at sync
 * time where the facade evaluates it at read time, so the edge follows
 * the flip at the next sync (up to one sync interval later) — and
 * carries the streak's start; `reconnected` closes it with that start
 * and the number of disconnected syncs it spanned. A steady state
 * either way is `null`, not a member: these are edges, so a flag that
 * flaps is reported as the open/close pairs it produces.
 * @category Entities
 */
export type HomeConnectivityTransition =
  | { readonly kind: 'disconnected' }
  | {
      readonly kind: 'reconnected'
      readonly since: Temporal.PlainDateTime
      readonly syncs: number
    }
  | { readonly kind: 'stale'; readonly since: Temporal.PlainDateTime }

/**
 * Mutable wrapper around a {@link HomeDeviceData}, preserving object identity across syncs.
 * `TData` narrows the wrapped payload to a specific connection-type variant
 * (e.g. {@link HomeAtaDeviceData}) when callers have already discriminated on
 * {@link HomeDevice.type}; defaults to the full union for the registry.
 * @template TData - Wrapped wire-format payload variant: a connection-type
 * specific shape once discriminated, or the full {@link HomeDeviceData} union
 * by default.
 * @category Entities
 */
export class HomeDevice<TData extends HomeDeviceData = HomeDeviceData> {
  /**
   * The transition the constructing payload opened: `disconnected` when
   * it read `isConnected: false`, `null` otherwise. Registry-internal
   * like {@link HomeDevice.sync}: the registry reads it on upsert so a
   * unit that JOINS disconnected is reported like one that flips.
   */
  public readonly initialTransition: HomeConnectivityTransition | null

  public readonly type: HomeDeviceType

  /**
   * Identity of the `/context` building this device was sourced from on
   * the latest sync — the account-level grouping key. Restated on every
   * sync, so a device moved between buildings follows its new home.
   * @returns The building id and display name.
   */
  public get building(): HomeBuildingRef {
    return this.#building
  }

  /**
   * Last-synced wire-format payload for this device.
   * @returns A read-only snapshot of the device data.
   */
  public get data(): Readonly<TData> {
    return this.#data
  }

  /**
   * First instant (UTC) since which every sync has reported the unit
   * disconnected, or `null` while it reads connected. In-memory only: a
   * fresh wrapper (new registry after a re-login, host restart)
   * restarts the clock — deliberately conservative for the availability
   * hysteresis.
   * @returns The start of the current disconnection streak, if any.
   */
  public get disconnectedSince(): Temporal.PlainDateTime | null {
    return this.#disconnectedSince
  }

  /**
   * Unique device identifier as assigned by MELCloud Home.
   * @returns The GUID string assigned by MELCloud Home.
   */
  public get id(): string {
    return this.#data.id
  }

  /**
   * Whether the current account owns this device (sourced from
   * `context.buildings`) rather than being a guest of it (sourced from
   * `context.guestBuildings`). Reports the structural origin only:
   * `false` does not by itself prove a guest is barred from control.
   * @returns `true` when owned, `false` when shared with this account.
   */
  public get isOwner(): boolean {
    return this.#isOwner
  }

  /**
   * User-facing display name set in the MELCloud Home app.
   * @returns The device's display name.
   */
  public get name(): string {
    return this.#data.givenDisplayName
  }

  #building: HomeBuildingRef

  #data: TData

  #disconnectedSince: Temporal.PlainDateTime | null = null

  // Disconnected syncs of the current streak, so the closing line can
  // say how many cycles the unit read `false` — and whether a streak
  // was one flap or a day of them.
  #disconnectedSyncs = 0

  // The `stale` edge fires once per streak: set when it does, cleared
  // when the streak closes.
  #hasReadStale = false

  #isOwner: boolean

  /**
   * Builds a Home device wrapper from a wire-format {@link HomeDeviceData}
   * entry tagged with its connection type (Ata or Atw) and ownership origin.
   * @param entry - Wire-format device payload tagged with its connection
   * type, ownership origin and source building.
   * @param entry.building - Identity of the `/context` building the
   * payload was sourced from.
   * @param entry.device - Wire-format device payload.
   * @param entry.isOwner - `true` when sourced from an owned building,
   * `false` when sourced from a guest one.
   * @param entry.type - Connection-type discriminator.
   */
  public constructor(entry: {
    building: HomeBuildingRef
    device: TData
    isOwner: boolean
    type: HomeDeviceType
  }) {
    this.#building = entry.building
    this.#data = entry.device
    this.#isOwner = entry.isOwner
    this.type = entry.type
    this.initialTransition = this.#trackConnectivity()
  }

  /**
   * Type predicate that narrows this wrapper to the ATA variant when its
   * connection-type discriminator is {@link HomeDeviceType.Ata}.
   * @returns `true` when the wrapped payload is an ATA device.
   */
  public isAta(): this is HomeDevice<HomeAtaDeviceData> {
    return this.type === HomeDeviceType.Ata
  }

  /**
   * Type predicate that narrows this wrapper to the ATW variant when its
   * connection-type discriminator is {@link HomeDeviceType.Atw}.
   * @returns `true` when the wrapped payload is an ATW device.
   */
  public isAtw(): this is HomeDevice<HomeAtwDeviceData> {
    return this.type === HomeDeviceType.Atw
  }

  /**
   * Replaces the internal data snapshot with a fresh payload while
   * preserving the wrapper's object identity. Every sync restates the
   * ownership origin, so a share/unshare between syncs is reflected
   * rather than kept from a stale tag.
   *
   * Registry-internal by contract (the Home mirror of Classic's
   * non-exported `syncDevice`): consumers read, the registry writes.
   * @param device - Fresh wire-format device payload.
   * @param isOwner - Ownership origin from the current sync.
   * @param building - Building identity from the current sync.
   * @returns The connectivity edge this sync crossed, `null` for a
   * steady state either way.
   */
  public sync(
    device: TData,
    isOwner: boolean,
    building: HomeBuildingRef,
  ): HomeConnectivityTransition | null {
    this.#building = building
    this.#data = device
    this.#isOwner = isOwner
    return this.#trackConnectivity()
  }

  // Closing a streak yields `reconnected` with its start and length; a
  // connected read over no streak is the steady state.
  #closeStreak(): HomeConnectivityTransition | null {
    const since = this.#disconnectedSince
    if (since === null) {
      return null
    }
    const syncs = this.#disconnectedSyncs
    this.#disconnectedSince = null
    this.#disconnectedSyncs = 0
    this.#hasReadStale = false
    return { kind: 'reconnected', since, syncs }
  }

  // Opening a streak yields `disconnected`; the first extension past
  // the stale window yields `stale`, once — the facade's `isAvailable`
  // flips on the same predicate, read at read time, so the edge is the
  // next sync's reading of it, at most one sync interval behind the
  // flip; every other extension is the steady state.
  #extendStreak(): HomeConnectivityTransition | null {
    this.#disconnectedSyncs += 1
    if (this.#disconnectedSince === null) {
      this.#disconnectedSince = Temporal.Now.plainDateTimeISO('UTC')
      return { kind: 'disconnected' }
    }
    if (
      this.#hasReadStale ||
      !hasOutlivedStaleWindow(this.#disconnectedSince)
    ) {
      return null
    }
    this.#hasReadStale = true
    return { kind: 'stale', since: this.#disconnectedSince }
  }

  // A connected sync resets the streak; a disconnected one only stamps
  // its start, so the timestamp marks the oldest uninterrupted `false`.
  // The result is the EDGE the sync crossed, `null` for a steady state.
  #trackConnectivity(): HomeConnectivityTransition | null {
    return this.#data.isConnected ? this.#closeStreak() : this.#extendStreak()
  }
}
