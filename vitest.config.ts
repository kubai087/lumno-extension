import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// One runner, one project per environment:
//   domain    pure rules (src/domain), in Node
//   platform  browser API adapters (src/platform), against typed fakes, in Node
//   dom       everything that draws or touches a document: components,
//             features, dom/ modules, page apps (tests/pages), injected apps,
//             content scripts and the worker's services, in JSDOM
//   repo      checks of the repository and its build output (tests/repo);
//             run after `npm run build`
//   e2e       real Chrome through the CDP driver (tests/e2e); `npm run test:e2e`
// `npm test` runs every project but e2e.
const UNIT_TIMEOUT = 20000;

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  test: {
    restoreMocks: true,
    // Whole-page tests such as the options page take several seconds each on
    // a hosted CI runner, past Vitest's 5 s default.
    testTimeout: UNIT_TIMEOUT,
    projects: [
      {
        extends: true,
        test: {
          name: 'domain',
          environment: 'node',
          include: ['src/domain/**/*.test.ts']
        }
      },
      {
        extends: true,
        test: {
          name: 'platform',
          environment: 'node',
          include: ['src/platform/**/*.test.ts']
        }
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}', 'tests/pages/**/*.test.{ts,tsx}', 'tests/fakes/**/*.test.ts'],
          exclude: ['**/node_modules/**', 'src/domain/**', 'src/platform/**'],
          setupFiles: ['tests/setup.ts']
        }
      },
      {
        extends: true,
        test: {
          name: 'repo',
          environment: 'node',
          include: ['tests/repo/**/*.test.ts']
        }
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          environment: 'node',
          include: ['tests/e2e/**/*.test.ts'],
          // One browser at a time; each flow drives the whole extension.
          fileParallelism: false,
          testTimeout: 120000,
          hookTimeout: 120000
        }
      }
    ]
  }
});
