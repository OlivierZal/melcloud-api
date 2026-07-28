import { HomeDeviceType } from '../constants.ts'
import type { HomeDeviceAtaFacade } from './home-device-ata.ts'
import type { HomeDeviceAtwFacade } from './home-device-atw.ts'

/**
 * Union of the Home device facade variants — the Home counterpart of
 * `ClassicDeviceFacadeAny`.
 * @category Facades
 */
export type HomeDeviceFacadeAny = HomeDeviceAtaFacade | HomeDeviceAtwFacade

/**
 * Type guard that narrows a Home device facade to the ATA variant.
 * @param facade - The device facade to check.
 * @returns Whether the facade wraps an air-to-air unit.
 * @category Facades
 */
export const isHomeAtaFacade = (
  facade: HomeDeviceFacadeAny,
): facade is HomeDeviceAtaFacade => facade.type === HomeDeviceType.Ata

/**
 * Type guard that narrows a Home device facade to the ATW variant.
 * @param facade - The device facade to check.
 * @returns Whether the facade wraps an air-to-water unit.
 * @category Facades
 */
export const isHomeAtwFacade = (
  facade: HomeDeviceFacadeAny,
): facade is HomeDeviceAtwFacade => facade.type === HomeDeviceType.Atw
