import type { ModelRegistry } from '../models/index.ts'
import type {
  BuildingModel as BuildingModelContract,
  DeviceModelAny,
} from '../models/interfaces.ts'
import type { APIAdapter } from '../services/index.ts'
import type { ZoneSettings } from '../types/index.ts'

import { fetchDevices } from '../decorators/index.ts'

import { BaseZoneFacade } from './base-zone.ts'

/** Facade for a building, providing access to all its devices and zone settings. */
export class BuildingFacade extends BaseZoneFacade<BuildingModelContract> {
  public constructor(
    api: APIAdapter,
    registry: ModelRegistry,
    instance: BuildingModelContract,
  ) {
    super(api, registry, instance, {
      frostProtectionLocation: 'BuildingIds',
      groupSpecificationKey: 'BuildingID',
      holidayModeLocation: 'Buildings',
      tableName: 'Building',
    })
    ;({
      data: {
        FPDefined: this.isFrostProtectionAtZoneLevel,
        HMDefined: this.isHolidayModeAtZoneLevel,
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
