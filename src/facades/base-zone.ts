import type { Area, Building, Floor } from '../models/index.ts'
import type {
  FailureData,
  GroupState,
  SetGroupPostData,
  SuccessData,
} from '../types/index.ts'
import { ClassicDeviceType } from '../constants.ts'
import { syncDevices, updateDevices } from '../decorators/index.ts'
import type { ZoneFacade } from './interfaces.ts'
import { BaseFacade } from './base.ts'

/** Abstract base for zone facades (building, floor, area) that support ATA group operations. */
export abstract class BaseZoneFacade<T extends Area | Building | Floor>
  extends BaseFacade<T>
  implements ZoneFacade
{
  protected abstract readonly groupSpecificationKey: keyof SetGroupPostData['Specification']

  @updateDevices({ type: ClassicDeviceType.Ata })
  public async getGroup(): Promise<GroupState> {
    try {
      const {
        data: {
          Data: {
            Group: { State: state },
          },
        },
      } = await this.api.getGroup({
        postData: { [this.groupSpecificationKey]: this.id },
      })
      return state
    } catch (error) {
      throw new Error('No air-to-air device found', { cause: error })
    }
  }

  @syncDevices({ type: ClassicDeviceType.Ata })
  @updateDevices({ type: ClassicDeviceType.Ata })
  public async updateGroupState(
    state: GroupState,
  ): Promise<FailureData | SuccessData> {
    try {
      const { data } = await this.api.updateGroupState({
        postData: {
          Specification: { [this.groupSpecificationKey]: this.id },
          State: state,
        },
      })
      return data
    } catch (error) {
      throw new Error('No air-to-air device found', { cause: error })
    }
  }
}
