import { OperationModeZone, type DeviceType } from '../enums.ts'

import { BaseDeviceFacade } from './base-device.ts'

import type {
  OperationModeZoneDataAtw,
  TemperatureDataAtw,
  UpdateDeviceDataAtw,
} from '../types/atw.ts'

import type { IDeviceFacade } from './interfaces.ts'

const DEFAULT_TEMPERATURE = 0
const HEAT_COOL_GAP = OperationModeZone.room_cool - OperationModeZone.room
const ROOM_FLOW_GAP = OperationModeZone.flow - OperationModeZone.room

const coolFlowTemperatureRange = { max: 25, min: 5 } as const
const heatFlowTemperatureRange = { max: 60, min: 25 } as const
const roomTemperatureRange = { max: 30, min: 10 } as const

export class DeviceAtwFacade
  extends BaseDeviceFacade<DeviceType.Atw>
  implements IDeviceFacade<DeviceType.Atw>
{
  protected override readonly temperatureLegend = [
    'SetTemperatureZone1',
    'RoomTemperatureZone1',
    'OutdoorTemperature',
    'TankWaterTemperature',
    'SetTankWaterTemperature',
    '',
  ]

  public readonly flags = {
    ForcedHotWaterMode: 0x10000,
    OperationModeZone1: 0x8,
    OperationModeZone2: 0x10,
    Power: 0x1,
    SetCoolFlowTemperatureZone1: 0x1000000000000,
    SetCoolFlowTemperatureZone2: 0x1000000000000,
    SetHeatFlowTemperatureZone1: 0x1000000000000,
    SetHeatFlowTemperatureZone2: 0x1000000000000,
    SetTankWaterTemperature: 0x1000000000020,
    SetTemperatureZone1: 0x200000080,
    SetTemperatureZone2: 0x800000200,
  } as const

  readonly #canCool = this.data.CanCool

  readonly #hasZone2 = this.data.HasZone2

  get #targetTemperatureRanges(): [
    keyof TemperatureDataAtw,
    { max: number; min: number },
  ][] {
    return [
      ['SetCoolFlowTemperatureZone1', coolFlowTemperatureRange],
      ['SetCoolFlowTemperatureZone2', coolFlowTemperatureRange],
      ['SetHeatFlowTemperatureZone1', heatFlowTemperatureRange],
      ['SetHeatFlowTemperatureZone2', heatFlowTemperatureRange],
      [
        'SetTankWaterTemperature',
        { max: this.data.MaxTankTemperature, min: 40 },
      ],
      ['SetTemperatureZone1', roomTemperatureRange],
      ['SetTemperatureZone2', roomTemperatureRange],
    ]
  }

  protected override handle(
    data: Partial<UpdateDeviceDataAtw>,
  ): Required<UpdateDeviceDataAtw> {
    return super.handle({
      ...data,
      ...this.#handleOperationModes(data),
      ...this.#handleTargetTemperatures(data),
    })
  }

  #getSecondaryOperationMode(
    secondaryKey: keyof OperationModeZoneDataAtw,
    primaryValue: OperationModeZone,
    value?: OperationModeZone,
  ): OperationModeZone {
    let secondaryValue = value ?? this.data[secondaryKey]
    if (this.#canCool) {
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
  ): OperationModeZoneDataAtw {
    if (this.#hasZone2) {
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
    return {}
  }

  #handleTargetTemperatures(
    data: Partial<UpdateDeviceDataAtw>,
  ): TemperatureDataAtw {
    return Object.fromEntries(
      this.#targetTemperatureRanges
        .filter(([key]) => key in data)
        .map(([key, { max, min }]) => [
          key,
          Math.min(Math.max(data[key] ?? DEFAULT_TEMPERATURE, min), max),
        ]),
    )
  }
}
