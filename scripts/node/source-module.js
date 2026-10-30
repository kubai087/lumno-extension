'use strict';

// Runs one of the extension's TypeScript modules from a Node script. Vite
// resolves and compiles it, as it does for the build and the tests, so a
// script reads the same code the extension ships.
//
//   const { importSource } = require('../node/source-module');
//   const settings = await importSource('src/domain/settings/index.ts');

const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');

// The module's exports; `relativePath` is from the repository root.
async function importSource(relativePath) {
  const { runnerImport } = await import('vite');
  const { module } = await runnerImport(path.join(repoRoot, relativePath), {
    configFile: false,
    root: repoRoot,
    logLevel: 'error'
  });
  return module;
}

module.exports = { importSource };
