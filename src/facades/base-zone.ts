import type { ModelRegistry } from '../models/index.ts'
import type {
  AreaModel,
  BuildingModel,
  FloorModel,
  Model,
} from '../models/interfaces.ts'
import type { APIAdapter } from '../services/index.ts'
import type {
  FailureData,
  FrostProtectionLocation,
  GroupState,
  HolidayModeLocation,
  SetGroupPostData,
  SettingsParams,
  SuccessData,
} from '../types/index.ts'

import { DeviceType } from '../constants.ts'
import { syncDevices, updateDevices } from '../decorators/index.ts'

import type { ZoneFacade } from './interfaces.ts'

import { BaseFacade } from './base.ts'

/** Configuration for zone-specific facade behavior. */
export interface ZoneConfig {
  readonly frostProtectionLocation: keyof FrostProtectionLocation
  readonly groupSpecificationKey: keyof SetGroupPostData['Specification']
  readonly holidayModeLocation: keyof HolidayModeLocation
  readonly tableName: SettingsParams['tableName']
}

/** Abstract base for zone facades (building, floor, area) that support ATA group operations. */
export abstract class BaseZoneFacade<
  T extends AreaModel | BuildingModel | FloorModel,
>
  extends BaseFacade<T>
  implements ZoneFacade
{
  protected override readonly frostProtectionLocation: keyof FrostProtectionLocation

  protected override readonly holidayModeLocation: keyof HolidayModeLocation

  protected override readonly tableName: SettingsParams['tableName']

  readonly #groupSpecificationKey: keyof SetGroupPostData['Specification']

  // eslint-disable-next-line @typescript-eslint/max-params -- extends BaseFacade(api, registry, instance) + zone config
  public constructor(
    api: APIAdapter,
    registry: ModelRegistry,
    instance: Model,
    {
      frostProtectionLocation,
      groupSpecificationKey,
      holidayModeLocation,
      tableName,
    }: ZoneConfig,
  ) {
    super(api, registry, instance)
    this.frostProtectionLocation = frostProtectionLocation
    this.#groupSpecificationKey = groupSpecificationKey
    this.holidayModeLocation = holidayModeLocation
    this.tableName = tableName
  }

  @updateDevices({ type: DeviceType.Ata })
  public async getGroup(): Promise<GroupState> {
    try {
      const {
        data: {
          Data: {
            Group: { State: state },
          },
        },
      } = await this.api.getGroup({
        postData: { [this.#groupSpecificationKey]: this.id },
      })
      return state
    } catch (error) {
      throw new Error('No air-to-air device found', { cause: error })
    }
  }

  @syncDevices({ type: DeviceType.Ata })
  @updateDevices({ type: DeviceType.Ata })
  public async setGroup(state: GroupState): Promise<FailureData | SuccessData> {
    try {
      const { data } = await this.api.setGroup({
        postData: {
          Specification: { [this.#groupSpecificationKey]: this.id },
          State: state,
        },
      })
      return data
    } catch (error) {
      throw new Error('No air-to-air device found', { cause: error })
    }
  }
}
