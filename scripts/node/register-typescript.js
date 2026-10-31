'use strict';

// Lets Node scripts and the legacy tests use the extension's TypeScript
// sources the way they use its JavaScript ones. Require it before anything
// else (`node --require ./scripts/node/register-typescript.js ...`):
//
// - `require`/`import` of a .ts or .tsx file runs it, compiled by esbuild.
// - A relative `.js` or extensionless specifier that names no file resolves
//   to the .ts/.tsx file of that name, as bundlers resolve it.
// - fs.readFileSync of a source file as text reads its TypeScript
//   counterpart when the .js path no longer exists, and returns .ts text
//   with its types blanked out (line and column positions are kept), so
//   source checks and tests that run sliced-out functions see plain
//   JavaScript.
// - A source file named in globalThis.__lumnoTestModuleStubs (by repository
//   path, set before the module is first imported) loads as that stand-in
//   object's properties instead, so a test can replace a module its subject
//   imports.

const fs = require('fs');
const path = require('path');
const nodeModule = require('module');
const { fileURLToPath, pathToFileURL } = require('url');
const esbuild = require('esbuild');

const repoRoot = path.resolve(__dirname, '..', '..');
const TYPESCRIPT_EXTENSIONS = ['.ts', '.tsx'];
const originalReadFileSync = fs.readFileSync;

function isFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function isTypeScriptFile(file) {
  return TYPESCRIPT_EXTENSIONS.includes(path.extname(file)) && !file.endsWith('.d.ts');
}

// The TypeScript file a missing .js or extensionless path stands for.
function findTypeScriptFile(file) {
  const extension = path.extname(file);
  const stem = extension === '.js' || extension === '.mjs' ? file.slice(0, -extension.length) : file;
  const candidates = TYPESCRIPT_EXTENSIONS.map((ext) => stem + ext)
    .concat(TYPESCRIPT_EXTENSIONS.map((ext) => path.join(file, `index${ext}`)));
  return candidates.find(isFile) || null;
}

// A repository source file that exists, falling back to its TypeScript
// counterpart; null for anything else.
function resolveSourceFile(file) {
  const absolute = path.resolve(repoRoot, file);
  if (isFile(absolute)) {
    return absolute;
  }
  return findTypeScriptFile(absolute);
}

function isRelativeSpecifier(specifier) {
  return specifier.startsWith('./') || specifier.startsWith('../') || path.isAbsolute(specifier) || specifier.startsWith('file:');
}

function compileTypeScript(file) {
  const source = originalReadFileSync(file, 'utf8');
  return esbuild.transformSync(source, {
    loader: path.extname(file) === '.tsx' ? 'tsx' : 'ts',
    format: 'esm',
    jsx: 'automatic',
    target: 'node22',
    sourcefile: file,
    sourcemap: 'inline'
  }).code;
}

let stripTypeScriptTypes = null;
function stripTypes(file, source) {
  if (path.extname(file) !== '.ts') {
    return source;
  }
  if (!stripTypeScriptTypes) {
    // Node flags the API as experimental; the warning would land in every
    // test's output.
    const emitWarning = process.emitWarning;
    process.emitWarning = function filteredEmitWarning(warning, ...rest) {
      if (String(warning && warning.message || warning).includes('stripTypeScriptTypes')) {
        return;
      }
      return emitWarning.call(process, warning, ...rest);
    };
    stripTypeScriptTypes = nodeModule.stripTypeScriptTypes;
  }
  return stripTypeScriptTypes(source, { mode: 'strip' });
}

function wantsText(options) {
  const encoding = typeof options === 'string' ? options : options && options.encoding;
  return encoding === 'utf8' || encoding === 'utf-8';
}

function toFilePath(file) {
  if (file instanceof URL) {
    return file.protocol === 'file:' ? fileURLToPath(file) : null;
  }
  return typeof file === 'string' ? file : null;
}

function isRepositorySource(file) {
  const relative = path.relative(repoRoot, file);
  return !relative.startsWith('..') && !path.isAbsolute(relative)
    && !relative.split(path.sep).includes('node_modules');
}

fs.readFileSync = function readFileSync(file, options) {
  const filePath = toFilePath(file);
  if (filePath === null || !wantsText(options)) {
    return originalReadFileSync.apply(this, arguments);
  }
  const absolute = path.resolve(filePath);
  if (!isRepositorySource(absolute)) {
    return originalReadFileSync.apply(this, arguments);
  }
  const resolved = isFile(absolute) ? absolute : findTypeScriptFile(absolute);
  if (!resolved || !isTypeScriptFile(resolved)) {
    return originalReadFileSync.apply(this, arguments);
  }
  return stripTypes(resolved, originalReadFileSync(resolved, 'utf8'));
};

// The source of a stand-in module: one named export per property of the
// object a test registered for the file.
function readModuleStub(file) {
  const stubs = globalThis.__lumnoTestModuleStubs;
  const key = path.relative(repoRoot, file).split(path.sep).join('/');
  if (!stubs || typeof stubs !== 'object' || !Object.prototype.hasOwnProperty.call(stubs, key)) {
    return null;
  }
  const names = Object.keys(stubs[key]).filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
  return [`const stub = globalThis.__lumnoTestModuleStubs[${JSON.stringify(key)}];`]
    .concat(names.map((name) => `export const ${name} = stub[${JSON.stringify(name)}];`))
    .join('\n');
}

nodeModule.registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (!isRelativeSpecifier(specifier) || !context.parentURL || !context.parentURL.startsWith('file:')) {
        throw error;
      }
      const base = specifier.startsWith('file:')
        ? fileURLToPath(specifier)
        : path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
      const file = findTypeScriptFile(base);
      if (!file) {
        throw error;
      }
      // A file URL for import; require takes paths only.
      const resolved = context.conditions.includes('require') ? file : pathToFileURL(file).href;
      return nextResolve(resolved, context);
    }
  },
  load(url, context, nextLoad) {
    if (!url.startsWith('file:')) {
      return nextLoad(url, context);
    }
    const file = fileURLToPath(url);
    if (!isTypeScriptFile(file)) {
      return nextLoad(url, context);
    }
    const stubSource = readModuleStub(file);
    if (stubSource !== null) {
      return { format: 'module', source: stubSource, shortCircuit: true };
    }
    return { format: 'module', source: compileTypeScript(file), shortCircuit: true };
  }
});

module.exports = { findTypeScriptFile, resolveSourceFile };
