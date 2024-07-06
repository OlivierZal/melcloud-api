import BaseDeviceFacade, { mapTo } from './device'
import {
  OperationModeZone,
  type OperationModeZoneDataAtw,
  type TemperatureDataAtw,
  type UpdateDeviceDataAtw,
} from '../types'

const HEAT_COOL_GAP = OperationModeZone.room_cool
const ROOM_FLOW_GAP = OperationModeZone.flow

const MIN_FLOW_COOL_TEMPERATURE = 5
const MAX_FLOW_COOL_TEMPERATURE = 25
const MIN_FLOW_HEAT_TEMPERATURE = 25
const MAX_FLOW_HEAT_TEMPERATURE = 60
const MIN_HOT_WATER_TEMPERATURE = 40
const MAX_HOT_WATER_TEMPERATURE = 60
const MIN_ROOM_TEMPERATURE = 10
const MAX_ROOM_TEMPERATURE = 30

const TEMPERATURE_MAPPING: Record<
  keyof TemperatureDataAtw,
  { max: number; min: number }
> = {
  SetCoolFlowTemperatureZone1: {
    max: MAX_FLOW_COOL_TEMPERATURE,
    min: MIN_FLOW_COOL_TEMPERATURE,
  },
  SetCoolFlowTemperatureZone2: {
    max: MAX_FLOW_COOL_TEMPERATURE,
    min: MIN_FLOW_COOL_TEMPERATURE,
  },
  SetHeatFlowTemperatureZone1: {
    max: MAX_FLOW_HEAT_TEMPERATURE,
    min: MIN_FLOW_HEAT_TEMPERATURE,
  },
  SetHeatFlowTemperatureZone2: {
    max: MAX_FLOW_HEAT_TEMPERATURE,
    min: MIN_FLOW_HEAT_TEMPERATURE,
  },
  SetTankWaterTemperature: {
    max: MAX_HOT_WATER_TEMPERATURE,
    min: MIN_HOT_WATER_TEMPERATURE,
  },
  SetTemperatureZone1: {
    max: MAX_ROOM_TEMPERATURE,
    min: MIN_ROOM_TEMPERATURE,
  },
  SetTemperatureZone2: {
    max: MAX_ROOM_TEMPERATURE,
    min: MIN_ROOM_TEMPERATURE,
  },
}

const handleTargetTemperature = (
  data: Partial<UpdateDeviceDataAtw>,
  key: keyof TemperatureDataAtw,
): Partial<UpdateDeviceDataAtw> => {
  const value = data[key]
  const { min, max } = TEMPERATURE_MAPPING[key]
  if (typeof value !== 'undefined') {
    if (!value || value < min) {
      return { [key]: min }
    }
    if (value > max) {
      return { [key]: max }
    }
  }
  return {}
}

export default class extends BaseDeviceFacade<'Atw'> {
  @mapTo('BoosterHeater1Status')
  public accessor boosterHeater1Status: unknown = null

  @mapTo('BoosterHeater2PlusStatus')
  public accessor boosterHeater2PlusStatus: unknown = null

  @mapTo('BoosterHeater2Status')
  public accessor boosterHeater2Status: unknown = null

  @mapTo('CondesingTemperature')
  public accessor condensingTemperature: unknown = null

  @mapTo('Zone1InCoolMode')
  public accessor coolMode: unknown = null

  @mapTo('Zone2InCoolMode')
  public accessor coolModeZone2: unknown = null

  @mapTo('EcoHotWater')
  public accessor ecoHotWater: unknown = null

  @mapTo('CurrentEnergyConsumed')
  public accessor energyConsumed: unknown = null

  @mapTo('CurrentEnergyProduced')
  public accessor energyProduced: unknown = null

  @mapTo('FlowTemperature')
  public accessor flowTemperature: unknown = null

  @mapTo('ForcedHotWaterMode')
  public accessor forcedHotWater: unknown = null

  @mapTo('HeatPumpFrequency')
  public accessor frequency: unknown = null

  @mapTo('Zone1InHeatMode')
  public accessor heatMode: unknown = null

  @mapTo('Zone2InHeatMode')
  public accessor heatModeZone2: unknown = null

  @mapTo('TankWaterTemperature')
  public accessor hotWaterTemperature: unknown = null

  @mapTo('IdleZone1')
  public accessor idle: unknown = null

  @mapTo('IdleZone2')
  public accessor idleZone2: unknown = null

  @mapTo('ImmersionHeaterStatus')
  public accessor immersionHeaterStatus: unknown = null

  @mapTo('LastLegionellaActivationTime')
  public accessor lastLegionella: unknown = null

  @mapTo('OperationModeZone1')
  public accessor mode: unknown = null

  @mapTo('OperationModeZone2')
  public accessor modeZone2: unknown = null

  @mapTo('Power')
  public accessor power: unknown = null

  @mapTo('ProhibitCoolingZone1')
  public accessor prohibitCooling: unknown = null

  @mapTo('ProhibitCoolingZone2')
  public accessor prohibitCoolingZone2: unknown = null

  @mapTo('ProhibitHeatingZone1')
  public accessor prohibitHeating: unknown = null

  @mapTo('ProhibitHeatingZone2')
  public accessor prohibitHeatingZone2: unknown = null

  @mapTo('ProhibitHotWater')
  public accessor prohibitHotWater: unknown = null

  @mapTo('OperationMode')
  public accessor operationMode: unknown = null

  @mapTo('OutdoorTemperature')
  public accessor outdoorTemperature: unknown = null

  @mapTo('ReturnTemperature')
  public accessor returnTemperature: unknown = null

  @mapTo('SetCoolFlowTemperatureZone1')
  public accessor targetCoolFlowTemperature: unknown = null

  @mapTo('SetCoolFlowTemperatureZone2')
  public accessor targetCoolFlowTemperatureZone2: unknown = null

  @mapTo('TargetHCTemperatureZone1')
  public accessor targetCurveTemperature: unknown = null

  @mapTo('TargetHCTemperatureZone2')
  public accessor targetCurveTemperatureZone2: unknown = null

  @mapTo('SetHeatFlowTemperature')
  public accessor targetHeatFlowTemperature: unknown = null

  @mapTo('SetHeatFlowTemperatureZone2')
  public accessor targetHeatFlowTemperatureZone2: unknown = null

  @mapTo('SetTankWaterTemperature')
  public accessor targetHotWaterTemperature: unknown = null

  @mapTo('SetTemperatureZone1')
  public accessor targetRoomTemperature: unknown = null

  @mapTo('SetTemperatureZone2')
  public accessor targetRoomTemperatureZone2: unknown = null

  @mapTo('RoomTemperatureZone1')
  public accessor roomTemperature: unknown = null

  @mapTo('RoomTemperatureZone2')
  public accessor roomTemperatureZone2: unknown = null

  protected override handle(
    data: Partial<UpdateDeviceDataAtw>,
  ): UpdateDeviceDataAtw {
    return super.handle({
      ...data,
      ...this.#handleOtherOperationModeZone(data),
      ...(
        Object.keys(TEMPERATURE_MAPPING) as (keyof TemperatureDataAtw)[]
      ).reduce(
        (acc, key) => ({
          ...acc,
          ...handleTargetTemperature(data, key),
        }),
        {},
      ),
    })
  }

  #getOtherOperationMode(
    value: OperationModeZone,
    otherKey: keyof OperationModeZoneDataAtw,
    otherValue?: OperationModeZone,
  ): OperationModeZone {
    let newValue = otherValue ?? this.data[otherKey]
    if (this.data.CanCool) {
      if (value > OperationModeZone.curve) {
        newValue =
          newValue === OperationModeZone.curve ?
            HEAT_COOL_GAP
          : newValue + HEAT_COOL_GAP
      } else if (newValue > OperationModeZone.curve) {
        newValue -= HEAT_COOL_GAP
      }
    }
    if (
      [OperationModeZone.room, OperationModeZone.room_cool].includes(value) &&
      newValue === value
    ) {
      newValue += ROOM_FLOW_GAP
    }
    return newValue
  }

  #handleOtherOperationModeZone(
    data: Partial<UpdateDeviceDataAtw>,
  ): Partial<UpdateDeviceDataAtw> {
    if (this.data.HasZone2) {
      const [value1, value2] = [
        data.OperationModeZone1,
        data.OperationModeZone2,
      ]
      const [[key, value], [otherKey, otherValue]]: [
        keyof OperationModeZoneDataAtw,
        OperationModeZone | undefined,
      ][] =
        typeof value2 === 'undefined' ?
          [
            ['OperationModeZone1', value1],
            ['OperationModeZone2', value2],
          ]
        : [
            ['OperationModeZone2', value2],
            ['OperationModeZone1', value1],
          ]
      if (typeof value !== 'undefined') {
        const newValue = this.#getOtherOperationMode(
          value,
          otherKey,
          otherValue,
        )
        if (typeof otherValue !== 'undefined' && newValue !== otherValue) {
          throw new Error('Operation modes conflict')
        }
        return {
          [key]: value,
          [otherKey]: newValue,
        }
      }
    }
    return {}
  }
}
