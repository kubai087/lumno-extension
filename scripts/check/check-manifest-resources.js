const fs = require('fs');
const path = require('path');
const { BUILD_DIRECTORY, ENTRIES, entryOutputPath } = require('../build/entries');
const { EXTENSION_OUTPUT, extensionOutputPath } = require('../build/extension-output');

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const missing = [];
const entryOutputPaths = new Set(ENTRIES.map(entryOutputPath));

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeManifestResourcePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function manifestResourcePatternMatchesPath(value, candidate) {
  const normalizedPattern = normalizeManifestResourcePath(value);
  const pattern = new RegExp(`^${normalizedPattern.split('*').map(escapeRegExp).join('.*')}$`);
  return pattern.test(normalizeManifestResourcePath(candidate));
}

// Whether a resource pattern matches a file, under root (the repository by
// default).
function manifestResourcePatternHasMatch(value, root = '') {
  if (!value.includes('*')) {
    return false;
  }
  const wildcardIndex = value.indexOf('*');
  const prefixDirectory = path.join(root, path.dirname(value.slice(0, wildcardIndex)));
  if (!prefixDirectory || !fs.existsSync(prefixDirectory)) {
    return false;
  }
  const candidates = [];
  const visit = (directory) => {
    fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile()) {
        candidates.push(entryPath);
      }
    });
  };
  visit(prefixDirectory);
  return candidates.some((candidate) => manifestResourcePatternMatchesPath(value, root ? path.relative(root, candidate) : candidate));
}

function checkPath(value) {
  if (!value || typeof value !== 'string') {
    return;
  }
  if (/^(https?:|chrome:|__MSG_)/.test(value)) {
    return;
  }
  // Built scripts are build output: a reference needs an entry built there,
  // and a pattern under build/ needs a match in the development build.
  const normalized = normalizeManifestResourcePath(value);
  if (normalized.startsWith(`${BUILD_DIRECTORY}/`)) {
    if (normalized.includes('*')) {
      if (!manifestResourcePatternHasMatch(normalized, extensionOutputPath(''))) {
        missing.push(value);
      }
      return;
    }
    if (!entryOutputPaths.has(normalized) && !fs.existsSync(extensionOutputPath(normalized))) {
      missing.push(value);
    }
    return;
  }
  if (manifestResourcePatternHasMatch(value)) {
    return;
  }
  if (!fs.existsSync(value)) {
    missing.push(value);
  }
}

function checkRelativeResourcePath(file, value) {
  if (!value || typeof value !== 'string') {
    return;
  }
  if (/^(https?:|data:|blob:|mailto:|tel:|chrome:|about:|#|__MSG_)/.test(value)) {
    return;
  }
  if (value.includes('${') || value.startsWith('var(')) {
    return;
  }
  const cleanValue = value.split(/[?#]/)[0];
  if (!cleanValue || cleanValue.startsWith('#')) {
    return;
  }
  const resolved = cleanValue.startsWith('/')
    ? path.normalize(cleanValue.slice(1))
    : path.normalize(path.join(path.dirname(file), cleanValue));
  if (resolved.startsWith('..') || path.isAbsolute(resolved)) {
    return;
  }
  checkPath(resolved);
}

function checkCssUrlReferences(file, source) {
  // A CSS url(), not a call such as `source.url(query)` in scripts.
  const cssUrlPattern = /(?<![\w$.])url\(\s*(?:"([^"]+)"|'([^']+)'|([^)"'\s]+))\s*\)/g;
  let match = null;
  while ((match = cssUrlPattern.exec(source))) {
    checkRelativeResourcePath(file, match[1] || match[2] || match[3] || '');
  }
}

function checkConcreteExtensionPathReferences(file, source) {
  const extensionPathPattern = /(['"`])((?:assets|build|src|_locales|output)\/[^'"`?#)>\s]+)(?:[?#][^'"`]*)?\1/g;
  let match = null;
  while ((match = extensionPathPattern.exec(source))) {
    if (!match[2].includes('${')) {
      checkPath(match[2]);
    }
  }
}

// The scripts under dir. The React sources in the surfaces' react/ folders
// are checked through the islands built from them (listRuntimeFiles): their
// CSS urls resolve against the page, not the source file.
function listJsFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'react') {
        files.push(...listJsFiles(fullPath));
      }
      return;
    }
    if (entry.isFile() && /\.(?:js|ts|tsx)$/.test(fullPath) && !/\.(?:d|test)\.tsx?$/.test(fullPath)) {
      files.push(fullPath);
    }
  });
  return files;
}

function listFilesWithExtension(dir, extension) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesWithExtension(fullPath, extension));
      return;
    }
    if (entry.isFile() && fullPath.endsWith(extension)) {
      files.push(fullPath);
    }
  });
  return files;
}

function listHtmlFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listHtmlFiles(fullPath));
      return;
    }
    if (entry.isFile() && fullPath.endsWith('.html')) {
      files.push(fullPath);
    }
  });
  return files;
}

// The runtime sources and the scripts built from them, each under the path
// it has in the extension.
function listRuntimeFiles() {
  const built = extensionOutputPath(BUILD_DIRECTORY);
  if (!fs.existsSync(built)) {
    throw new Error(`Missing ${EXTENSION_OUTPUT}/${BUILD_DIRECTORY}/; run npm run build first.`);
  }
  return listJsFiles('src').map((file) => ({ file, disk: file }))
    .concat(listJsFiles(built).map((disk) => ({
      file: path.join(BUILD_DIRECTORY, path.relative(built, disk)),
      disk
    })));
}

function checkRuntimeGetUrlReferences() {
  const files = listRuntimeFiles();
  const staticGetUrlPattern = /chrome\.runtime\.getURL\(\s*(['"`])([^'"`]+)\1\s*\)/g;
  files.forEach(({ file, disk }) => {
    const source = fs.readFileSync(disk, 'utf8');
    checkConcreteExtensionPathReferences(file, source);
    checkCssUrlReferences(file, source);
    let match = null;
    while ((match = staticGetUrlPattern.exec(source))) {
      const value = match[2];
      if (!value || value.includes('${')) {
        continue;
      }
      checkPath(value.split(/[?#]/)[0]);
    }
  });
}

function checkHtmlReferences() {
  const files = [...listHtmlFiles('src'), 'newtab.html'];
  const referencePattern = /\b(?:src|href)=["']([^"']+)["']/g;
  files.forEach((file) => {
    const source = fs.readFileSync(file, 'utf8');
    const baseMatch = source.match(/<base\s+[^>]*href=["']([^"']+)["']/i);
    const baseHref = baseMatch ? baseMatch[1] : '';
    const referenceBase = baseHref
      ? path.normalize(path.join(path.dirname(file), baseHref))
      : path.dirname(file);
    const referenceFile = path.join(referenceBase, path.basename(file));
    checkCssUrlReferences(referenceFile, source);
    let match = null;
    while ((match = referencePattern.exec(source))) {
      const value = match[1];
      if (!value || /^(https?:|data:|mailto:|tel:|#|__MSG_)/.test(value)) {
        continue;
      }
      if (baseHref && value === baseHref) {
        continue;
      }
      const cleanValue = value.split(/[?#]/)[0];
      const resolved = path.normalize(path.join(referenceBase, cleanValue));
      checkPath(resolved);
    }
  });
}

function checkCssFiles() {
  const files = [
    ...listFilesWithExtension('src', '.css'),
    ...listFilesWithExtension('assets', '.css')
  ];
  files.forEach((file) => {
    checkCssUrlReferences(file, fs.readFileSync(file, 'utf8'));
  });
}

function checkNewtabWallpaperFiles() {
  const source = fs.readFileSync('src/newtab/wallpaper/wallpaper-options.ts', 'utf8');
  const directoryMatch = source.match(/NEWTAB_WALLPAPER_EXTENSION_DIRECTORY\s*=\s*['"]([^'"]+)['"]/);
  // Each built-in wallpaper ships a panel thumbnail and the small copy its effects sample.
  const suffixes = ['NEWTAB_WALLPAPER_THUMBNAIL_SUFFIX', 'NEWTAB_WALLPAPER_SAMPLE_SUFFIX']
    .map((name) => (source.match(new RegExp(`${name}\\s*=\\s*['"]([^'"]+)['"]`)) || [])[1])
    .filter(Boolean);
  const directory = directoryMatch ? directoryMatch[1] : '';
  if (!directory || suffixes.length !== 2) {
    throw new Error('wallpaper-options.ts no longer names the wallpaper directory and file suffixes.');
  }
  const filePattern = /\bfile:\s*['"]([^'"]+\.webp)['"]/g;
  let match = null;
  while ((match = filePattern.exec(source))) {
    const wallpaperFile = match[1];
    checkPath(`${directory}/${wallpaperFile}`);
    suffixes.forEach((suffix) => {
      checkPath(`${directory}/${wallpaperFile.replace(/\.[^.]+$/, suffix)}`);
    });
  }
}

function run() {
  checkPath(manifest.background && manifest.background.service_worker);
  checkPath(manifest.chrome_url_overrides && manifest.chrome_url_overrides.newtab);
  checkPath(manifest.options_ui && manifest.options_ui.page);

  Object.values(manifest.icons || {}).forEach(checkPath);
  (manifest.content_scripts || []).forEach((script) => {
    (script.js || []).forEach(checkPath);
    (script.css || []).forEach(checkPath);
  });
  // A web-accessible _favicon endpoint lets any page probe which sites the
  // user has visited; in-page surfaces get icon bytes from the background.
  const exposedFaviconResources = [];
  (manifest.web_accessible_resources || []).forEach((entry) => {
    (entry.resources || []).forEach((resource) => {
      if (/^\/?_favicon(?:\/|$)/.test(String(resource || ''))) {
        exposedFaviconResources.push(resource);
        return;
      }
      checkPath(resource);
    });
  });
  if (exposedFaviconResources.length > 0) {
    console.error(`_favicon must not be web accessible: ${exposedFaviconResources.join(', ')}`);
    process.exitCode = 1;
    return false;
  }
  ENTRIES.forEach((entry) => checkPath(entry.source));
  checkRuntimeGetUrlReferences();
  checkHtmlReferences();
  checkCssFiles();
  checkNewtabWallpaperFiles();

  if (missing.length > 0) {
    console.error('Missing manifest resources:');
    missing.forEach((item) => console.error(`- ${item}`));
    process.exitCode = 1;
    return false;
  }

  console.log('manifest resources ok');
  return true;
}

if (require.main === module) {
  run();
}

module.exports = {
  manifestResourcePatternMatchesPath,
  normalizeManifestResourcePath,
  run
};
