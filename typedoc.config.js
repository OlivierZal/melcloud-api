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
  ],
  cleanOutputDir: true,
  entryPoints: ['src/index.ts'],
  excludeInternal: true,
  excludePrivate: true,
  excludeProtected: true,
  // Single H1 on the index page, owned by the README.
  headings: { document: false, readme: false },
  hideGenerator: true,
  // Languages used in code fences across the README and TSDoc. `javascript`
  // covers `js` blocks inherited from the TypeScript stdlib's `Error`
  // example annotations, which propagate to every error subclass.
  highlightLanguages: ['ini', 'javascript', 'shell', 'typescript'],
  hostedBaseUrl: 'https://olivierzal.github.io/melcloud-api/',
  includeVersion: true,
  intentionallyNotExported: [
    // Internal infrastructure leaked through public type signatures
    // (also tagged `@internal` in source).
    'BaseModel',
    'Brand',
    'DeviceDataMapping',
    'HttpErrorRequestConfig',
    'TransportConfig',
    'TypedHomeDeviceData',
    'UpdatePatchKind',
    // Declaration-merged interfaces sharing a name with their public
    // class. The class side carries the public surface; TypeDoc sees
    // the interface as a separate symbol and would warn otherwise.
    // No symmetric Classic entry: `ClassicAPI` implements the
    // differently-named `ClassicAPIAdapter`, so no merge happens.
    'ClassicBuildingFacade',
    'ClassicDeviceAtwFacade',
    'ClassicDeviceAtwHasZone2Facade',
    'HomeAPI',
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
  // Property and EnumMember excluded: most public types mirror the
  // MELCloud wire protocol verbatim, where field names speak for
  // themselves. Per-field prose would be noise.
  requiredToBeDocumented: [
    'Accessor',
    'Class',
    'Constructor',
    'Enum',
    'EnumMember',
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
  searchInDocuments: true,
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
    unusedMergeModuleWith: true,
  },
}

export default config
