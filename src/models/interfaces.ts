import type { DeviceType } from '../enums.js'
import type { ListDevice, ZoneSettings } from '../types/index.js'

export interface IModel {
  id: number
  name: string
}

export interface ISubBuildingModel extends IModel {
  buildingId: number
  building?: IBuildingModel
}

export interface ISubFloorModel extends ISubBuildingModel {
  floorId: number | null
  floor?: IFloorModel | null
}

export interface ISuperDeviceModel extends IModel {
  deviceIds: number[]
  devices: IDeviceModelAny[]
}

export interface ISuperAreaModel extends ISuperDeviceModel {
  areaIds: number[]
  areas: IAreaModel[]
}

export interface IBaseBuildingModel {
  data: ZoneSettings
}

export interface IBuildingModel extends IBaseBuildingModel, ISuperAreaModel {
  floorIds: number[]
  floors: IFloorModel[]
}

export interface IAreaModel extends ISubFloorModel, ISuperDeviceModel {}

export interface IFloorModel extends ISubBuildingModel, ISuperAreaModel {}

export interface IBaseDeviceModel<T extends keyof typeof DeviceType> {
  data: ListDevice[T]['Device']
  type: T
}

export interface IDeviceModel<T extends keyof typeof DeviceType>
  extends IBaseDeviceModel<T>,
    ISubFloorModel {
  areaId: number | null
  update: (data: Partial<ListDevice[T]['Device']>) => void
  area?: IAreaModel | null
}

export type IDeviceModelAny =
  | IDeviceModel<'Ata'>
  | IDeviceModel<'Atw'>
  | IDeviceModel<'Erv'>
