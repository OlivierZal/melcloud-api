/**
 * Cross-dialect ATW state vocabulary: the zone and hot-water snapshots
 * both dialects project onto. The Classic wire carries flag refinements
 * (idle, in-cool/heat-mode, per-direction prohibitions, eco hot water,
 * the reported tank maximum) the Home wire does not — those fields are
 * nullable here, `null` meaning "this wire cannot say", and the Classic
 * projections keep them precise through their own extensions.
 */
import type {
  ClassicOperationModeStateHotWater,
  ClassicOperationModeStateZone,
  HomeAtwZoneMode,
} from './constants.ts'

/**
 * Hot-water snapshot of an ATW unit in the cross-dialect vocabulary.
 * @category Types
 */
export interface AtwHotWaterState {
  /**
   * Whether eco hot-water mode is on; `null` where the wire cannot say
   * (Home).
   */
  readonly isEcoHotWater: boolean | null
  /**
   * Whether forced hot-water production is on.
   */
  readonly isForcedMode: boolean
  /**
   * Whether hot-water production is currently inhibited.
   */
  readonly isProhibited: boolean
  /**
   * Reported tank maximum, in °C; `null` where the wire cannot say
   * (Home only advertises the setpoint clamp bound, a different thing).
   */
  readonly maxTankTemperature: number | null
  /**
   * Derived hot-water operational state, same precedence on both
   * dialects: forced reads `dhw`, prohibited reads `prohibited`, else
   * the operation mode decides between `dhw`, `legionella` and `idle`.
   */
  readonly operationalState: ClassicOperationModeStateHotWater
  /**
   * Tank-water setpoint, in °C.
   */
  readonly setTankWaterTemperature: number
  /**
   * Last-reported tank-water temperature, in °C.
   */
  readonly tankWaterTemperature: number
}

/**
 * Heating/cooling snapshot of one ATW zone in the cross-dialect
 * vocabulary. `operationMode` speaks the shared string form — the
 * Classic member names, the Home wire-normalized values and the
 * consumer capability ids are one vocabulary; the Classic facade
 * projects its numeric wire form through the total bijection.
 * @category Types
 */
export interface AtwZoneState {
  /**
   * Whether cooling is prohibited on the zone; `null` where the wire
   * cannot say (Home).
   */
  readonly isCoolingProhibited: boolean | null
  /**
   * Whether heating is prohibited on the zone; `null` where the wire
   * cannot say (Home).
   */
  readonly isHeatingProhibited: boolean | null
  /**
   * Whether the zone reports idle; `null` where the wire cannot say
   * (Home).
   */
  readonly isIdle: boolean | null
  /**
   * Whether the zone is in a cooling mode; `null` where the wire cannot
   * say (Home).
   */
  readonly isInCoolMode: boolean | null
  /**
   * Whether the zone is in a heating mode; `null` where the wire cannot
   * say (Home).
   */
  readonly isInHeatMode: boolean | null
  /**
   * Derived zone operational state. Only the Classic flag refinements
   * can produce `prohibited`; the Home projection never does.
   */
  readonly operationalState: ClassicOperationModeStateZone
  /**
   * Zone control basis (room thermostat / fixed flow / weather curve,
   * heat or cool), in the shared string vocabulary.
   */
  readonly operationMode: HomeAtwZoneMode
  /**
   * Last-reported room temperature of the zone, in °C.
   */
  readonly roomTemperature: number
  /**
   * Zone setpoint, in °C.
   */
  readonly setTemperature: number
}
