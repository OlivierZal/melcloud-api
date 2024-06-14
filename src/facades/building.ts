import BaseSuperDeviceFacade from './base_super_device'
import { BuildingModel } from '../models'
import type { BuildingSettings } from '../types'
import type { IBuildingFacade } from './interfaces'

export default class
  extends BaseSuperDeviceFacade<BuildingModel>
  implements IBuildingFacade
{
  protected readonly frostProtectionLocation = 'BuildingIds'

  protected readonly holidayModeLocation = 'Buildings'

  protected readonly modelClass = BuildingModel

  protected readonly setAtaGroupSpecification = 'BuildingID'

  protected readonly tableName = 'Building'

  public async fetch(): Promise<BuildingSettings> {
    await this.api.fetchDevices()
    return this.model.data
  }
}
