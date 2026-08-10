/**
 * Classic facades publish INTERFACES, not their implementation classes:
 * the classes carry `#`-private members, which would make the published
 * names non-assignable to what the SDK returns (see `facades/index.ts`).
 * The cost of that choice is a hand-kept mirror — a public member added
 * to a class is invisible to consumers until someone re-declares it.
 *
 * `getTemperatureRange` shipped that way in 47.1.0: implemented on the
 * class, absent from the interface, and only a consumer's `TS2551` found
 * it. These assertions turn that class of gap into a typecheck failure
 * naming the missing member.
 * @packageDocumentation
 */
import type { ClassicDeviceType } from '../../src/constants.ts'
import type { ClassicBuildingFacade as BuildingClass } from '../../src/facades/classic-building.ts'
import type { ClassicDeviceAtaFacade as AtaClass } from '../../src/facades/classic-device-ata.ts'
import type { ClassicDeviceAtwHasZone2Facade as Zone2Class } from '../../src/facades/classic-device-atw-dual-zone.ts'
import type { ClassicDeviceAtwFacade as AtwClass } from '../../src/facades/classic-device-atw.ts'
import type { ClassicDeviceErvFacade as ErvClass } from '../../src/facades/classic-device-erv.ts'
import type {
  ClassicDeviceAtaFacade as AtaInterface,
  ClassicDeviceAtwFacade as AtwInterface,
  ClassicBuildingFacade as BuildingInterface,
  ClassicDeviceFacade,
  ClassicDeviceAtwHasZone2Facade as Zone2Interface,
} from '../../src/facades/classic-types.ts'

/**
 * Fails to instantiate when the mirror has drifted, and the compiler
 * error names the members left unpublished.
 * @template TMembers - The gap, expected empty.
 */
type NothingUnpublished<TMembers extends never> = TMembers

/**
 * Public members a class carries but its published interface omits.
 * `#`-private members never reach `keyof`, so only the surface consumers
 * could reasonably expect is compared.
 * @template TClass - The implementation class.
 * @template TInterface - The interface published under the same name.
 */
type UnpublishedMembers<TClass, TInterface> = Exclude<
  keyof TClass,
  keyof TInterface
>

export type AtaSurface = NothingUnpublished<
  UnpublishedMembers<AtaClass, AtaInterface>
>

export type AtwSurface = NothingUnpublished<
  UnpublishedMembers<AtwClass, AtwInterface>
>

export type BuildingSurface = NothingUnpublished<
  UnpublishedMembers<BuildingClass, BuildingInterface>
>

export type ErvSurface = NothingUnpublished<
  UnpublishedMembers<
    ErvClass,
    ClassicDeviceFacade<typeof ClassicDeviceType.Erv>
  >
>

export type Zone2Surface = NothingUnpublished<
  UnpublishedMembers<Zone2Class, Zone2Interface>
>
