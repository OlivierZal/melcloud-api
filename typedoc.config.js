const config = {
  cleanOutputDir: true,
  entryPoints: ['src/main.ts'],
  tsconfig: 'tsconfig.build.json',
  enumMembersFormat: 'table',
  excludePrivate: true,
  expandObjects: true,
  expandParameters: true,
  hidePageHeader: true,
  includeVersion: true,
  indexFormat: 'table',
  out: 'docs',
  router: 'module',
  parametersFormat: 'table',
  plugin: ['typedoc-plugin-markdown'],
  propertiesFormat: 'table',
  readme: 'none',
  textContentMappings: {
    'title.indexPage': 'MELCloud API for Node.js - {version}',
  },
  typeDeclarationFormat: 'table',
  useCodeBlocks: true,
}

export default config
