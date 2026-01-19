import type { IAPI } from '../services/index.ts'
import type { ZoneSettings } from '../types/index.ts'

import { fetchDevices } from '../decorators/index.ts'
import { type IBuildingModel, BuildingModel } from '../models/index.ts'

import type { IBuildingFacade } from './interfaces.ts'

import { BaseSuperDeviceFacade } from './base-super-device.ts'

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
    // eslint-disable-next-line unicorn/no-useless-promise-resolve-reject
    return Promise.resolve(this.data)
  }
}
