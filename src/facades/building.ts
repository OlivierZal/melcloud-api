import { fetchDevices } from '../decorators/fetch-devices.ts'
import { BuildingModel } from '../models/index.ts'

import { BaseSuperDeviceFacade } from './base-super-device.ts'

import type { IBuildingModel } from '../models/interfaces.ts'
import type { IAPI } from '../services/interfaces.ts'
import type { ZoneSettings } from '../types/common.ts'

import type { IBuildingFacade } from './interfaces.ts'

export class BuildingFacade
  extends BaseSuperDeviceFacade<BuildingModel>
  implements IBuildingFacade
{
  protected readonly frostProtectionLocation = 'BuildingIds'

  protected readonly holidayModeLocation = 'Buildings'

  protected readonly model = BuildingModel

  protected readonly specification = 'BuildingID'

  protected readonly tableName = 'Building'

  public constructor(api: IAPI, instance: IBuildingModel) {
    super(api, instance)
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
