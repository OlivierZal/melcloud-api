import type {
  ClassicArea,
  ClassicBuilding,
  ClassicFloor,
} from '../entities/index.ts'
import { ClassicDeviceType } from '../constants.ts'
import { classicUpdateDevices, syncDevices } from '../decorators/index.ts'
import {
  type ClassicFailureData,
  type ClassicGroupState,
  type ClassicSetGroupPostData,
  type ClassicSuccessData,
  type Result,
  mapResult,
} from '../types/index.ts'
import type { ClassicZoneFacade } from './classic-types.ts'
import { ClassicBaseFacade } from './classic-base.ts'

/** Abstract base for zone facades (building, floor, area) that support ATA group operations. */
export abstract class BaseZoneFacade<
  T extends ClassicArea | ClassicBuilding | ClassicFloor,
>
  extends ClassicBaseFacade<T>
  implements ClassicZoneFacade
{
  protected abstract readonly groupSpecificationKey: keyof ClassicSetGroupPostData['Specification']

  @syncDevices({ type: ClassicDeviceType.Ata })
  @classicUpdateDevices({ type: ClassicDeviceType.Ata })
  public async updateGroupState(
    state: ClassicGroupState,
  ): Promise<ClassicFailureData | ClassicSuccessData> {
    try {
      return await this.api.updateGroupState({
        postData: {
          Specification: { [this.groupSpecificationKey]: this.id },
          State: state,
        },
      })
    } catch (error) {
      throw new Error('No air-to-air device found', { cause: error })
    }
  }

  public async getGroup(): Promise<Result<ClassicGroupState>> {
    const result = mapResult(
      await this.api.getGroup({
        postData: { [this.groupSpecificationKey]: this.id },
      }),
      ({ Data: { Group: group } }) => group.State,
    )
    if (result.ok) {
      // Inline registry update — `@classicUpdateDevices` only supports raw
      // payloads; getGroup now returns Result, so the patch propagation
      // happens here on the success branch instead of via the decorator.
      // Filter out null/undefined fields so caller-supplied "ignore"
      // sentinels do not accidentally overwrite existing device state.
      const patch = Object.fromEntries(
        Object.entries(result.value).filter(([, value]) => value !== null),
      )
      const ataDevices = this.devices.filter(
        ({ type }) => type === ClassicDeviceType.Ata,
      )
      for (const device of ataDevices) {
        device.update(patch)
      }
    }
    return result
  }
}
