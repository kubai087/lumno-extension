// Reading the repository and the development build (dist/chrome/, written by
// npm run build) as data, for the checks in tests/repo.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
// The development extension and its built scripts.
export const EXTENSION_DIR = join(REPO_ROOT, 'dist', 'chrome');
export const BUILD_DIR = join(EXTENSION_DIR, 'build');

const require = createRequire(import.meta.url);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function repoPath(relativePath: string): string {
  return join(REPO_ROOT, relativePath);
}

export function readRepoText(relativePath: string): string {
  return readFileSync(repoPath(relativePath), 'utf8');
}

export function readRepoJson(relativePath: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readRepoText(relativePath));
  if (!isRecord(parsed)) {
    throw new Error(`${relativePath} does not hold a JSON object`);
  }
  return parsed;
}

// A record field that must be a record.
export function recordField(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];
  if (!isRecord(value)) {
    throw new Error(`Expected ${key} to be an object`);
  }
  return value;
}

export function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new Error(`Expected ${key} to be a string`);
  }
  return value;
}

// The repository path of a file, with POSIX separators on every platform.
export function toRepoPath(file: string): string {
  return relative(REPO_ROOT, file).split(sep).join('/');
}

// Every file under a repository directory whose name matches.
export function listRepoFiles(directory: string, pattern: RegExp): string[] {
  const files: string[] = [];
  const visit = (current: string) => {
    readdirSync(current, { withFileTypes: true }).forEach((entry) => {
      const entryPath = join(current, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile() && pattern.test(entry.name)) {
        files.push(toRepoPath(entryPath));
      }
    });
  };
  visit(repoPath(directory));
  return files.sort();
}

export type LocaleMessages = Record<string, string>;

// A locale's messages, by key.
export function readLocaleMessages(locale: string): LocaleMessages {
  const parsed = readRepoJson(`_locales/${locale}/messages.json`);
  return Object.fromEntries(Object.entries(parsed).map(([key, entry]) => [
    key,
    isRecord(entry) && typeof entry.message === 'string' ? entry.message : ''
  ]));
}

export interface BuildEntry {
  name: string;
  kind: string;
  source: string;
}

function isBuildEntry(value: unknown): value is BuildEntry {
  return isRecord(value) && typeof value.name === 'string' && typeof value.kind === 'string' &&
    typeof value.source === 'string';
}

// The entries scripts/build/entries.js builds.
export function readBuildEntries(): BuildEntry[] {
  const exported: unknown = require('../../scripts/build/entries.js');
  const entries = isRecord(exported) ? exported.ENTRIES : null;
  if (!Array.isArray(entries) || !entries.every(isBuildEntry)) {
    throw new Error('scripts/build/entries.js exports no ENTRIES list');
  }
  return entries;
}

// Where an entry's script is built, inside the extension (as entries.js says).
export function entryOutputPath(entry: BuildEntry): string {
  return entry.kind === 'injected' ? `build/injected/${entry.name}.js` : `build/${entry.name}.js`;
}

// The relative paths an ES module imports statically. Built modules list
// their imports first, so reading stops at the first other statement.
function staticImports(source: string): string[] {
  const imports: string[] = [];
  const statement = /^\s*import\s*(?:[^;"'`]*?\bfrom\s*)?(["'])([^"']+)\1\s*;?/;
  let rest = source.replace(/^(?:\s*\/\*[\s\S]*?\*\/|\s*\/\/[^\n]*\n)*/, '');
  let match = statement.exec(rest);
  while (match) {
    imports.push(match[2]);
    rest = rest.slice(match[0].length);
    match = statement.exec(rest);
  }
  return imports.filter((specifier) => specifier.startsWith('.'));
}

// The built files loading `files` from buildDir runs, each module's chunks
// included; null when one of them is missing.
export function routeFiles(buildDir: string, files: readonly string[]): string[] | null {
  const loaded = new Set<string>();
  const visit = (file: string): boolean => {
    if (loaded.has(file)) {
      return true;
    }
    const filePath = join(buildDir, file);
    if (!existsSync(filePath)) {
      return false;
    }
    loaded.add(file);
    return staticImports(readFileSync(filePath, 'utf8'))
      .every((specifier) => visit(posix.join(posix.dirname(file), specifier)));
  };
  return files.every(visit) ? Array.from(loaded) : null;
}

// The built route of `files`, which must be built.
export function requireRoute(files: readonly string[]): string[] {
  const route = routeFiles(BUILD_DIR, files);
  if (!route) {
    throw new Error(`${files.join(', ')} and their chunks should be built; run npm run build first`);
  }
  return route;
}

// The repository modules a built file (inside build/) carries, from its
// source map; the bundler's own runtime chunk has none.
function builtFileSources(file: string): string[] {
  const mapPath = join(BUILD_DIR, `${file}.map`);
  if (!existsSync(mapPath)) {
    return [];
  }
  const map: unknown = JSON.parse(readFileSync(mapPath, 'utf8'));
  const sources = isRecord(map) ? map.sources : null;
  if (!isStringArray(sources)) {
    throw new Error(`build/${file}.map lists no sources`);
  }
  return sources.map((source) => toRepoPath(resolve(dirname(join(BUILD_DIR, file)), source)));
}

// The repository modules a built entry (and the chunks it loads) carries.
export function builtModules(file: string): string[] {
  return requireRoute([file]).flatMap(builtFileSources);
}

// Chrome's extension ID for a manifest key: the first 16 bytes of the key's
// SHA-256, each nibble a letter from a.
export function extensionIdFromManifestKey(key: unknown): string {
  const digest = createHash('sha256').update(Buffer.from(String(key || ''), 'base64')).digest().subarray(0, 16);
  return Array.from(digest)
    .flatMap((byte) => [byte >> 4, byte & 0x0f])
    .map((nibble) => String.fromCharCode('a'.charCodeAt(0) + nibble))
    .join('');
}
