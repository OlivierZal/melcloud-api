import BaseDeviceFacade, { isValue } from './device'

export default class extends BaseDeviceFacade<'Erv'> {
  @isValue
  public get fan(): number {
    return this.data.SetFanSpeed
  }

  @isValue
  public get mode(): number {
    return this.data.VentilationMode
  }
}
