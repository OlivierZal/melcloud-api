import { BaseSuperDeviceFacade, type IBaseSuperDeviceFacade } from '.'
import { AreaModel } from '../models'

export default class
  extends BaseSuperDeviceFacade
  implements IBaseSuperDeviceFacade
{
  protected readonly frostProtectionLocation = 'AreaIds'

  protected readonly holidayModeLocation = 'Areas'

  protected readonly modelClass = AreaModel

  protected readonly setAtaGroupSpecification = 'AreaID'

  protected readonly tableName = 'Area'
}
