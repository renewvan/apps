import { defineConfig } from 'vite-plus'

// Workspace-wide lint, format and staged-file checks (Vite+ reads these from the root config only;
// each app's own vite.config.ts keeps its build, dev server and test settings). The mobile app
// still lints with ESLint and formats with Prettier (apps/mobile/.lintstagedrc), so it is ignored
// here until it moves to Oxlint and Oxfmt.
const MOBILE = 'apps/mobile/**'

export default defineConfig({
  lint: {
    ignorePatterns: [MOBILE],
    plugins: ['react', 'typescript', 'oxc'],
    rules: {
      'react/rules-of-hooks': 'error',
      'react/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
        },
      ],
      'vite-plus/prefer-vite-plus-imports': 'error',
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
    jsPlugins: [
      {
        name: 'vite-plus',
        specifier: 'vite-plus/oxlint-plugin',
      },
    ],
  },
  fmt: {
    useTabs: false,
    tabWidth: 2,
    printWidth: 100,
    singleQuote: true,
    semi: false,
    trailingComma: 'all',
    arrowParens: 'always',
    sortPackageJson: false,
    sortTailwindcss: {},
    ignorePatterns: [
      MOBILE,
      'dist',
      'dist-ssr',
      'node_modules',
      'pnpm-lock.yaml',
      '*.min.*',
      'apps/dashboard/docs/',
      '.scratch/',
    ],
  },
  staged: {
    '*.{ts,tsx,js,jsx,mjs,cjs}': ['vp lint', 'vp fmt'],
    '*': 'vp fmt --no-error-on-unmatched-pattern',
  },
})
