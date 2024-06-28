import type {
  AreaModelAny,
  BuildingModel,
  DeviceModel,
  FloorModel,
} from '../models'
import type {
  FailureData,
  FanSpeed,
  Horizontal,
  ListDeviceDataAta,
  OperationMode,
  SetAtaGroupPostData,
  SuccessData,
  Vertical,
} from '../types'
import BaseFacade from './base'
import type { IBaseSuperDeviceFacade } from './interfaces'

const NUMBER_1 = 1

const mergeListDeviceDataAta = (
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
    return mergeListDeviceDataAta(
      this.model.devices
        .filter((device): device is DeviceModel<'Ata'> => device.type === 'Ata')
        .map(({ data }) => data),
    )
  }

  public async setAta({
    fan,
    horizontal,
    operationMode,
    power,
    temperature,
    vertical,
  }: {
    fan?: Exclude<FanSpeed, FanSpeed.silent>
    horizontal?: Horizontal
    operationMode?: OperationMode
    power?: boolean
    temperature?: number
    vertical?: Vertical
  }): Promise<FailureData | SuccessData> {
    const postData = {
      FanSpeed: fan,
      OperationMode: operationMode,
      Power: power,
      SetTemperature: temperature,
      VaneHorizontalDirection: horizontal,
      VaneVerticalDirection: vertical,
    }
    const { data } = await this.api.setAta({
      postData: {
        Specification: { [this.setAtaGroupSpecification]: this.id },
        State: postData,
      },
    })
    this.model.devices
      .filter((device): device is DeviceModel<'Ata'> => device.type === 'Ata')
      .forEach((device) => {
        device.update(postData)
      })
    return data
  }
}
