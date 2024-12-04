import { OperationModeZone } from '../enums.ts'

import { DeviceAtwFacade } from './device-atw.ts'

import type {
  OperationModeZoneDataAtw,
  UpdateDeviceDataAtw,
} from '../types/atw.ts'

const HEAT_COOL_GAP = OperationModeZone.room_cool - OperationModeZone.room
const ROOM_FLOW_GAP = OperationModeZone.flow - OperationModeZone.room

export class DeviceAtwHasZone2Facade extends DeviceAtwFacade {
  protected override readonly internalTemperaturesLegend = [
    'FlowTemperature',
    undefined,
    'FlowTemperatureZone1',
    'FlowTemperatureZone2',
    'ReturnTemperature',
    undefined,
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

  protected override handle(
    data: Partial<UpdateDeviceDataAtw>,
  ): Required<UpdateDeviceDataAtw> {
    return super.handle({
      ...data,
      ...this.#handleOperationModes(data),
    })
  }

  #getSecondaryOperationMode(
    secondaryKey: keyof OperationModeZoneDataAtw,
    primaryValue: OperationModeZone,
    value?: OperationModeZone,
  ): OperationModeZone {
    let secondaryValue = value ?? this.data[secondaryKey]
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
      [OperationModeZone.room, OperationModeZone.room_cool].includes(
        primaryValue,
      ) &&
      primaryValue === secondaryValue
    ) {
      secondaryValue += ROOM_FLOW_GAP
    }
    return secondaryValue
  }

  #handleOperationModes(
    data: Partial<UpdateDeviceDataAtw>,
  ): OperationModeZoneDataAtw | undefined {
    const [operationModeZone1, operationModeZone2]: {
      key: keyof OperationModeZoneDataAtw
      value?: OperationModeZone
    }[] = [
      { key: 'OperationModeZone1', value: data.OperationModeZone1 },
      { key: 'OperationModeZone2', value: data.OperationModeZone2 },
    ]
    const [primaryOperationMode, secondaryOperationMode] =
      operationModeZone1.value === undefined ?
        [operationModeZone2, operationModeZone1]
      : [operationModeZone1, operationModeZone2]
    if (primaryOperationMode.value !== undefined) {
      return {
        [primaryOperationMode.key]: primaryOperationMode.value,
        [secondaryOperationMode.key]: this.#getSecondaryOperationMode(
          secondaryOperationMode.key,
          primaryOperationMode.value,
          secondaryOperationMode.value,
        ),
      }
    }
  }
}
