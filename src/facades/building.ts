import type { ModelRegistry } from '../models/index.ts'
import type {
  BuildingModel as BuildingModelContract,
  DeviceModelAny,
} from '../models/interfaces.ts'
import type { APIAdapter } from '../services/index.ts'
import type { ZoneSettings } from '../types/index.ts'

import { fetchDevices } from '../decorators/index.ts'

import { BaseSuperDeviceFacade } from './base-super-device.ts'

/** Facade for a building, providing access to all its devices and zone settings. */
export class BuildingFacade extends BaseSuperDeviceFacade<BuildingModelContract> {
  protected readonly frostProtectionLocation = 'BuildingIds'

  protected readonly holidayModeLocation = 'Buildings'

  protected readonly specification = 'BuildingID'

  protected readonly tableName = 'Building'

  public constructor(
    api: APIAdapter,
    registry: ModelRegistry,
    instance: BuildingModelContract,
  ) {
    super(api, registry, instance)
    ;({
      data: {
        FPDefined: this.isFrostProtectionDefined,
        HMDefined: this.isHolidayModeDefined,
      },
    } = this)
  }

  public override get devices(): DeviceModelAny[] {
    return this.registry.getDevicesByBuildingId(this.id)
  }

  public get data(): ZoneSettings {
    return this.instance.data
  }

  protected get model(): {
    getById: (id: number) => BuildingModelContract | undefined
  } {
    return this.registry.buildings
  }

  @fetchDevices
  public async fetch(): Promise<ZoneSettings> {
    const data = await Promise.resolve(this.data)
    return data
  }
}
