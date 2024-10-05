import { AreaModel, type AreaModelAny } from '../models'

import { BaseSuperDeviceFacade } from './base_super_device'

import type { IBaseSuperDeviceFacade } from './interfaces'

export class AreaFacade
  extends BaseSuperDeviceFacade<AreaModelAny>
  implements IBaseSuperDeviceFacade
{
  protected readonly frostProtectionLocation = 'AreaIds'

  protected readonly holidayModeLocation = 'Areas'

  protected readonly model = AreaModel

  protected readonly setAtaGroupSpecification = 'AreaID'

  protected readonly tableName = 'Area'
}
