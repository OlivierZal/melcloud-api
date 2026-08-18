import type { ClassicFlatZone } from './classic-generic.ts'
import type { HomeFlatZone } from './home.ts'

/**
 * Node union of the flat picker list across both dialects — the one
 * type a consumer's zone picker speaks; the `model` tags
 * (`buildings`/`floors`/`areas`/`devices`,
 * `homeBuildings`/`homeDevices`) discriminate, and the consumer's
 * option-value convention stays `<model>_<id>`, split at the FIRST
 * underscore (a Home id may itself contain underscores).
 * @category Types
 */
export type FlatZone = ClassicFlatZone | HomeFlatZone
