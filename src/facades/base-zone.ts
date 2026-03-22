import type {
  AreaModel,
  BuildingModel,
  FloorModel,
} from '../models/interfaces.ts'
import type {
  FailureData,
  GroupState,
  SetGroupPostData,
  SuccessData,
} from '../types/index.ts'

import { DeviceType } from '../constants.ts'
import { syncDevices, updateDevices } from '../decorators/index.ts'

import type { ZoneFacade } from './interfaces.ts'

import { BaseFacade } from './base.ts'

/** Abstract base for zone facades (building, floor, area) that support ATA group operations. */
export abstract class BaseZoneFacade<
  T extends AreaModel | BuildingModel | FloorModel,
>
  extends BaseFacade<T>
  implements ZoneFacade
{
  protected abstract readonly groupSpecificationKey: keyof SetGroupPostData['Specification']

  @updateDevices({ type: DeviceType.Ata })
  public async getGroup(): Promise<GroupState> {
    try {
      const {
        data: {
          Data: {
            Group: { State: state },
          },
        },
      } = await this.api.getGroup({
        postData: { [this.groupSpecificationKey]: this.id },
      })
      return state
    } catch (error) {
      throw new Error('No air-to-air device found', { cause: error })
    }
  }

  @syncDevices({ type: DeviceType.Ata })
  @updateDevices({ type: DeviceType.Ata })
  public async setGroup(state: GroupState): Promise<FailureData | SuccessData> {
    try {
      const { data } = await this.api.setGroup({
        postData: {
          Specification: { [this.groupSpecificationKey]: this.id },
          State: state,
        },
      })
      return data
    } catch (error) {
      throw new Error('No air-to-air device found', { cause: error })
    }
  }
}
