import { flagsAta, setDataMappingAta, setKeyMappingAta } from '../types'
import BaseDeviceFacade from './device'

export default class extends BaseDeviceFacade<'Ata'> {
  protected readonly flags = flagsAta

  protected readonly setDataMapping = setDataMappingAta

  protected readonly setKeyMapping = setKeyMappingAta
}
