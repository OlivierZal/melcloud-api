import { AreaModel } from '../models/index.js'

import { BaseSuperDeviceFacade } from './base_super_device.js'

import type { AreaModelAny } from '../models/interfaces.js'

import type { IBaseSuperDeviceFacade } from './interfaces.js'

export class AreaFacade
  extends BaseSuperDeviceFacade<AreaModelAny>
  implements IBaseSuperDeviceFacade
{
  protected readonly frostProtectionLocation = 'AreaIds'

  protected readonly holidayModeLocation = 'Areas'

  protected readonly model = AreaModel

  protected readonly specification = 'AreaID'

  protected readonly tableName = 'Area'
}
