import type { AreaModelAny, BuildingModel, FloorModel } from '../models'
import type {
  FailureData,
  ListDeviceDataAta,
  SetAtaGroupPostData,
  SuccessData,
  ValuesAta,
} from '../types'
import type { IBaseSuperDeviceFacade } from './interfaces'

import BaseFacade from './base'

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
      ] as const
    ).map((key) => {
      const values = new Set(dataList.map((data) => data[key]))
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
        .filter((device) => device.type === 'Ata')
        .map(({ data }) => data),
    )
  }

  public async setAta({
    fan,
    horizontal,
    mode,
    power,
    temperature,
    vertical,
  }: ValuesAta): Promise<FailureData | SuccessData> {
    const state = {
      FanSpeed: fan,
      OperationMode: mode,
      Power: power,
      SetTemperature: temperature,
      VaneHorizontalDirection: horizontal,
      VaneVerticalDirection: vertical,
    }
    const { data } = await this.api.setAta({
      postData: {
        Specification: { [this.setAtaGroupSpecification]: this.id },
        State: state,
      },
    })
    this.model.devices
      .filter((device) => device.type === 'Ata')
      .forEach((device) => {
        device.update(state)
      })
    return data
  }
}
