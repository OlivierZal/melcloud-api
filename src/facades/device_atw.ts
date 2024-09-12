import {
  type OperationModeZoneDataAtw,
  type TemperatureDataAtw,
  type UpdateDeviceDataAtw,
  OperationModeZone,
} from '../types'
import BaseDeviceFacade, { alias } from './device'

const HEAT_COOL_GAP = OperationModeZone.room_cool - OperationModeZone.room
const ROOM_FLOW_GAP = OperationModeZone.flow - OperationModeZone.room

const NUMBER_O = 0
const MIN_FLOW_COOL_TEMP = 5
const MAX_FLOW_COOL_TEMP = 25
const MIN_FLOW_HEAT_TEMP = 25
const MAX_FLOW_HEAT_TEMP = 60
const MIN_ROOM_TEMP = 10
const MAX_ROOM_TEMP = 30

const handleTargetTemperature = (
  data: Partial<UpdateDeviceDataAtw>,
  key: keyof TemperatureDataAtw,
  { max, min }: { max: number; min: number },
): [keyof TemperatureDataAtw, number] => [
  key,
  Math.min(Math.max(data[key] ?? NUMBER_O, min), max),
]

export default class extends BaseDeviceFacade<'Atw'> {
  public override canCool = this.data.CanCool

  public override hasZone2 = this.data.HasZone2

  @alias('BoosterHeater1Status')
  public accessor boosterHeater1Status: unknown = undefined

  @alias('BoosterHeater2PlusStatus')
  public accessor boosterHeater2PlusStatus: unknown = undefined

  @alias('BoosterHeater2Status')
  public accessor boosterHeater2Status: unknown = undefined

  @alias('CondensingTemperature')
  public accessor condensingTemperature: unknown = undefined

  @alias('Zone1InCoolMode')
  public accessor coolMode: unknown = undefined

  @alias('Zone2InCoolMode')
  public accessor coolModeZone2: unknown = undefined

  @alias('EcoHotWater')
  public accessor ecoHotWater: unknown = undefined

  @alias('CurrentEnergyConsumed')
  public accessor energyConsumed: unknown = undefined

  @alias('CurrentEnergyProduced')
  public accessor energyProduced: unknown = undefined

  @alias('FlowTemperature')
  public accessor flowTemperature: unknown = undefined

  @alias('ForcedHotWaterMode')
  public accessor forcedHotWater: unknown = undefined

  @alias('HeatPumpFrequency')
  public accessor frequency: unknown = undefined

  @alias('Zone1InHeatMode')
  public accessor heatMode: unknown = undefined

  @alias('Zone2InHeatMode')
  public accessor heatModeZone2: unknown = undefined

  @alias('TankWaterTemperature')
  public accessor hotWaterTemperature: unknown = undefined

  @alias('IdleZone1')
  public accessor idle: unknown = undefined

  @alias('IdleZone2')
  public accessor idleZone2: unknown = undefined

  @alias('ImmersionHeaterStatus')
  public accessor immersionHeaterStatus: unknown = undefined

  @alias('LastLegionellaActivationTime')
  public accessor lastLegionella: unknown = undefined

  @alias('OperationModeZone1')
  public accessor mode: unknown = undefined

  @alias('OperationModeZone2')
  public accessor modeZone2: unknown = undefined

  @alias('OperationMode')
  public accessor operationMode: unknown = undefined

  @alias('OutdoorTemperature')
  public accessor outdoorTemperature: unknown = undefined

  @alias('Power')
  public accessor power: unknown = undefined

  @alias('ProhibitCoolingZone1')
  public accessor prohibitCooling: unknown = undefined

  @alias('ProhibitCoolingZone2')
  public accessor prohibitCoolingZone2: unknown = undefined

  @alias('ProhibitHeatingZone1')
  public accessor prohibitHeating: unknown = undefined

  @alias('ProhibitHeatingZone2')
  public accessor prohibitHeatingZone2: unknown = undefined

  @alias('ProhibitHotWater')
  public accessor prohibitHotWater: unknown = undefined

  @alias('ReturnTemperature')
  public accessor returnTemperature: unknown = undefined

  @alias('RoomTemperatureZone1')
  public accessor roomTemperature: unknown = undefined

  @alias('RoomTemperatureZone2')
  public accessor roomTemperatureZone2: unknown = undefined

  @alias('SetCoolFlowTemperatureZone1')
  public accessor targetCoolFlowTemperature: unknown = undefined

  @alias('SetCoolFlowTemperatureZone2')
  public accessor targetCoolFlowTemperatureZone2: unknown = undefined

  @alias('TargetHCTemperatureZone1')
  public accessor targetCurveTemperature: unknown = undefined

  @alias('TargetHCTemperatureZone2')
  public accessor targetCurveTemperatureZone2: unknown = undefined

  @alias('SetHeatFlowTemperatureZone1')
  public accessor targetHeatFlowTemperature: unknown = undefined

  @alias('SetHeatFlowTemperatureZone2')
  public accessor targetHeatFlowTemperatureZone2: unknown = undefined

  @alias('SetTankWaterTemperature')
  public accessor targetHotWaterTemperature: unknown = undefined

  @alias('SetTemperatureZone1')
  public accessor targetRoomTemperature: unknown = undefined

  @alias('SetTemperatureZone2')
  public accessor targetRoomTemperatureZone2: unknown = undefined

  get #targetTemperatureRanges(): [
    keyof TemperatureDataAtw,
    { max: number; min: number },
  ][] {
    return [
      [
        'SetCoolFlowTemperatureZone1',
        { max: MAX_FLOW_COOL_TEMP, min: MIN_FLOW_COOL_TEMP },
      ],
      [
        'SetCoolFlowTemperatureZone2',
        { max: MAX_FLOW_COOL_TEMP, min: MIN_FLOW_COOL_TEMP },
      ],
      [
        'SetHeatFlowTemperatureZone1',
        { max: MAX_FLOW_HEAT_TEMP, min: MIN_FLOW_HEAT_TEMP },
      ],
      [
        'SetHeatFlowTemperatureZone2',
        { max: MAX_FLOW_HEAT_TEMP, min: MIN_FLOW_HEAT_TEMP },
      ],
      [
        'SetTankWaterTemperature',
        { max: this.data.MaxTankTemperature, min: 40 },
      ],
      ['SetTemperatureZone1', { max: MAX_ROOM_TEMP, min: MIN_ROOM_TEMP }],
      ['SetTemperatureZone2', { max: MAX_ROOM_TEMP, min: MIN_ROOM_TEMP }],
    ]
  }

  protected override handle(
    data: Partial<UpdateDeviceDataAtw>,
  ): UpdateDeviceDataAtw {
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
  ): OperationModeZoneDataAtw {
    if (this.data.HasZone2) {
      const [operationModeZone1, operationModeZone2]: {
        value?: OperationModeZone
        key: keyof OperationModeZoneDataAtw
      }[] = [
        { key: 'OperationModeZone1', value: data.OperationModeZone1 },
        { key: 'OperationModeZone2', value: data.OperationModeZone2 },
      ]
      const [primaryOperationMode, secondaryOperationMode] =
        operationModeZone1.value === undefined ?
          [operationModeZone2, operationModeZone1]
        : [operationModeZone1, operationModeZone2]
      if (primaryOperationMode.value !== undefined) {
        const secondaryValue = this.#getSecondaryOperationMode(
          secondaryOperationMode.key,
          primaryOperationMode.value,
          secondaryOperationMode.value,
        )
        if (
          secondaryOperationMode.value !== undefined &&
          secondaryOperationMode.value !== secondaryValue
        ) {
          throw new Error('Operation modes conflict')
        }
        return {
          [primaryOperationMode.key]: primaryOperationMode.value,
          [secondaryOperationMode.key]: secondaryValue,
        }
      }
    }
    return {}
  }

  #handleTargetTemperatures(
    data: Partial<UpdateDeviceDataAtw>,
  ): TemperatureDataAtw {
    return Object.fromEntries(
      this.#targetTemperatureRanges.map(([key, { max, min }]) =>
        handleTargetTemperature(data, key, { max, min }),
      ),
    )
  }
}
