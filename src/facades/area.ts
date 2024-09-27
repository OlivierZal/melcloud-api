import { AreaModel, type AreaModelAny } from '../models'

import BaseSuperDeviceFacade from './base_super_device'

import type { IBaseSuperDeviceFacade } from './interfaces'

export default class
  extends BaseSuperDeviceFacade<AreaModelAny>
  implements IBaseSuperDeviceFacade
{
  protected readonly frostProtectionLocation = 'AreaIds'

  protected readonly holidayModeLocation = 'Areas'

  protected readonly modelClass = AreaModel

  protected readonly setAtaGroupSpecification = 'AreaID'

  protected readonly tableName = 'Area'
}
