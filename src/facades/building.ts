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

  protected override readonly isFrostProtectionDefined =
    this.model.data.FPDefined

  protected override readonly isHolidayModeDefined = this.model.data.HMDefined

  protected readonly modelClass = BuildingModel

  protected readonly setAtaGroupSpecification = 'BuildingID'

  protected readonly tableName = 'Building'

  public get data(): BuildingSettings {
    return this.model.data
  }

  public async fetch(): Promise<BuildingSettings> {
    await this.api.sync()
    return this.model.data
  }
}
