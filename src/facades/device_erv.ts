import { flagsErv, setDataMappingErv, setKeyMappingErv } from '../types'
import BaseDeviceFacade from './device'

export default class extends BaseDeviceFacade<'Erv'> {
  protected readonly flags = flagsErv

  protected readonly setDataMapping = setDataMappingErv

  protected readonly setKeyMapping = setKeyMappingErv
}
