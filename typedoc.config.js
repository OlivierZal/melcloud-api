// @ts-check
import { typedocBase } from '@olivierzal/configs/typedoc'

/** @type {Partial<import('typedoc').TypeDocOptions>} */
const config = {
  // Core symbols referenced from re-exported doc comments resolve to
  // the api-core docs site; deep pages could drift with typedoc's URL
  // scheme, so the mapping points at the site root.
  externalSymbolLinkMappings: {
    '@olivierzal/api-core': {
      LifecycleEvents: 'https://olivierzal.github.io/api-core/',
      Redaction: 'https://olivierzal.github.io/api-core/',
      // The `create()` docs link the post-construction template, which
      // the SessionAPI extraction moved into the core.
      'SessionAPI.initialize': 'https://olivierzal.github.io/api-core/',
      SyncCallback: 'https://olivierzal.github.io/api-core/',
    },
  },
  ...typedocBase({
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
      // The sync-params vocabulary this SDK instantiates the core's
      // lifecycle generics with; consumers name the aliases
      // (`LifecycleEvents`, `SyncCallback`), never the parameter shape.
      'SyncParams',
    ],
    name: 'MELCloud & MELCloud Home API for Node.js',
    navigationLinks: {
      GitHub: 'https://github.com/OlivierZal/melcloud-api',
      'GitHub Packages':
        'https://github.com/OlivierZal/melcloud-api/pkgs/npm/melcloud-api',
    },
  }),
}

export default config
