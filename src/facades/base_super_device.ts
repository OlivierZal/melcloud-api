import type {
  AreaModelAny,
  BuildingModel,
  DeviceModel,
  FloorModel,
} from '../models'
import type {
  FailureData,
  ListDeviceDataAta,
  SetAtaGroupPostData,
  SuccessData,
  TilesData,
} from '../types'
import BaseFacade from './base'
import type { IBaseSuperDeviceFacade } from './interfaces'

const NUMBER_1 = 1

const mergeData = (dataList: ListDeviceDataAta[]): Partial<ListDeviceDataAta> =>
  Object.fromEntries(
    Array.from(
      new Set(dataList.flatMap(Object.keys) as (keyof ListDeviceDataAta)[]),
    ).map((key) => {
      const values = new Set(
        dataList.map((data: ListDeviceDataAta) => data[key]),
      )
      const [value] = values.size === NUMBER_1 ? values : [null]
      return [key, value]
    }),
  )

export default abstract class<
    T extends AreaModelAny | BuildingModel | FloorModel,
  >
  extends BaseFacade<T>
  implements IBaseSuperDeviceFacade
{
  protected abstract readonly setAtaGroupSpecification: keyof SetAtaGroupPostData['Specification']

  public getAta(): Partial<ListDeviceDataAta> {
    return mergeData(
      this.model.devices
        .filter((device): device is DeviceModel<'Ata'> => device.type === 'Ata')
        .map(({ data }) => data),
    )
  }

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
