import BaseDeviceFacade, { isValue } from './device'
import type { OperationModeZone } from '../types'

export default class extends BaseDeviceFacade<'Atw'> {
  @isValue
  public get coolFlowTemperature(): number {
    return this.data.SetCoolFlowTemperatureZone1
  }

  @isValue
  public get coolFlowTemperatureZone2(): number {
    return this.data.SetCoolFlowTemperatureZone2
  }

  @isValue
  public get forcedHotWater(): boolean {
    return this.data.ForcedHotWaterMode
  }

  @isValue
  public get heatFlowTemperature(): number {
    return this.data.SetHeatFlowTemperatureZone1
  }

  @isValue
  public get heatFlowTemperatureZone2(): number {
    return this.data.SetHeatFlowTemperatureZone2
  }

  @isValue
  public get hotWaterTemperature(): number {
    return this.data.SetTankWaterTemperature
  }

  @isValue
  public get mode(): OperationModeZone {
    return this.data.OperationModeZone1
  }

  @isValue
  public get modeZone2(): OperationModeZone {
    return this.data.OperationModeZone2
  }

  @isValue
  public get temperature(): number {
    return this.data.SetTemperatureZone1
  }

  @isValue
  public get temperatureZone2(): number {
    return this.data.SetTemperatureZone2
  }
}
