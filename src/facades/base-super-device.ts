import { syncDevices, updateDevices } from '../decorators/index.ts'
import { DeviceType } from '../enums.ts'

import { BaseFacade } from './base.ts'

import type {
  IAreaModel,
  IBuildingModel,
  IDeviceModelAny,
  IFloorModel,
} from '../models/interfaces.ts'
import type { GroupState, SetGroupPostData } from '../types/ata.ts'
import type { FailureData, SuccessData } from '../types/common.ts'

import type { ISuperDeviceFacade } from './interfaces.ts'

export abstract class BaseSuperDeviceFacade<
    T extends IAreaModel | IBuildingModel | IFloorModel,
  >
  extends BaseFacade<T>
  implements ISuperDeviceFacade
{
  protected abstract readonly specification: keyof SetGroupPostData['Specification']

  public get devices(): IDeviceModelAny[] {
    return this.instance.devices
  }

  @updateDevices({ type: DeviceType.Ata })
  public async group(): Promise<GroupState> {
    try {
      return (
        await this.api.group({ postData: { [this.specification]: this.id } })
      ).data.Data.Group.State
    } catch {
      throw new Error('No air-to-air device found')
    }
  }

  @syncDevices({ type: DeviceType.Ata })
  @updateDevices({ type: DeviceType.Ata })
  public async setGroup(state: GroupState): Promise<FailureData | SuccessData> {
    try {
      return (
        await this.api.setGroup({
          postData: {
            Specification: { [this.specification]: this.id },
            State: state,
          },
        })
      ).data
    } catch {
      throw new Error('No air-to-air device found')
    }
  }
}
