const config = {
  cleanOutputDir: true,
  entryPoints: ['src/main.ts'],
  enumMembersFormat: 'table',
  excludePrivate: true,
  expandObjects: true,
  expandParameters: true,
  hidePageHeader: true,
  includeVersion: true,
  indexFormat: 'table',
  out: 'docs',
  parametersFormat: 'table',
  plugin: ['typedoc-plugin-markdown'],
  propertiesFormat: 'table',
  readme: 'none',
  router: 'module',
  textContentMappings: {
    'title.indexPage': 'MELCloud API for Node.js - {version}',
  },
  tsconfig: 'tsconfig.build.json',
  typeDeclarationFormat: 'table',
  useCodeBlocks: true,
}

export default config
