import type { AreaModelAny, BuildingModel, FloorModel } from '../models'
import { BaseFacade, type IBaseSuperDeviceFacade } from '.'
import type {
  FailureData,
  SetAtaGroupPostData,
  SuccessData,
  TilesData,
} from '../types'

export default abstract class<
    T extends AreaModelAny | BuildingModel | FloorModel,
  >
  extends BaseFacade<T>
  implements IBaseSuperDeviceFacade
{
  protected abstract readonly setAtaGroupSpecification: keyof SetAtaGroupPostData['Specification']

  public async getTiles(): Promise<TilesData<null>> {
    return (
      await this.api.getTiles({ postData: { DeviceIDs: this.model.deviceIds } })
    ).data
  }

  public async setAtaGroup(
    postData: Omit<SetAtaGroupPostData, 'Specification'>,
  ): Promise<FailureData | SuccessData> {
    return (
      await this.api.setAtaGroup({
        postData: {
          ...postData,
          Specification: { [this.setAtaGroupSpecification]: this.model.id },
        },
      })
    ).data
  }
}
