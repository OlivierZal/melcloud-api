import { syncDevices, updateDevices } from '../decorators'

import BaseFacade from './base'

import type { AreaModelAny, BuildingModel, FloorModel } from '../models'
import type {
  FailureData,
  GroupAtaState,
  SetGroupAtaPostData,
  SuccessData,
} from '../types'

import type { IBaseSuperDeviceFacade } from './interfaces'

export default abstract class<
    T extends AreaModelAny | BuildingModel | FloorModel,
  >
  extends BaseFacade<T>
  implements IBaseSuperDeviceFacade
{
  protected abstract readonly setAtaGroupSpecification: keyof SetGroupAtaPostData['Specification']

  @updateDevices({ type: 'Ata' })
  public async getAta(): Promise<GroupAtaState> {
    try {
      return (
        await this.api.getAta({
          postData: { [this.setAtaGroupSpecification]: this.id },
        })
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
    if (!Object.keys(state).length) {
      throw new Error('No data to set')
    }
    try {
      return (
        await this.api.setAta({
          postData: {
            Specification: { [this.setAtaGroupSpecification]: this.id },
            State: state,
          },
        })
      ).data
    } catch (_error) {
      throw new Error('No air-to-air device found')
    }
  }
}
