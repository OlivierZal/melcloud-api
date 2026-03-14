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

import type { SuperDeviceFacade } from './interfaces.ts'

import { BaseFacade } from './base.ts'

/** Abstract base for zone facades (building, floor, area) that support ATA group operations. */
export abstract class BaseSuperDeviceFacade<
  T extends AreaModel | BuildingModel | FloorModel,
>
  extends BaseFacade<T>
  implements SuperDeviceFacade
{
  protected abstract readonly specification: keyof SetGroupPostData['Specification']

  @updateDevices({ type: DeviceType.Ata })
  public async group(): Promise<GroupState> {
    try {
      const {
        data: {
          Data: {
            Group: { State: state },
          },
        },
      } = await this.api.group({ postData: { [this.specification]: this.id } })
      return state
    } catch {
      throw new Error('No air-to-air device found')
    }
  }

  @syncDevices({ type: DeviceType.Ata })
  @updateDevices({ type: DeviceType.Ata })
  public async setGroup(state: GroupState): Promise<FailureData | SuccessData> {
    try {
      const { data } = await this.api.setGroup({
        postData: {
          Specification: { [this.specification]: this.id },
          State: state,
        },
      })
      return data
    } catch {
      throw new Error('No air-to-air device found')
    }
  }
}
