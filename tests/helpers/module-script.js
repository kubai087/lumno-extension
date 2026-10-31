'use strict';

// Runs source modules the way the extension does: bundled into one classic
// script. Tests that evaluate code in a vm context or a JSDOM window use these
// instead of reading a module's text, which `import` and `export` keep from
// running as a script.

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const esbuild = require('esbuild');
const { getEntry } = require('../../scripts/build/entries');
const { resolveSourceFile } = require('../../scripts/node/register-typescript');
const { BUNDLE_TSCONFIG_RAW } = require('./bundle-tsconfig');

const repoRoot = path.resolve(__dirname, '..', '..');
const cache = new Map();

// A source path as tests name it, resolved to the file on disk (a .js path
// may name a module that is now TypeScript).
function sourcePath(file) {
  return resolveSourceFile(file) || path.join(repoRoot, file);
}

function build(entry, globalName) {
  const key = `${entry}\0${globalName || ''}`;
  if (!cache.has(key)) {
    const result = esbuild.buildSync({
      absWorkingDir: repoRoot,
      tsconfigRaw: BUNDLE_TSCONFIG_RAW,
      entryPoints: [entry],
      bundle: true,
      format: 'iife',
      globalName,
      target: ['chrome110', 'firefox140'],
      // As the extension's build does, for React and anything else that asks.
      define: { 'process.env.NODE_ENV': '"production"' },
      charset: 'utf8',
      write: false,
      logLevel: 'silent'
    });
    cache.set(key, result.outputFiles[0].text);
  }
  return cache.get(key);
}

function withEntry(name, contents, run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lumno-module-'));
  const entry = path.join(directory, name);
  fs.writeFileSync(entry, contents);
  try {
    return run(entry);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

// A module with some of the modules it imports replaced by globals of the
// context it runs in, so a test can hand it fakes: { 'src/x.ts': 'GlobalName' }.
function buildWithStubs(entry, globalName, stubs) {
  const key = `${entry}\0${globalName || ''}\0${JSON.stringify(stubs)}`;
  if (!cache.has(key)) {
    cache.set(key, execFileSync(process.execPath, [
      path.join(__dirname, 'module-script-build.js'),
      JSON.stringify({ entry, globalName, stubs })
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  }
  return cache.get(key);
}

// One module and everything it imports, as a script. With globalName, the
// script assigns the module's exports to that global; `also` adds exports of
// the modules it imports, by file: { 'src/x.ts': ['name'] }; `stubs` replaces
// imported modules with context globals: { 'src/x.ts': 'GlobalName' }.
function moduleScript(file, globalName, also, stubs) {
  if (stubs) {
    if (also) throw new Error('moduleScript takes also or stubs, not both');
    return buildWithStubs(sourcePath(file), globalName, stubs);
  }
  if (!also) {
    return build(sourcePath(file), globalName);
  }
  const key = `${file}\0${globalName}\0${JSON.stringify(also)}`;
  if (!cache.has(key)) {
    const lines = [`export * from ${JSON.stringify(sourcePath(file))};`].concat(
      Object.entries(also).map(([from, names]) => `export { ${names.join(', ')} } from ${JSON.stringify(sourcePath(from))};`)
    );
    cache.set(key, withEntry('entry.js', lines.join('\n'), (entry) => build(entry, globalName)));
  }
  return cache.get(key);
}

// Runs a module in a vm context and returns its exports. Pass globalName to
// also leave them on the context under that name; options take also or
// stubs, as for moduleScript.
function runModuleInContext(file, context, globalName = '__lumnoTestModule', options = {}) {
  vm.runInContext(moduleScript(file, globalName, options.also, options.stubs), context, { filename: file });
  return context[globalName];
}

// An entry from scripts/build/entries.js, as a classic script that runs it
// the way the page, manifest or injection list does. `expose` leaves the
// exports of some of its modules on globals, so a test can reach the
// instances the entry uses: { 'src/x.ts': 'GlobalName' }. `stubs` replaces
// modules it imports with context globals instead, as for moduleScript.
function bundleScript(name, expose, stubs) {
  const entry = getEntry(name);
  if (stubs) {
    if (expose) throw new Error('bundleScript takes expose or stubs, not both');
    return buildWithStubs(sourcePath(entry.source), undefined, stubs);
  }
  const key = `bundle:${name}\0${JSON.stringify(expose || {})}`;
  if (!cache.has(key)) {
    const imports = [`import ${JSON.stringify(sourcePath(entry.source))};`];
    Object.entries(expose || {}).forEach(([file, globalName], index) => {
      imports.push(`import * as exposed${index} from ${JSON.stringify(sourcePath(file))};`);
      imports.push(`globalThis.${globalName} = exposed${index};`);
    });
    cache.set(key, withEntry(`${name}.js`, imports.join('\n'), (entry) => build(entry)));
  }
  return cache.get(key);
}

// The source of a script the worker imports by URL: a build/<name>.js path
// is built from its entry in scripts/build/entries.js, anything else is read
// from disk.
function workerScriptSource(url) {
  const match = String(url).replace(/\\/g, '/').match(/(?:^|\/)build\/([\w-]+)\.js$/);
  return match ? bundleScript(match[1]) : fs.readFileSync(String(url), 'utf8');
}

module.exports = { bundleScript, moduleScript, runModuleInContext, workerScriptSource };
