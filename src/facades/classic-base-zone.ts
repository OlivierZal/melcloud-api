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
import { toAtaSetpoint } from './ata-setpoint.ts'
import { ClassicBaseFacade } from './classic-base.ts'
import { classicGroupMemberModes } from './home-ata-group.ts'

// The group endpoint hands ONE state to every unit of the zone, and a
// unit drops a setpoint off the half degree: the state goes out on the
// grid a device write uses. No bounds are applied, a zone holding units
// of several ranges and modes; a `null` setpoint is the group's "leave
// as it is" and stays one.
const toWireGroupState = (state: ClassicGroupState): ClassicGroupState =>
  typeof state.SetTemperature === 'number'
    ? { ...state, SetTemperature: toAtaSetpoint(state.SetTemperature, null) }
    : state

/**
 * Abstract base for zone facades (building, floor, area) that support ATA group
 * operations.
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

  // A READ of the group must leave the members' snapshots alone. The
  // group state is what MELCloud holds for the GROUP, not what each
  // member reports, and a member's snapshot is the body of its next
  // write: a member in Cool patched with the group's Auto would carry
  // that Auto — unflagged, then echoed back into the registry by the
  // write's own decorator — on its next temperature write. Until 59.2.1
  // this method did exactly that, mirroring the write decorator's
  // propagation for a read.
  /**
   * Reads the state MELCloud holds for the zone's ATA group: the
   * group's own state, not what each member reports. The members'
   * registry models are left as they are.
   * @returns The group state, or a typed failure.
   */
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

  /**
   * Applies a state to the zone's ATA devices in one group write; a
   * `null` or absent field leaves that setting as it is. Once MELCloud
   * has accepted the write, the zone's ATA models take the fields
   * that carry a value, and the sync notification fires for the ATA
   * type.
   * @param state - Group state to apply.
   * @throws A {@link NoChangesError} when `state` is an empty object:
   * nothing is sent.
   * @throws An {@link UpdateRejectedError} when MELCloud refuses the
   * state.
   */
  public async updateGroupState(state: ClassicGroupState): Promise<void> {
    await this.#writeGroupState(toWireGroupState(state))
  }

  // The write itself. The decorators read the state it is GIVEN (the
  // models take the fields that carry a value), which is why the
  // setpoint is put on its grid by the caller above, not in here.
  @syncDevices({ type: ClassicDeviceType.Ata })
  @classicUpdateDevices({ type: ClassicDeviceType.Ata })
  async #writeGroupState(state: ClassicGroupState): Promise<void> {
    assertUpdateAccepted(
      await this.api.updateGroupState({
        postData: {
          Specification: { [this.groupSpecificationKey]: this.id },
          State: state,
        },
      }),
    )
  }
}
