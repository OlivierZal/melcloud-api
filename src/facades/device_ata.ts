import {
  type FanSpeed,
  type Horizontal,
  type OperationMode,
  type Vertical,
  flagsAta,
  setDataMappingAta,
  setKeyMappingAta,
} from '../types'
import BaseDeviceFacade from './device'

export default class extends BaseDeviceFacade<'Ata'> {
  protected readonly flags = flagsAta

  protected readonly setDataMapping = setDataMappingAta

  protected readonly setKeyMapping = setKeyMappingAta

  public get fan(): FanSpeed {
    return this.data.FanSpeed
  }

  public get horizontal(): Horizontal {
    return this.data.VaneHorizontalDirection
  }

  public get mode(): OperationMode {
    return this.data.OperationMode
  }

  public get temperature(): number {
    return this.data.SetTemperature
  }

  public get vertical(): Vertical {
    return this.data.VaneVerticalDirection
  }
}
