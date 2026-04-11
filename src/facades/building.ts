import type { APIAdapter } from '../api/index.ts'
import type {
  Building,
  ClassicRegistry,
  DeviceAny,
  Model,
} from '../models/index.ts'
import type { ZoneSettings } from '../types/index.ts'
import { fetchDevices } from '../decorators/index.ts'
import { BaseZoneFacade } from './base-zone.ts'

/** Facade for a building, providing access to all its devices and zone settings. */
export class BuildingFacade extends BaseZoneFacade<Building> {
  public get data(): ZoneSettings {
    return this.instance.data
  }

  public override get devices(): DeviceAny[] {
    return this.registry.getDevicesByBuildingId(this.id)
  }

  protected readonly frostProtectionLocation = 'BuildingIds'

  protected readonly groupSpecificationKey = 'BuildingID'

  protected readonly holidayModeLocation = 'Buildings'

  protected readonly tableName = 'Building'

  protected get model(): {
    getById: (id: number) => Building | undefined
  } {
    return this.registry.buildings
  }

  public constructor(
    api: APIAdapter,
    registry: ClassicRegistry,
    instance: Model,
  ) {
    super(api, registry, instance)
    ;({
      data: {
        FPDefined: this.isFrostProtectionAtZoneLevel,
        HMDefined: this.isHolidayModeAtZoneLevel,
      },
    } = this)
  }

  @fetchDevices
  public async fetch(): Promise<ZoneSettings> {
    const data = await Promise.resolve(this.data)
    return data
  }
}
