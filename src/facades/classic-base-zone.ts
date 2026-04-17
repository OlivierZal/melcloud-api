import type {
  ClassicArea,
  ClassicBuilding,
  ClassicFloor,
} from '../entities/index.ts'
import type {
  ClassicFailureData,
  ClassicGroupState,
  ClassicSetGroupPostData,
  ClassicSuccessData,
} from '../types/index.ts'
import { ClassicDeviceType } from '../constants.ts'
import { classicUpdateDevices, syncDevices } from '../decorators/index.ts'
import type { ClassicZoneFacade } from './classic-interfaces.ts'
import { BaseFacade } from './classic-base.ts'

/** Abstract base for zone facades (building, floor, area) that support ATA group operations. */
export abstract class BaseZoneFacade<
  T extends ClassicArea | ClassicBuilding | ClassicFloor,
>
  extends BaseFacade<T>
  implements ClassicZoneFacade
{
  protected abstract readonly groupSpecificationKey: keyof ClassicSetGroupPostData['Specification']

  @classicUpdateDevices({ type: ClassicDeviceType.Ata })
  public async getGroup(): Promise<ClassicGroupState> {
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
  @classicUpdateDevices({ type: ClassicDeviceType.Ata })
  public async updateGroupState(
    state: ClassicGroupState,
  ): Promise<ClassicFailureData | ClassicSuccessData> {
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
