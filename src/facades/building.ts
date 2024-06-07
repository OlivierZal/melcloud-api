import { BaseSuperDeviceFacade, type IBuildingFacade } from '.'
import { BuildingModel } from '../models'
import type { BuildingSettings } from '../types'

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
