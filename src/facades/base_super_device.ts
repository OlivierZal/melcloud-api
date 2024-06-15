import type { AreaModelAny, BuildingModel, FloorModel } from '../models'
import type {
  FailureData,
  ListDevice,
  SetAtaGroupPostData,
  SuccessData,
  TilesData,
} from '../types'
import BaseFacade from './base'
import type { IBaseSuperDeviceFacade } from './interfaces'

export default abstract class<
    T extends AreaModelAny | BuildingModel | FloorModel,
  >
  extends BaseFacade<T>
  implements IBaseSuperDeviceFacade
{
  protected abstract readonly setAtaGroupSpecification: keyof SetAtaGroupPostData['Specification']

  public async get(): Promise<
    ListDevice['Ata']['Device'] &
      ListDevice['Atw']['Device'] &
      ListDevice['Erv']['Device']
  > {}

  public async getTiles(): Promise<TilesData<null>> {
    return (
      await this.api.getTiles({ postData: { DeviceIDs: this.model.deviceIds } })
    ).data
  }

  public async setAta(
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
