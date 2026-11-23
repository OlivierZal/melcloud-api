// @ts-check
import { typedocBase } from '@olivierzal/configs/typedoc'

/** @type {Partial<import('typedoc').TypeDocOptions>} */
const config = {
  // The core is this SDK's own lower layer, not a third party: what the
  // clients inherit from it (`authenticate`, `logOut`, the members of
  // `LifecycleEvents`) is part of this reference, shown from the first
  // visit, where the theme hides the members of an external package
  // until its reader asks for them. Every other package stays external.
  externalPattern: ['**/node_modules/!(@olivierzal)/**'],
  // Core symbols referenced from re-exported doc comments resolve to
  // the api-core docs site; deep pages could drift with typedoc's URL
  // scheme, so the mapping points at the site root.
  externalSymbolLinkMappings: {
    '@olivierzal/api-core': {
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
      'HTTP',
      'Types',
    ],
    hostedBaseUrl: 'https://olivierzal.github.io/melcloud-api/',
    intentionallyNotExported: [
      // Type-level machinery behind published aliases — consumers name
      // the alias (the per-type data aliases), never the helper.
      'DeviceDataMapping',
      // The four id brands are inferred from the zod schemas that read
      // them off the wire; the schemas stay out of the package exports
      // so ids cannot be minted outside the SDK, and the alias names
      // their origin.
      'ClassicAreaIdSchema',
      'ClassicBuildingIdSchema',
      'ClassicDeviceIdSchema',
      'ClassicFloorIdSchema',
      // Parameters of SDK-internal wiring (facade construction, registry
      // sync) that consumers never call; tagged `@internal` in source.
      // The decorators' own option types left with the decorators
      // (56.0.0): nothing public references them any more.
      'HomeAtaFacadeResolver',
      'TypedHomeDeviceData',
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
