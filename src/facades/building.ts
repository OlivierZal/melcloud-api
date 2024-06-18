import type API from '../services'
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

  protected override readonly isFrostProtectionDefined

  protected override readonly isHolidayModeDefined

  protected readonly modelClass = BuildingModel

  protected readonly setAtaGroupSpecification = 'BuildingID'

  protected readonly tableName = 'Building'

  public constructor(api: API, id: number) {
    super(api, id)
    this.isFrostProtectionDefined = this.data.FPDefined
    this.isHolidayModeDefined = this.data.HMDefined
  }

  public get data(): BuildingSettings {
    return this.model.data
  }

  public async fetch(): Promise<BuildingSettings> {
    await this.api.sync()
    return this.model.data
  }

  public async getData(): Promise<BuildingSettings> {
    return {
      ...this.data,
      ...(await this.getFrostProtection()),
      ...(await this.getHolidayMode()),
    }
  }
}
