import type {
  IBuildingModel,
  IDeviceModelAny,
  ModelRegistry,
} from '../models/index.ts'
import type { IAPI } from '../services/index.ts'
import type { ZoneSettings } from '../types/index.ts'

import { fetchDevices } from '../decorators/index.ts'

import type { IBuildingFacade } from './interfaces.ts'

import { BaseSuperDeviceFacade } from './base-super-device.ts'

export class BuildingFacade
  extends BaseSuperDeviceFacade<IBuildingModel>
  implements IBuildingFacade
{
  protected readonly frostProtectionLocation = 'BuildingIds'

  protected readonly holidayModeLocation = 'Buildings'

  protected readonly specification = 'BuildingID'

  protected readonly tableName = 'Building'

  public constructor(
    api: IAPI,
    registry: ModelRegistry,
    instance: IBuildingModel,
  ) {
    super(api, registry, instance)
    ;({
      data: {
        FPDefined: this.isFrostProtectionDefined,
        HMDefined: this.isHolidayModeDefined,
      },
    } = this)
  }

  public override get devices(): IDeviceModelAny[] {
    return this.registry.getDevicesByBuildingId(this.id)
  }

  public get data(): ZoneSettings {
    return this.instance.data
  }

  protected get model(): {
    getById: (id: number) => IBuildingModel | undefined
  } {
    return this.registry.buildings
  }

  @fetchDevices
  // eslint-disable-next-line @typescript-eslint/require-await -- async required by @fetchDevices decorator
  public async fetch(): Promise<ZoneSettings> {
    return this.data
  }
}
