import BaseDeviceFacade, { isValue } from './device'
import type { FanSpeed, Horizontal, OperationMode, Vertical } from '../types'

export default class extends BaseDeviceFacade<'Ata'> {
  @isValue
  public get fan(): FanSpeed {
    return this.data.FanSpeed
  }

  @isValue
  public get horizontal(): Horizontal {
    return this.data.VaneHorizontalDirection
  }

  @isValue
  public get mode(): OperationMode {
    return this.data.OperationMode
  }

  @isValue
  public get temperature(): number {
    return this.data.SetTemperature
  }

  @isValue
  public get vertical(): Vertical {
    return this.data.VaneVerticalDirection
  }
}
