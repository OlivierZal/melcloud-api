import { FloorModel } from '../models'

import { BaseSuperDeviceFacade } from './base_super_device'

import type { IBaseSuperDeviceFacade } from './interfaces'

export class FloorFacade
  extends BaseSuperDeviceFacade<FloorModel>
  implements IBaseSuperDeviceFacade
{
  protected readonly frostProtectionLocation = 'FloorIds'

  protected readonly holidayModeLocation = 'Floors'

  protected readonly modelClass = FloorModel

  protected readonly setAtaGroupSpecification = 'FloorID'

  protected readonly tableName = 'Floor'
}
