import { DeviceModel, type DeviceModelAny } from '../models'
import type {
  DeviceType,
  EnergyData,
  GetDeviceData,
  ListDevice,
  SetDeviceData,
  TilesData,
  UpdateDeviceData,
} from '../types'
import { YEAR_1970, nowISO } from './utils'
import BaseFacade from './base'
import type { IDeviceFacade } from './interfaces'

export default class<U extends keyof typeof DeviceType>
  extends BaseFacade<DeviceModelAny>
  implements IDeviceFacade<U>
{
  protected readonly frostProtectionLocation = 'DeviceIds'

  protected readonly holidayModeLocation = 'Devices'

  protected readonly modelClass = DeviceModel<U>

  protected readonly tableName = 'DeviceLocation'

  public get data(): ListDevice[U]['Device'] {
    return this.model.data
  }

  public async fetch(): Promise<ListDevice[U]['Device']> {
    await this.api.fetchDevices()
    return this.model.data
  }

  public async get(): Promise<GetDeviceData[U]> {
    return (
      await this.api.getDevice({
        params: { buildingId: this.model.buildingId, id: this.model.id },
      })
    ).data as GetDeviceData[U]
  }

  public async getEnergyReport({
    from,
    to,
  }: {
    from?: string | null
    to?: string | null
  }): Promise<EnergyData[U]> {
    return (
      await this.api.getEnergyReport({
        postData: {
          DeviceID: this.model.id,
          FromDate: from ?? YEAR_1970,
          ToDate: to ?? nowISO(),
        },
      })
    ).data as EnergyData[U]
  }

  public async getTile(select?: false): Promise<TilesData<null>>
  public async getTile(select: true): Promise<TilesData<U>>
  public async getTile(select = false): Promise<TilesData<U | null>> {
    return select ?
        ((
          await this.api.getTiles({
            postData: {
              DeviceIDs: [this.model.id],
              SelectedBuilding: this.model.buildingId,
              SelectedDevice: this.model.id,
            },
          })
        ).data as TilesData<U>)
      : (await this.api.getTiles({ postData: { DeviceIDs: [this.model.id] } }))
          .data
  }

  public async set(postData: UpdateDeviceData[U]): Promise<SetDeviceData[U]> {
    return (
      await this.api.setDevice({
        heatPumpType: this.model.type,
        postData: { ...postData, DeviceID: this.model.id },
      })
    ).data as SetDeviceData[U]
  }
}
