import { flagsAtw, setDataMappingAtw, setKeyMappingAtw } from '../types'
import BaseDeviceFacade from './device'

export default class extends BaseDeviceFacade<'Atw'> {
  protected readonly flags = flagsAtw

  protected readonly setDataMapping = setDataMappingAtw

  protected readonly setKeyMapping = setKeyMappingAtw
}
