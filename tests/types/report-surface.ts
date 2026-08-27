/**
 * The report contract publishes NEUTRAL target interfaces (`/report`)
 * that the facades must genuinely satisfy — nothing binds a facade to
 * them at its declaration, so a drifted signature would only surface at
 * a consumer. These assertions turn that class of gap into a typecheck
 * failure naming the offending member.
 *
 * The negative pin matters as much: the Home ATA wire has no
 * hourly-temperatures and no operation-modes report, so its facade must
 * NOT grow those members — absence stays absent, nothing emulated.
 * @packageDocumentation
 */
import type { ClassicDeviceType } from '../../src/constants.ts'
import type {
  ClassicDeviceFacade,
  ClassicFacade,
} from '../../src/facades/classic-types.ts'
import type { HomeBuildingFacade } from '../../src/facades/home-building.ts'
import type { HomeDeviceAtaFacade } from '../../src/facades/home-device-ata.ts'
import type { HomeDeviceAtwFacade } from '../../src/facades/home-device-atw.ts'
import type {
  FullReportSurface,
  ReportSurface,
  SignalStrengthReportTarget,
} from '../../src/report.ts'

/**
 * Fails to instantiate when a member exists that the wire cannot
 * answer.
 * @template TMembers - The offending members, expected empty.
 */
type NothingEmulated<TMembers extends never> = TMembers

/**
 * Fails to instantiate when the target no longer satisfies the report
 * contract, and the compiler error names the drifted member.
 * @template TTarget - The facade type under assertion.
 * @template TContract - The report contract it must satisfy.
 */
type Satisfies<TTarget extends TContract, TContract> = TTarget

export type ClassicDeviceReportSurface = Satisfies<
  ClassicDeviceFacade<ClassicDeviceType>,
  FullReportSurface
>

// Zone facades (building/floor/area) chart only the signal of the five.
export type ClassicZoneReportSurface = Satisfies<
  ClassicFacade,
  SignalStrengthReportTarget
>

// The Home ATA wire has no hourly-temperatures and no operation-modes
// report, so its facade must not grow those members.
export type HomeAtaAbsentReads = NothingEmulated<
  Extract<
    keyof HomeDeviceAtaFacade,
    'getHourlyTemperatures' | 'getOperationModes'
  >
>

export type HomeAtaReportSurface = Satisfies<HomeDeviceAtaFacade, ReportSurface>

export type HomeAtwReportSurface = Satisfies<
  HomeDeviceAtwFacade,
  FullReportSurface
>

// The Home building emulates no chart read at all: reports stay
// device-scoped on that dialect.
export type HomeBuildingAbsentReads = NothingEmulated<
  Extract<keyof HomeBuildingFacade, keyof FullReportSurface>
>
