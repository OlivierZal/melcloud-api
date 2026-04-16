const config = {
  cacheBust: true,
  cleanOutputDir: true,
  entryPoints: ['src/index.ts'],
  excludePrivate: true,
  hideGenerator: true,
  hostedBaseUrl: 'https://olivierzal.github.io/melcloud-api/',
  includeVersion: true,
  markdownLinkExternal: true,
  name: 'MELCloud & MELCloud Home API for Node.js',
  navigationLinks: {
    GitHub: 'https://github.com/OlivierZal/melcloud-api',
    npm: 'https://www.npmjs.com/package/@olivierzal/melcloud-api',
  },
  out: 'docs',
  readme: 'README.md',
  searchInComments: true,
  skipErrorChecking: true,
  sourceLinkExternal: true,
  tsconfig: 'tsconfig.build.json',
  useFirstParagraphOfCommentAsSummary: true,
}

export default config
