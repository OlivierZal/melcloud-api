import { syncDevices } from '../decorators/sync-devices.js'
import { updateDevices } from '../decorators/update-devices.js'
import { DeviceType } from '../enums.js'

import { BaseFacade } from './base.js'

import type {
  IAreaModel,
  IBuildingModel,
  IDeviceModelAny,
  IFloorModel,
} from '../models/interfaces.js'
import type {
  FailureData,
  GroupState,
  SetGroupPostData,
  SuccessData,
} from '../types/index.js'

import type { ISuperDeviceFacade } from './interfaces.js'

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
