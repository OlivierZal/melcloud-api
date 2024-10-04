import { fetchDevices } from '../decorators'
import { BuildingModel } from '../models'

import {BaseSuperDeviceFacade} from './base_super_device'

import type { ZoneSettings } from '../types'

import type { IBuildingFacade } from './interfaces'

import type { FacadeManager } from '.'

export class BuildingFacade
  extends BaseSuperDeviceFacade<BuildingModel>
  implements IBuildingFacade
{
  protected readonly frostProtectionLocation = 'BuildingIds'

  protected readonly holidayModeLocation = 'Buildings'

  protected readonly modelClass = BuildingModel

  protected readonly setAtaGroupSpecification = 'BuildingID'

  protected readonly tableName = 'Building'

  public constructor(facadeManager: FacadeManager, model: BuildingModel) {
    super(facadeManager, model)
    this.isFrostProtectionDefined = this.data.FPDefined
    this.isHolidayModeDefined = this.data.HMDefined
  }

  public get data(): ZoneSettings {
    return this.model.data
  }

  @fetchDevices
  public async fetch(): Promise<ZoneSettings> {
    return Promise.resolve(this.data)
  }
}
