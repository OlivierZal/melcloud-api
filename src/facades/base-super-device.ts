import type {
  IAreaModel,
  IBuildingModel,
  IDeviceModelAny,
  IFloorModel,
} from '../models/index.ts'
import type {
  FailureData,
  GroupState,
  SetGroupPostData,
  SuccessData,
} from '../types/index.ts'

import { syncDevices, updateDevices } from '../decorators/index.ts'
import { DeviceType } from '../enums.ts'

import type { ISuperDeviceFacade } from './interfaces.ts'

import { BaseFacade } from './base.ts'

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
