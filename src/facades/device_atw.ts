import {
  type OperationModeZone,
  flagsAtw,
  setDataMappingAtw,
  valueMappingAtw,
} from '../types'
import BaseDeviceFacade from './device'

export default class extends BaseDeviceFacade<'Atw'> {
  protected readonly flags = flagsAtw

  protected readonly setDataMapping = setDataMappingAtw

  protected readonly valueMapping = valueMappingAtw

  public get coolFlowTemperature(): number {
    return this.data.SetCoolFlowTemperatureZone1
  }

  public get coolFlowTemperatureZone2(): number {
    return this.data.SetCoolFlowTemperatureZone2
  }

  public get forcedHotWater(): boolean {
    return this.data.ForcedHotWaterMode
  }

  public get heatFlowTemperature(): number {
    return this.data.SetHeatFlowTemperatureZone1
  }

  public get heatFlowTemperatureZone2(): number {
    return this.data.SetHeatFlowTemperatureZone2
  }

  public get hotWaterTemperature(): number {
    return this.data.SetTankWaterTemperature
  }

  public get mode(): OperationModeZone {
    return this.data.OperationModeZone1
  }

  public get modeZone2(): OperationModeZone {
    return this.data.OperationModeZone2
  }

  public get temperature(): number {
    return this.data.SetTemperatureZone1
  }

  public get temperatureZone2(): number {
    return this.data.SetTemperatureZone2
  }
}
