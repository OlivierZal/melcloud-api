import type { ClassicDeviceAny, ClassicFloor } from '../entities/index.ts'
import { BaseZoneFacade } from './classic-base-zone.ts'

/**
 * Facade for a floor, grouping devices on that floor within a building.
 * @category Facades
 */
export class ClassicFloorFacade extends BaseZoneFacade<ClassicFloor> {
  /**
   * All devices currently registered under this floor, directly or in
   * one of its areas.
   * @returns The flat list of devices.
   */
  public override get devices(): ClassicDeviceAny[] {
    return this.registry.getDevicesByFloorId(this.id)
  }

  protected readonly frostProtectionLocation = 'FloorIds'

  protected readonly groupSpecificationKey = 'FloorID'

  protected readonly holidayModeLocation = 'Floors'

  protected readonly tableName = 'Floor'

  protected get model(): { getById: (id: number) => ClassicFloor | undefined } {
    return this.registry.floors
  }
}
