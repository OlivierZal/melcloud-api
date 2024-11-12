import { syncDevices } from '../decorators/syncDevices.js'
import { updateDevices } from '../decorators/updateDevices.js'

import { BaseFacade } from './base.js'

import type { BuildingModel, FloorModel } from '../models/index.js'
import type { AreaModelAny, DeviceModelAny } from '../models/interfaces.js'
import type {
  FailureData,
  GroupAtaState,
  SetGroupAtaPostData,
  SuccessData,
} from '../types/index.js'

import type { ISuperDeviceFacade } from './interfaces.js'

export abstract class BaseSuperDeviceFacade<
    T extends AreaModelAny | BuildingModel | FloorModel,
  >
  extends BaseFacade<T>
  implements ISuperDeviceFacade
{
  protected abstract readonly specification: keyof SetGroupAtaPostData['Specification']

  public get devices(): DeviceModelAny[] {
    return this.instance.devices
  }

  @updateDevices({ type: 'Ata' })
  public async getAta(): Promise<GroupAtaState> {
    try {
      return (
        await this.api.getAta({ postData: { [this.specification]: this.id } })
      ).data.Data.Group.State
    } catch {
      throw new Error('No air-to-air device found')
    }
  }

  @syncDevices
  @updateDevices({ type: 'Ata' })
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
