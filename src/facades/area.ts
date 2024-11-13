import { AreaModel } from '../models/index.js'

import { BaseSuperDeviceFacade } from './base_super_device.js'

import type { IAreaModel } from '../models/interfaces.js'

import type { ISuperDeviceFacade } from './interfaces.js'

export class AreaFacade
  extends BaseSuperDeviceFacade<IAreaModel>
  implements ISuperDeviceFacade
{
  protected readonly frostProtectionLocation = 'AreaIds'

  protected readonly holidayModeLocation = 'Areas'

  protected readonly model = AreaModel

  protected readonly specification = 'AreaID'

  protected readonly tableName = 'Area'
}
