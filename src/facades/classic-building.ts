import type { ClassicAPIAdapter } from '../api/index.ts'
import type {
  ClassicBuilding,
  ClassicDeviceAny,
  ClassicModel,
  ClassicRegistry,
} from '../entities/index.ts'
import type { ClassicBuildingID, ClassicZoneSettings } from '../types/index.ts'
import { fetchDevices } from '../decorators/index.ts'
import { BaseZoneFacade } from './classic-base-zone.ts'

/** Facade for a building, providing access to all its devices and zone settings. */
export class ClassicBuildingFacade extends BaseZoneFacade<ClassicBuilding> {
  declare public readonly id: ClassicBuildingID

  public get data(): ClassicZoneSettings {
    return this.instance.data
  }

  public override get devices(): ClassicDeviceAny[] {
    return this.registry.getDevicesByBuildingId(this.id)
  }

  protected readonly frostProtectionLocation = 'BuildingIds'

  protected readonly groupSpecificationKey = 'BuildingID'

  protected readonly holidayModeLocation = 'Buildings'

  protected readonly tableName = 'ClassicBuilding'

  protected get model(): {
    getById: (id: number) => ClassicBuilding | undefined
  } {
    return this.registry.buildings
  }

  public constructor(
    api: ClassicAPIAdapter,
    registry: ClassicRegistry,
    instance: ClassicModel,
  ) {
    super(api, registry, instance)
    ;({
      data: {
        FPDefined: this.isFrostProtectionAtZoneLevel,
        HMDefined: this.isHolidayModeAtZoneLevel,
      },
    } = this)
  }

  @fetchDevices()
  public async fetch(): Promise<ClassicZoneSettings> {
    const data = await Promise.resolve(this.data)
    return data
  }
}
