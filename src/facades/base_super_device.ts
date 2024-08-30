import type { AreaModelAny, BuildingModel, FloorModel } from '../models'
import type {
  FailureData,
  GroupAtaState,
  SetGroupAtaPostData,
  SuccessData,
} from '../types'
import type { IBaseSuperDeviceFacade } from './interfaces'

import BaseFacade from './base'

export default abstract class<
    T extends AreaModelAny | BuildingModel | FloorModel,
  >
  extends BaseFacade<T>
  implements IBaseSuperDeviceFacade
{
  protected abstract readonly setAtaGroupSpecification: keyof SetGroupAtaPostData['Specification']

  public async getAta(): Promise<GroupAtaState> {
    const state = Object.fromEntries(
      Object.entries(
        (
          await this.api.getAta({
            postData: { [this.setAtaGroupSpecification]: this.id },
          })
        ).data.Data.Group.State,
      ).filter(([, value]) => value),
    )
    this.model.devices
      .filter((device) => device.type === 'Ata')
      .forEach((device) => {
        device.update(state)
      })
    await this.api.onSync?.()
    return state
  }

  public async setAta(
    state: GroupAtaState,
  ): Promise<FailureData | SuccessData> {
    const { data } = await this.api.setAta({
      postData: {
        Specification: { [this.setAtaGroupSpecification]: this.id },
        State: state,
      },
    })
    this.model.devices
      .filter((device) => device.type === 'Ata')
      .forEach((device) => {
        device.update(
          Object.fromEntries(
            Object.entries(state).filter(([, value]) => value),
          ),
        )
      })
    await this.api.onSync?.()
    return data
  }
}
