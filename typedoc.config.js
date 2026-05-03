const config = {
  cacheBust: true,
  categorizeByGroup: false,
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
    '*',
  ],
  cleanOutputDir: true,
  defaultCategory: 'Other',
  entryPoints: ['src/index.ts'],
  excludeInternal: true,
  excludePrivate: true,
  excludeProtected: true,
  hideGenerator: true,
  highlightLanguages: [
    'bash',
    'console',
    'css',
    'html',
    'ini',
    'javascript',
    'json',
    'jsonc',
    'json5',
    'shell',
    'tsx',
    'typescript',
  ],
  hostedBaseUrl: 'https://olivierzal.github.io/melcloud-api/',
  includeVersion: true,
  // Symbols referenced by public types but intentionally not separately
  // exported. Two categories:
  //   - Internal infrastructure leaked through public type signatures
  //     (also tagged `@internal` in source).
  //   - Declaration-merged interfaces that share their name with a
  //     public class export (the merge makes them a single symbol at
  //     the public surface; TypeDoc sees them as two).
  intentionallyNotExported: [
    'BaseModel',
    'Brand',
    'ClassicBuildingFacade',
    'ClassicDeviceAtwFacade',
    'ClassicDeviceAtwHasZone2Facade',
    'DeviceDataMapping',
    'HomeAPI',
    'HttpErrorRequestConfig',
    'TransportConfig',
    'TypedHomeDeviceData',
    'UpdatePatchKind',
  ],
  markdownLinkExternal: true,
  name: 'MELCloud & MELCloud Home API for Node.js',
  navigationLinks: {
    GitHub: 'https://github.com/OlivierZal/melcloud-api',
    'GitHub Packages':
      'https://github.com/OlivierZal/melcloud-api/pkgs/npm/melcloud-api',
  },
  out: 'docs',
  plugin: ['typedoc-plugin-mdn-links', 'typedoc-plugin-coverage'],
  readme: 'README.md',
  // Documentation is required at the declaration level (interfaces,
  // classes, functions, methods, type aliases). Per-property /
  // per-enum-member descriptions are not required because most public
  // types here mirror the MELCloud wire protocol verbatim — field
  // names are self-explanatory and forcing prose for each would be
  // noise. Authors are still free (and encouraged) to add property
  // comments where they convey units, constraints, or semantics
  // beyond the name.
  requiredToBeDocumented: [
    'Class',
    'Constructor',
    'Enum',
    'Function',
    'Interface',
    'Method',
    'Module',
    'Namespace',
    'Reference',
    'TypeAlias',
    'Variable',
  ],
  searchInComments: true,
  sourceLinkExternal: true,
  treatValidationWarningsAsErrors: true,
  tsconfig: 'tsconfig.build.json',
  useFirstParagraphOfCommentAsSummary: true,
  validation: {
    invalidLink: true,
    invalidPath: true,
    notDocumented: true,
    notExported: true,
    rewrittenLink: true,
  },
}

export default config
