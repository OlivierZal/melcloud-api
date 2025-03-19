import { FloorModel, type IFloorModel } from '../models/index.ts'

import { BaseSuperDeviceFacade } from './base-super-device.ts'

import type { ISuperDeviceFacade } from './interfaces.ts'

export class FloorFacade
  extends BaseSuperDeviceFacade<IFloorModel>
  implements ISuperDeviceFacade
{
  protected readonly frostProtectionLocation = 'FloorIds'

  protected readonly holidayModeLocation = 'Floors'

  protected readonly model = FloorModel

  protected readonly specification = 'FloorID'

  protected readonly tableName = 'Floor'
}
