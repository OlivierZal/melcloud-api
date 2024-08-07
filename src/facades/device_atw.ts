import {
  type OperationModeZoneDataAtw,
  type TemperatureDataAtw,
  type UpdateDeviceDataAtw,
  OperationModeZone,
} from '../types'
import BaseDeviceFacade, { alias } from './device'

const HEAT_COOL_GAP = OperationModeZone.room_cool - OperationModeZone.room
const ROOM_FLOW_GAP = OperationModeZone.flow - OperationModeZone.room

const MIN_FLOW_COOL_TEMP = 5
const MAX_FLOW_COOL_TEMP = 25
const MIN_FLOW_HEAT_TEMP = 25
const MAX_FLOW_HEAT_TEMP = 60
const MIN_HOT_WATER_TEMP = 40
const MIN_ROOM_TEMP = 10
const MAX_ROOM_TEMP = 30

export default class extends BaseDeviceFacade<'Atw'> {
  public override canCool = this.data.CanCool

  public override hasZone2 = this.data.HasZone2

  @alias('BoosterHeater1Status')
  public accessor boosterHeater1Status: unknown = null

  @alias('BoosterHeater2PlusStatus')
  public accessor boosterHeater2PlusStatus: unknown = null

  @alias('BoosterHeater2Status')
  public accessor boosterHeater2Status: unknown = null

  @alias('CondensingTemperature')
  public accessor condensingTemperature: unknown = null

  @alias('Zone1InCoolMode')
  public accessor coolMode: unknown = null

  @alias('Zone2InCoolMode')
  public accessor coolModeZone2: unknown = null

  @alias('EcoHotWater')
  public accessor ecoHotWater: unknown = null

  @alias('CurrentEnergyConsumed')
  public accessor energyConsumed: unknown = null

  @alias('CurrentEnergyProduced')
  public accessor energyProduced: unknown = null

  @alias('FlowTemperature')
  public accessor flowTemperature: unknown = null

  @alias('ForcedHotWaterMode')
  public accessor forcedHotWater: unknown = null

  @alias('HeatPumpFrequency')
  public accessor frequency: unknown = null

  @alias('Zone1InHeatMode')
  public accessor heatMode: unknown = null

  @alias('Zone2InHeatMode')
  public accessor heatModeZone2: unknown = null

  @alias('TankWaterTemperature')
  public accessor hotWaterTemperature: unknown = null

  @alias('IdleZone1')
  public accessor idle: unknown = null

  @alias('IdleZone2')
  public accessor idleZone2: unknown = null

  @alias('ImmersionHeaterStatus')
  public accessor immersionHeaterStatus: unknown = null

  @alias('LastLegionellaActivationTime')
  public accessor lastLegionella: unknown = null

  @alias('OperationModeZone1')
  public accessor mode: unknown = null

  @alias('OperationModeZone2')
  public accessor modeZone2: unknown = null

  @alias('Power')
  public accessor power: unknown = null

  @alias('ProhibitCoolingZone1')
  public accessor prohibitCooling: unknown = null

  @alias('ProhibitCoolingZone2')
  public accessor prohibitCoolingZone2: unknown = null

  @alias('ProhibitHeatingZone1')
  public accessor prohibitHeating: unknown = null

  @alias('ProhibitHeatingZone2')
  public accessor prohibitHeatingZone2: unknown = null

  @alias('ProhibitHotWater')
  public accessor prohibitHotWater: unknown = null

  @alias('OperationMode')
  public accessor operationMode: unknown = null

  @alias('OutdoorTemperature')
  public accessor outdoorTemperature: unknown = null

  @alias('ReturnTemperature')
  public accessor returnTemperature: unknown = null

  @alias('SetCoolFlowTemperatureZone1')
  public accessor targetCoolFlowTemperature: unknown = null

  @alias('SetCoolFlowTemperatureZone2')
  public accessor targetCoolFlowTemperatureZone2: unknown = null

  @alias('TargetHCTemperatureZone1')
  public accessor targetCurveTemperature: unknown = null

  @alias('TargetHCTemperatureZone2')
  public accessor targetCurveTemperatureZone2: unknown = null

  @alias('SetHeatFlowTemperatureZone1')
  public accessor targetHeatFlowTemperature: unknown = null

  @alias('SetHeatFlowTemperatureZone2')
  public accessor targetHeatFlowTemperatureZone2: unknown = null

  @alias('SetTankWaterTemperature')
  public accessor targetHotWaterTemperature: unknown = null

  @alias('SetTemperatureZone1')
  public accessor targetRoomTemperature: unknown = null

  @alias('SetTemperatureZone2')
  public accessor targetRoomTemperatureZone2: unknown = null

  @alias('RoomTemperatureZone1')
  public accessor roomTemperature: unknown = null

  @alias('RoomTemperatureZone2')
  public accessor roomTemperatureZone2: unknown = null

  get #targetTemperatureRange(): Record<
    keyof TemperatureDataAtw,
    { max: number; min: number }
  > {
    return {
      SetCoolFlowTemperatureZone1: {
        max: MAX_FLOW_COOL_TEMP,
        min: MIN_FLOW_COOL_TEMP,
      },
      SetCoolFlowTemperatureZone2: {
        max: MAX_FLOW_COOL_TEMP,
        min: MIN_FLOW_COOL_TEMP,
      },
      SetHeatFlowTemperatureZone1: {
        max: MAX_FLOW_HEAT_TEMP,
        min: MIN_FLOW_HEAT_TEMP,
      },
      SetHeatFlowTemperatureZone2: {
        max: MAX_FLOW_HEAT_TEMP,
        min: MIN_FLOW_HEAT_TEMP,
      },
      SetTankWaterTemperature: {
        max: this.data.MaxTankTemperature,
        min: MIN_HOT_WATER_TEMP,
      },
      SetTemperatureZone1: { max: MAX_ROOM_TEMP, min: MIN_ROOM_TEMP },
      SetTemperatureZone2: { max: MAX_ROOM_TEMP, min: MIN_ROOM_TEMP },
    }
  }

  protected override handle(
    data: Partial<UpdateDeviceDataAtw>,
  ): UpdateDeviceDataAtw {
    return super.handle({
      ...data,
      ...this.#handleOperationModes(data),
      ...(
        Object.keys(
          this.#targetTemperatureRange,
        ) as (keyof TemperatureDataAtw)[]
      ).reduce(
        (acc, key) => ({
          ...acc,
          ...this.#handleTargetTemperature(data, key),
        }),
        {},
      ),
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
  ): Partial<UpdateDeviceDataAtw> {
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

  #handleTargetTemperature(
    data: Partial<UpdateDeviceDataAtw>,
    key: keyof TemperatureDataAtw,
  ): Partial<UpdateDeviceDataAtw> {
    const value = data[key]
    if (value !== undefined) {
      const { min, max } = this.#targetTemperatureRange[key]
      return { [key]: Math.min(Math.max(value, min), max) }
    }
    return {}
  }
}
