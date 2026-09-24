import type {
  ClassicArea,
  ClassicBuilding,
  ClassicFloor,
} from '../entities/index.ts'
import { type ClassicOperationMode, ClassicDeviceType } from '../constants.ts'
import { classicUpdateDevices, syncDevices } from '../decorators/index.ts'
import { assertUpdateAccepted } from '../errors/index.ts'
import {
  type ClassicGroupState,
  type ClassicSetGroupPostData,
  type Result,
  mapResult,
} from '../types/index.ts'
import type { ClassicZoneFacade } from './classic-types.ts'
import { ClassicBaseFacade } from './classic-base.ts'
import { classicGroupMemberModes } from './home-ata-group.ts'

/**
 * Abstract base for zone facades (building, floor, area) that support ATA group operations.
 * @template T - Zone model class (area, building, or floor) backing this
 * facade in the registry.
 */
export abstract class BaseZoneFacade<
  T extends ClassicArea | ClassicBuilding | ClassicFloor,
>
  extends ClassicBaseFacade<T>
  implements ClassicZoneFacade
{
  protected abstract readonly groupSpecificationKey: keyof ClassicSetGroupPostData['Specification']

  @syncDevices({ type: ClassicDeviceType.Ata })
  @classicUpdateDevices({ type: ClassicDeviceType.Ata })
  public async updateGroupState(state: ClassicGroupState): Promise<void> {
    assertUpdateAccepted(
      await this.api.updateGroupState({
        postData: {
          Specification: { [this.groupSpecificationKey]: this.id },
          State: state,
        },
      }),
    )
  }

  // A READ of the group must leave the members' snapshots alone. The
  // group state is what MELCloud holds for the GROUP, not what each
  // member reports, and a member's snapshot is the body of its next
  // write: a member in Cool patched with the group's Auto would carry
  // that Auto — unflagged, then echoed back into the registry by the
  // write's own decorator — on its next temperature write. Until 59.2.1
  // this method did exactly that, mirroring the write decorator's
  // propagation for a read.
  public async getGroup(): Promise<Result<ClassicGroupState>> {
    return mapResult(
      await this.api.getGroup({
        postData: { [this.groupSpecificationKey]: this.id },
      }),
      ({ Data: { Group: group } }) => group.State,
    )
  }

  /**
   * Member operation modes in the one group vocabulary
   * (Classic-numbered), projected from the members' synced list data —
   * no wire call. Non-ATA members are dropped, like on every other read
   * of the ATA group contract.
   * @param options - Member filter.
   * @param options.poweredOnly - `true` keeps only powered-on members.
   * @returns One mode per kept ATA member, in member order.
   */
  public getMemberOperationModes({
    poweredOnly: isPoweredOnly,
  }: {
    poweredOnly: boolean
  }): ClassicOperationMode[] {
    return classicGroupMemberModes(this.devices, isPoweredOnly)
  }
}
