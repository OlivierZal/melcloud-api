import type API from '../services'
import type { ZoneSettings } from '../types'
import type { IBuildingFacade } from './interfaces'

import { BuildingModel } from '../models'
import { fetchDevices } from './base'
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

  public get data(): ZoneSettings {
    return this.model.data
  }

  @fetchDevices
  public async fetch(): Promise<ZoneSettings> {
    return Promise.resolve(this.data)
  }
}
