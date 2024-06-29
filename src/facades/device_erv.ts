import { flagsErv, setDataMappingErv, valueMappingErv } from '../types'
import BaseDeviceFacade from './device'

export default class extends BaseDeviceFacade<'Erv'> {
  protected readonly flags = flagsErv

  protected readonly setDataMapping = setDataMappingErv

  protected readonly valueMapping = valueMappingErv

  public get fan(): number {
    return this.data.SetFanSpeed
  }

  public get mode(): number {
    return this.data.VentilationMode
  }
}
