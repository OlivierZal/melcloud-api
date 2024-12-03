import type { DeviceType } from '../enums.ts'
import type { ListDeviceData, ZoneSettings } from '../types/common.ts'

interface ISubBuildingModel extends IModel {
  buildingId: number
  building?: IBuildingModel
}

interface ISubFloorModel extends ISubBuildingModel {
  floorId: number | null
  floor?: IFloorModel | null
}

interface ISuperAreaModel extends ISuperDeviceModel {
  areaIds: number[]
  areas: IAreaModel[]
}

interface ISuperDeviceModel extends IModel {
  deviceIds: number[]
  devices: IDeviceModelAny[]
}

export interface IAreaModel extends ISubFloorModel, ISuperDeviceModel {}

export interface IBaseBuildingModel {
  data: ZoneSettings
}

export interface IBaseDeviceModel<T extends DeviceType> {
  data: ListDeviceData<T>
  type: T
}

export interface IBuildingModel extends IBaseBuildingModel, ISuperAreaModel {
  floorIds: number[]
  floors: IFloorModel[]
  location: number
}

export interface IDeviceModel<T extends DeviceType>
  extends IBaseDeviceModel<T>,
    ISubFloorModel {
  areaId: number | null
  area?: IAreaModel | null
  update: (data: Partial<ListDeviceData<T>>) => void
}

export interface IFloorModel extends ISubBuildingModel, ISuperAreaModel {}

export interface IModel {
  id: number
  name: string
}

export type IDeviceModelAny =
  | IDeviceModel<DeviceType.Ata>
  | IDeviceModel<DeviceType.Atw>
  | IDeviceModel<DeviceType.Erv>
