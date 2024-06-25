import type API from '../services'
import type { BuildingData, BuildingSettings } from '../types'
import type { IBuildingFacade } from './interfaces'

import { BuildingModel } from '../models'
import BaseSuperDeviceFacade from './base_super_device'

export default class
  extends BaseSuperDeviceFacade<BuildingModel>
  implements IBuildingFacade
{
  protected readonly frostProtectionLocation = 'BuildingIds'

  protected readonly holidayModeLocation = 'Buildings'

  protected readonly modelClass = BuildingModel

  protected readonly setAtaGroupSpecification = 'BuildingID'

  protected readonly tableName = 'Building'

  public constructor(api: API, model: BuildingModel) {
    super(api, model)
    this.isFrostProtectionDefined = this.data.FPDefined
    this.isHolidayModeDefined = this.data.HMDefined
  }

  public get data(): BuildingSettings {
    return this.model.data
  }

  public async actualData(): Promise<BuildingData> {
    return {
      ID: this.id,
      Name: this.name,
      ...(await this.getFrostProtection()),
      ...(await this.getHolidayMode()),
    }
  }

  public async fetch(): Promise<BuildingSettings> {
    await this.api.fetch()
    return this.data
  }
}
