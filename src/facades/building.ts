import { fetchDevices } from '../decorators/fetchDevices.js'
import { BuildingModel } from '../models/index.js'

import { BaseSuperDeviceFacade } from './base_super_device.js'

import type { ZoneSettings } from '../types/index.js'

import type { IBuildingFacade } from './interfaces.js'
import type { FacadeManager } from './manager.js'

export class BuildingFacade
  extends BaseSuperDeviceFacade<BuildingModel>
  implements IBuildingFacade
{
  protected readonly frostProtectionLocation = 'BuildingIds'

  protected readonly holidayModeLocation = 'Buildings'

  protected readonly model = BuildingModel

  protected readonly specification = 'BuildingID'

  protected readonly tableName = 'Building'

  public constructor(manager: FacadeManager, instance: BuildingModel) {
    super(manager, instance)
    ;({
      data: {
        FPDefined: this.isFrostProtectionDefined,
        HMDefined: this.isHolidayModeDefined,
      },
    } = this)
  }

  public get data(): ZoneSettings {
    return this.instance.data
  }

  @fetchDevices
  public async fetch(): Promise<ZoneSettings> {
    return Promise.resolve(this.data)
  }
}
