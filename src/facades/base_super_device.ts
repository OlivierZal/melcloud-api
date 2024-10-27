import { syncDevices } from '../decorators/syncDevices.js'
import { updateDevices } from '../decorators/updateDevices.js'

import { BaseFacade } from './base.js'

import type {
  AreaModelAny,
  BuildingModel,
  FloorModel,
} from '../models/index.js'
import type {
  FailureData,
  GroupAtaState,
  SetGroupAtaPostData,
  SuccessData,
} from '../types/index.js'

import type { IBaseSuperDeviceFacade } from './interfaces.js'

export abstract class BaseSuperDeviceFacade<
    T extends AreaModelAny | BuildingModel | FloorModel,
  >
  extends BaseFacade<T>
  implements IBaseSuperDeviceFacade
{
  protected abstract readonly specification: keyof SetGroupAtaPostData['Specification']

  @updateDevices({ type: 'Ata' })
  public async getAta(): Promise<GroupAtaState> {
    try {
      return (
        await this.api.getAta({ postData: { [this.specification]: this.id } })
      ).data.Data.Group.State
    } catch (_error) {
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
    } catch (_error) {
      throw new Error('No air-to-air device found')
    }
  }
}
