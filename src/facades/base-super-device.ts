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
  GroupAtaState,
  SetGroupAtaPostData,
  SuccessData,
} from '../types/index.js'

import type { ISuperDeviceFacade } from './interfaces.js'

export abstract class BaseSuperDeviceFacade<
    T extends IAreaModel | IBuildingModel | IFloorModel,
  >
  extends BaseFacade<T>
  implements ISuperDeviceFacade
{
  protected abstract readonly specification: keyof SetGroupAtaPostData['Specification']

  public get devices(): IDeviceModelAny[] {
    return this.instance.devices
  }

  @updateDevices({ type: DeviceType.Ata })
  public async getAta(): Promise<GroupAtaState> {
    try {
      return (
        await this.api.getAta({ postData: { [this.specification]: this.id } })
      ).data.Data.Group.State
    } catch {
      throw new Error('No air-to-air device found')
    }
  }

  @syncDevices({ type: DeviceType.Ata })
  @updateDevices({ type: DeviceType.Ata })
  public async setAta(
    state: GroupAtaState,
  ): Promise<FailureData | SuccessData> {
    try {
      return (
        await this.api.setAta({
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