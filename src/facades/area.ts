import { AreaModel, type IAreaModel } from '../models/index.ts'

import { BaseSuperDeviceFacade } from './base-super-device.ts'

import type { ISuperDeviceFacade } from './interfaces.ts'

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
