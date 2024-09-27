import BaseFacade from './base'

import type { AreaModelAny, BuildingModel, FloorModel } from '../models'
import type {
  FailureData,
  GroupAtaState,
  SetGroupAtaPostData,
  SuccessData,
} from '../types'

import type { IBaseSuperDeviceFacade } from './interfaces'

export const syncDevices = <
  T extends FailureData | GroupAtaState | SuccessData,
>(
  target: (...args: any[]) => Promise<T>,
  _context: unknown,
): ((...args: unknown[]) => Promise<T>) =>
  async function newTarget(
    this: BaseSuperDeviceFacade<AreaModelAny | BuildingModel | FloorModel>,
    ...args: unknown[]
  ) {
    const data = await target.call(this, ...args)
    await this.api.onSync?.()
    return data
  }

export default abstract class BaseSuperDeviceFacade<
    T extends AreaModelAny | BuildingModel | FloorModel,
  >
  extends BaseFacade<T>
  implements IBaseSuperDeviceFacade
{
  protected abstract readonly setAtaGroupSpecification: keyof SetGroupAtaPostData['Specification']

  @syncDevices
  public async getAta(): Promise<GroupAtaState> {
    const state = Object.fromEntries(
      Object.entries(
        (
          await this.api.getAta({
            postData: { [this.setAtaGroupSpecification]: this.id },
          })
        ).data.Data.Group.State,
      ).filter(([, value]) => value !== null),
    )
    this.model.devices
      .filter(({ type }) => type === 'Ata')
      .forEach((device) => {
        device.update(state)
      })
    return state
  }

  @syncDevices
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
      .filter(({ type }) => type === 'Ata')
      .forEach((device) => {
        device.update(
          Object.fromEntries(
            Object.entries(state).filter(([, value]) => value !== null),
          ),
        )
      })
    return data
  }
}
