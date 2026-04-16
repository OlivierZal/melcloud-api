import type {
  OperationModeZoneDataAtw,
  UpdateDeviceDataAtw,
  ZoneState,
} from '../types/index.ts'
import { OperationModeZone } from '../constants.ts'
import { ClassicDeviceAtwFacade } from './classic-device-atw.ts'

/*
 * Operation modes follow a pattern: room (0) vs flow (1), with cool variants
 * offset by 3. These gaps let us auto-adjust zone 2 when zone 1 changes.
 */
const HEAT_COOL_GAP = OperationModeZone.room_cool - OperationModeZone.room
const ROOM_FLOW_GAP = OperationModeZone.flow - OperationModeZone.room
const roomOperationModeZones: ReadonlySet<OperationModeZone> = new Set([
  OperationModeZone.room,
  OperationModeZone.room_cool,
])
const operationModeZoneByValue: ReadonlyMap<number, OperationModeZone> =
  new Map(Object.values(OperationModeZone).map((value) => [value, value]))

const toOperationModeZone = (value: number): OperationModeZone => {
  const mode = operationModeZoneByValue.get(value)

  if (mode === undefined) {
    throw new Error(`Invalid OperationModeZone: ${String(value)}`)
  }

  return mode
}

/**
 * Extended ATW facade for units with two zones. Automatically couples zone operation
 * modes so that cooling and room/flow modes stay consistent between zones.
 */
export class ClassicDeviceAtwHasZone2Facade extends ClassicDeviceAtwFacade {
  public get zone2(): ZoneState {
    return this.getZoneState('Zone2')
  }

  protected override readonly internalTemperaturesLegend = [
    'FlowTemperature',
    'FlowTemperatureBoiler',
    'FlowTemperatureZone1',
    'FlowTemperatureZone2',
    'ReturnTemperature',
    'ReturnTemperatureBoiler',
    'ReturnTemperatureZone1',
    'ReturnTemperatureZone2',
    'SetTankWaterTemperature',
    'TankWaterTemperature',
    'MixingTankWaterTemperature',
  ]

  protected override readonly temperaturesLegend = [
    'SetTemperatureZone1',
    'RoomTemperatureZone1',
    'SetTemperatureZone2',
    'RoomTemperatureZone2',
    'OutdoorTemperature',
    'TankWaterTemperature',
    'SetTankWaterTemperature',
  ]

  protected override prepareUpdateData(
    data: Partial<UpdateDeviceDataAtw>,
  ): Required<UpdateDeviceDataAtw> {
    return super.prepareUpdateData({
      ...data,
      ...this.#coupleOperationModes(data),
    })
  }

  #coupleOperationModes(
    data: Partial<UpdateDeviceDataAtw>,
  ): OperationModeZoneDataAtw | null {
    const [operationModeZone1, operationModeZone2]: {
      key: keyof OperationModeZoneDataAtw
      value?: OperationModeZone
    }[] = [
      { key: 'OperationModeZone1', value: data.OperationModeZone1 },
      { key: 'OperationModeZone2', value: data.OperationModeZone2 },
    ]

    /*
     * Whichever zone was explicitly changed becomes the primary; the other
     * is automatically adjusted to maintain consistency
     */
    const [primaryOperationMode, secondaryOperationMode] =
      operationModeZone1?.value === undefined ?
        [operationModeZone2, operationModeZone1]
      : [operationModeZone1, operationModeZone2]

    if (primaryOperationMode?.value === undefined || !secondaryOperationMode) {
      return null
    }
    return {
      [primaryOperationMode.key]: primaryOperationMode.value,
      [secondaryOperationMode.key]: this.#getSecondaryOperationMode(
        secondaryOperationMode.key,
        primaryOperationMode.value,
        secondaryOperationMode.value,
      ),
    }
  }

  #getSecondaryOperationMode(
    secondaryKey: keyof OperationModeZoneDataAtw,
    primaryValue: OperationModeZone,
    value?: OperationModeZone,
  ): OperationModeZone {
    /*
     * Keep zone 2's cool/heat status in sync with zone 1, and prevent
     * both zones from using the same room-based mode (must be room vs flow)
     */
    let secondaryValue: number = value ?? this.data[secondaryKey]
    if (this.data.CanCool) {
      if (primaryValue > OperationModeZone.curve) {
        secondaryValue =
          secondaryValue === OperationModeZone.curve ?
            OperationModeZone.room_cool
          : secondaryValue + HEAT_COOL_GAP
      } else if (secondaryValue > OperationModeZone.curve) {
        secondaryValue -= HEAT_COOL_GAP
      }
    }
    if (
      roomOperationModeZones.has(primaryValue) &&
      primaryValue === secondaryValue
    ) {
      secondaryValue += ROOM_FLOW_GAP
    }
    return toOperationModeZone(secondaryValue)
  }
}
