import type {
  DeviceModelAny,
  FloorModel as FloorModelContract,
} from '../models/interfaces.ts'

import { BaseSuperDeviceFacade } from './base-super-device.ts'

/** Facade for a floor, grouping devices on that floor within a building. */
export class FloorFacade
  extends BaseSuperDeviceFacade<FloorModelContract>
{
  protected readonly frostProtectionLocation = 'FloorIds'

  protected readonly holidayModeLocation = 'Floors'

  protected readonly specification = 'FloorID'

  protected readonly tableName = 'Floor'

  public override get devices(): DeviceModelAny[] {
    return this.registry.getDevicesByFloorId(this.id)
  }

  protected get model(): { getById: (id: number) => FloorModelContract | undefined } {
    return this.registry.floors
  }
}
