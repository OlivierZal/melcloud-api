import { BaseSuperDeviceFacade, type IBaseSuperDeviceFacade } from '.'
import { FloorModel } from '../models'

export default class
  extends BaseSuperDeviceFacade<FloorModel>
  implements IBaseSuperDeviceFacade
{
  protected readonly frostProtectionLocation = 'FloorIds'

  protected readonly holidayModeLocation = 'Floors'

  protected readonly modelClass = FloorModel

  protected readonly setAtaGroupSpecification = 'FloorID'

  protected readonly tableName = 'Floor'
}
