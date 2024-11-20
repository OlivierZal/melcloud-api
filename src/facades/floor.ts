import { FloorModel } from '../models/index.js'

import { BaseSuperDeviceFacade } from './base-super-device.js'

import type { IFloorModel } from '../main.js'

import type { ISuperDeviceFacade } from './interfaces.js'

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
