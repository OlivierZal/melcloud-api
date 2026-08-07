// @ts-check
import { typedocBase } from '@olivierzal/configs/typedoc'

/** @type {Partial<import('typedoc').TypeDocOptions>} */
const config = typedocBase({
  categoryOrder: [
    'API Clients',
    'Facades',
    'Entities',
    'Errors',
    'Configuration',
    'Constants',
    'Mappings',
    'Decorators',
    'HTTP',
    'Types',
  ],
  hostedBaseUrl: 'https://olivierzal.github.io/melcloud-api/',
  intentionallyNotExported: [
    // Type-level machinery behind published aliases — consumers name
    // the alias (`ClassicModel`, the branded ids, the per-type data
    // aliases), never the helper; the id brand stays unnameable so ids
    // cannot be minted outside the SDK.
    'BaseModel',
    'Brand',
    'DeviceDataMapping',
    // Parameters of SDK-internal wiring (facade construction, registry
    // sync, the update decorator) that consumers never call; tagged
    // `@internal` in source.
    'HomeAtaFacadeResolver',
    'TypedHomeDeviceData',
    'UpdatePatchKind',
  ],
  name: 'MELCloud & MELCloud Home API for Node.js',
  navigationLinks: {
    GitHub: 'https://github.com/OlivierZal/melcloud-api',
    'GitHub Packages':
      'https://github.com/OlivierZal/melcloud-api/pkgs/npm/melcloud-api',
  },
})

export default config
