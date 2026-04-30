import type { Config } from '@docusaurus/types'
import type * as Preset from '@docusaurus/preset-classic'

const config: Config = {
  title: 'Locksmith',
  tagline: 'Auth in an afternoon.',
  url: 'https://docs.getlocksmith.dev',
  baseUrl: '/',
  favicon: 'img/favicon.ico',
  organizationName: 'locksmith-app',
  projectName: 'locksmith-docs',

  onBrokenLinks: 'warn',

  markdown: {
    format: 'mdx',
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/locksmith-app/docs/edit/main/',
          docItemComponent: '@theme/ApiItem',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    [
      '@docusaurus/plugin-client-redirects',
      {
        redirects: [
          {
            from: '/api/locksmith',
            to: '/api/generated/locksmith-public-api',
          },
        ],
      },
    ],
    [
      'docusaurus-plugin-openapi-docs',
      {
        id: 'api',
        docsPluginId: 'classic',
        config: {
          locksmith: {
            specPath: 'static/openapi.json',
            outputDir: 'docs/api/generated',
            sidebarOptions: { groupPathsBy: 'tag', categoryLinkSource: 'tag' },
            downloadUrl: '/openapi.json',
            hideSendButton: false,
          },
        },
      },
    ],
  ],

  themes: ['docusaurus-theme-openapi-docs'],

  themeConfig: {
    navbar: {
      title: 'Locksmith',
      items: [
        { type: 'docSidebar', sidebarId: 'main', position: 'left', label: 'Docs' },
        { type: 'docSidebar', sidebarId: 'api', position: 'left', label: 'API' },
        { href: 'https://getlocksmith.dev', label: 'App', position: 'right' },
        {
          href: 'https://github.com/locksmith-app/docs',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Introduction', to: '/' },
            { label: 'API reference', to: '/api/generated/locksmith-public-api' },
          ],
        },
        {
          title: 'SDKs',
          items: [
            { label: 'TypeScript', to: '/sdks/typescript' },
            { label: 'Python', to: '/sdks/python' },
            { label: 'Go', to: '/sdks/go' },
          ],
        },
        {
          title: 'More',
          items: [
            { label: 'Dashboard', href: 'https://getlocksmith.dev' },
            { label: 'GitHub', href: 'https://github.com/locksmith-app/docs' },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Locksmith`,
    },
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    prism: {
      theme: require('prism-react-renderer').themes.github,
      darkTheme: require('prism-react-renderer').themes.dracula,
      additionalLanguages: ['bash', 'json', 'http', 'python', 'go', 'rust', 'ruby', 'java', 'kotlin', 'swift', 'dart', 'php'],
    },
  } satisfies Preset.ThemeConfig,
}

export default config
