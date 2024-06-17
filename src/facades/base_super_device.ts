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

const mergeData = (
  dataList: ListDeviceDataAta[],
): SetAtaGroupPostData['State'] =>
  Object.fromEntries(
    (
      [
        'FanSpeed',
        'OperationMode',
        'Power',
        'SetTemperature',
        'VaneHorizontalDirection',
        'VaneVerticalDirection',
      ] satisfies (keyof SetAtaGroupPostData['State'])[]
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

  public getAta(): SetAtaGroupPostData['State'] {
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
    postData: SetAtaGroupPostData['State'],
  ): Promise<FailureData | SuccessData> {
    return (
      await this.api.setAtaGroup({
        postData: {
          Specification: { [this.setAtaGroupSpecification]: this.model.id },
          State: postData,
        },
      })
    ).data
  }
}
