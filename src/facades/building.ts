import { fetchDevices } from '../decorators/fetch-devices.js'
import { BuildingModel } from '../models/index.js'

import { BaseSuperDeviceFacade } from './base-super-device.js'

import type { IBuildingModel } from '../main.js'
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

  public constructor(manager: FacadeManager, instance: IBuildingModel) {
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
