const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const storeManifest = { ...manifest };
delete storeManifest.key;
delete storeManifest.externally_connectable;
const version = manifest.version;
const repoRoot = process.cwd();
const distDir = path.join(process.cwd(), 'dist');
const zipPath = path.join(distDir, `lumno-store-v${version}.zip`);
const packageRoots = [
  'src',
  '_locales',
  'assets'
];
const developmentOnlyFiles = new Set([
  'src/background/codex-debug-bridge.js',
  'src/shared/codex-debug-surface.js'
]);
const injectedScriptFiles = [
  'src/background/extension-pages.js',
  'src/background/message-router.js',
  'src/background/newtab-fallback.js',
  'src/background/shortcut-rules.js',
  'src/background/pip-ownership.js',
  'src/background/pip-main-world.js',
  'src/shared/extension-routes.js',
  'src/shared/navigation-disposition.js',
  'src/shared/community-links.js',
  'src/shared/settings.js',
  'src/shared/search-utils.js',
  'src/shared/site-search-store.js',
  'src/shared/suggestion-navigation.js',
  'src/react/overlay-islands.js',
  'src/shared/search-input-history.js',
  'src/shared/search-input-mode.js',
  'src/shared/toast.js',
  'src/shared/shortcut-favicon.js',
  'src/shared/search-input.css',
  'src/shared/toast.css',
  'src/shared/url-guards.js',
  'src/shared/favicon-utils.js',
  'src/shared/favicon-cache.js',
  'src/overlay/runtime.js',
  'src/overlay/favicon-view.js',
  'src/overlay/suggestions-view.css',
  'src/overlay/lifecycle.js',
  'src/overlay/site-fixes.js',
  'src/overlay/search-panel.js',
  'src/content/document-pip-picker.js'
];
const forbiddenPattern = /(^|\/)(\.git|\.github|\.vscode|node_modules)(\/|$)|(^|\/)(README\.md|AGENTS\.md|\.DS_Store|package-lock\.json|package\.json)$|^assets\/images\/readme\//;

fs.mkdirSync(distDir, { recursive: true });
if (fs.existsSync(zipPath)) {
  fs.rmSync(zipPath);
}

const packageStageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumno-store-package-'));
let packageStageRemoved = false;

function cleanupPackageStage() {
  if (packageStageRemoved) {
    return;
  }
  packageStageRemoved = true;
  fs.rmSync(packageStageDir, { recursive: true, force: true });
}

process.on('exit', cleanupPackageStage);

function normalizePackagePath(value) {
  return String(value || '').split(path.sep).join('/');
}

function stagedPath(value) {
  return path.join(packageStageDir, value);
}

function packagePathForFile(file) {
  return normalizePackagePath(path.relative(packageStageDir, file));
}

function shouldCopyPackagePath(sourcePath) {
  const packagePath = normalizePackagePath(path.relative(repoRoot, sourcePath));
  if (developmentOnlyFiles.has(packagePath)) {
    return false;
  }
  if (path.basename(sourcePath) === '.DS_Store') {
    return false;
  }
  return packagePath !== 'assets/images/readme' &&
    !packagePath.startsWith('assets/images/readme/');
}

packageRoots.forEach((packageRoot) => {
  fs.cpSync(path.join(repoRoot, packageRoot), stagedPath(packageRoot), {
    recursive: true,
    filter: shouldCopyPackagePath
  });
});
fs.writeFileSync(stagedPath('manifest.json'), `${JSON.stringify(storeManifest, null, 3)}\n`);

function replaceRequired(source, pattern, replacement, expectedCount, label) {
  let count = 0;
  const nextSource = source.replace(pattern, () => {
    count += 1;
    return replacement;
  });
  if (count !== expectedCount) {
    throw new Error(`Store package transform expected ${expectedCount} ${label} match(es), found ${count}.`);
  }
  return nextSource;
}

const stagedHtmlFiles = [];
function collectHtmlFiles(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectHtmlFiles(fullPath);
    } else if (entry.isFile() && fullPath.endsWith('.html')) {
      stagedHtmlFiles.push(fullPath);
    }
  });
}
collectHtmlFiles(stagedPath('src'));

let debugSurfaceScriptCount = 0;
stagedHtmlFiles.forEach((file) => {
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(
    /^[ \t]*<script\s+src=["']\.\.\/shared\/codex-debug-surface\.js["']\s*><\/script>\s*\r?\n/gm,
    () => {
      debugSurfaceScriptCount += 1;
      return '';
    }
  );
  fs.writeFileSync(file, source);
});
if (debugSurfaceScriptCount !== 3) {
  throw new Error(`Store package transform expected 3 debug surface script tags, found ${debugSurfaceScriptCount}.`);
}

const stagedBackgroundPath = stagedPath('src/background/background.js');
let stagedBackground = fs.readFileSync(stagedBackgroundPath, 'utf8');
stagedBackground = replaceRequired(
  stagedBackground,
  /try \{\r?\n  importScripts\(chrome\.runtime\.getURL\('src\/background\/codex-debug-bridge\.js'\)\);\r?\n\} catch \(error\) \{\r?\n  console\.warn\('Lumno: failed to load Codex debug bridge helpers\.', error\);\r?\n\}\r?\n\r?\n/,
  '',
  1,
  'background debug bridge import'
);
stagedBackground = replaceRequired(
  stagedBackground,
  /const CODEX_DEBUG_BRIDGE = globalThis\.LumnoCodexDebugBackground \|\| \{\};\r?\nconst codexDebugBridge = CODEX_DEBUG_BRIDGE && typeof CODEX_DEBUG_BRIDGE\.create === 'function'\r?\n  \? CODEX_DEBUG_BRIDGE\.create\(\{ chromeApi: chrome \}\)\r?\n  : null;\r?\n/,
  '',
  1,
  'background debug bridge initialization'
);
stagedBackground = replaceRequired(
  stagedBackground,
  /if \(codexDebugBridge && typeof codexDebugBridge\.attach === 'function'\) \{\r?\n  codexDebugBridge\.attach\(\);\r?\n\}\r?\n\r?\n/,
  '',
  1,
  'background debug bridge attachment'
);
stagedBackground = replaceRequired(
  stagedBackground,
  /  const shouldInjectOverlayCodexDebugSurface = Boolean\(\r?\n    codexDebugBridge && typeof codexDebugBridge\.isEnabled === 'function' &&\r?\n    codexDebugBridge\.isEnabled\(\)\r?\n  \);\r?\n/,
  '',
  1,
  'conditional Overlay debug surface flag'
);
stagedBackground = replaceRequired(
  stagedBackground,
  /^[ \t]*\.\.\.\(shouldInjectOverlayCodexDebugSurface \? \['src\/shared\/codex-debug-surface\.js'\] : \[\]\),\r?\n/gm,
  '',
  1,
  'conditional Overlay debug surface entry'
);
stagedBackground = replaceRequired(
  stagedBackground,
  /^[ \t]*'src\/shared\/codex-debug-surface\.js',\r?\n/gm,
  '',
  2,
  'injected debug surface entry'
);
fs.writeFileSync(stagedBackgroundPath, stagedBackground);

developmentOnlyFiles.forEach((file) => {
  if (fs.existsSync(stagedPath(file))) {
    throw new Error(`Development-only file remained in store package stage: ${file}`);
  }
});
stagedHtmlFiles.forEach((file) => {
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes('codex-debug-surface.js')) {
    throw new Error(`Development-only surface reference remained in ${packagePathForFile(file)}.`);
  }
});
if (/codex-debug-(?:bridge|surface)\.js|LumnoCodexDebug|codexDebugBridge/.test(stagedBackground)) {
  throw new Error('Development-only debug bridge reference remained in staged background.js.');
}

let zipResult = null;
const zipArgs = ['-r', '-D', zipPath, ...packageRoots, 'manifest.json'];
zipResult = spawnSync('zip', zipArgs, {
  cwd: packageStageDir,
  stdio: 'inherit'
});
if (zipResult.status !== 0) {
  process.exit(zipResult.status || 1);
}

const listResult = spawnSync('zipinfo', ['-1', zipPath], {
  cwd: process.cwd(),
  encoding: 'utf8'
});
if (listResult.status !== 0) {
  console.error(listResult.stderr || 'zipinfo failed');
  process.exit(listResult.status || 1);
}

const entries = listResult.stdout.split(/\r?\n/).filter(Boolean);
const forbidden = entries.filter((entry) => forbiddenPattern.test(entry));
if (forbidden.length > 0) {
  console.error('Forbidden files in package:');
  forbidden.forEach((entry) => console.error(`- ${entry}`));
  process.exit(1);
}

const entrySet = new Set(entries);
const missing = [];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function packagedResourcePatternHasMatch(value) {
  if (!value.includes('*')) {
    return false;
  }
  const pattern = new RegExp(`^${value.split('*').map(escapeRegExp).join('.*')}$`);
  return entries.some((entry) => pattern.test(entry));
}

function checkManifestPath(value) {
  if (!value || typeof value !== 'string') {
    return;
  }
  if (/^(https?:|chrome:|__MSG_)/.test(value)) {
    return;
  }
  if (value === '_favicon/*') {
    return;
  }
  if (packagedResourcePatternHasMatch(value)) {
    return;
  }
  if (!entrySet.has(value)) {
    if (fs.existsSync(stagedPath(value)) &&
        fs.statSync(stagedPath(value)).isDirectory() &&
        entries.some((entry) => entry.startsWith(`${value}/`))) {
      return;
    }
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
  checkManifestPath(resolved);
}

function checkCssUrlReferences(file, source) {
  const cssUrlPattern = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^)"'\s]+))\s*\)/g;
  let match = null;
  while ((match = cssUrlPattern.exec(source))) {
    checkRelativeResourcePath(file, match[1] || match[2] || match[3] || '');
  }
}

function checkConcreteExtensionPathReferences(file, source) {
  const extensionPathPattern = /(['"`])((?:assets|src|_locales|output)\/[^'"`?#)>\s]+)(?:[?#][^'"`]*)?\1/g;
  let match = null;
  while ((match = extensionPathPattern.exec(source))) {
    if (!match[2].includes('${')) {
      checkManifestPath(match[2]);
    }
  }
}

function listJsFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsFiles(fullPath));
      return;
    }
    if (entry.isFile() && fullPath.endsWith('.js')) {
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

function checkRuntimeGetUrlReferences() {
  const files = listJsFiles(stagedPath('src'));
  const staticGetUrlPattern = /chrome\.runtime\.getURL\(\s*(['"`])([^'"`]+)\1\s*\)/g;
  files.forEach((file) => {
    const source = fs.readFileSync(file, 'utf8');
    const packageFile = packagePathForFile(file);
    checkConcreteExtensionPathReferences(packageFile, source);
    checkCssUrlReferences(packageFile, source);
    let match = null;
    while ((match = staticGetUrlPattern.exec(source))) {
      const value = match[2];
      if (!value || value.includes('${')) {
        continue;
      }
      checkManifestPath(value.split(/[?#]/)[0]);
    }
  });
}

function checkHtmlReferences() {
  const files = listHtmlFiles(stagedPath('src'));
  const referencePattern = /\b(?:src|href)=["']([^"']+)["']/g;
  files.forEach((file) => {
    const source = fs.readFileSync(file, 'utf8');
    const packageFile = packagePathForFile(file);
    checkCssUrlReferences(packageFile, source);
    let match = null;
    while ((match = referencePattern.exec(source))) {
      const value = match[1];
      if (!value || /^(https?:|data:|mailto:|tel:|#|__MSG_)/.test(value)) {
        continue;
      }
      const cleanValue = value.split(/[?#]/)[0];
      const resolved = path.normalize(path.join(path.dirname(packageFile), cleanValue));
      checkManifestPath(resolved);
    }
  });
}

function checkCssFiles() {
  const files = [
    ...listFilesWithExtension(stagedPath('src'), '.css'),
    ...listFilesWithExtension(stagedPath('assets'), '.css')
  ];
  files.forEach((file) => {
    checkCssUrlReferences(packagePathForFile(file), fs.readFileSync(file, 'utf8'));
  });
}

function checkNewtabWallpaperFiles() {
  const file = 'src/newtab/wallpaper.js';
  const fullPath = stagedPath(file);
  if (!fs.existsSync(fullPath)) {
    return;
  }
  const source = fs.readFileSync(fullPath, 'utf8');
  const directoryMatch = source.match(/NEWTAB_WALLPAPER_EXTENSION_DIRECTORY\s*=\s*['"]([^'"]+)['"]/);
  const suffixMatch = source.match(/NEWTAB_WALLPAPER_THUMBNAIL_SUFFIX\s*=\s*['"]([^'"]+)['"]/);
  const directory = directoryMatch ? directoryMatch[1] : '';
  const thumbnailSuffix = suffixMatch ? suffixMatch[1] : '';
  if (!directory) {
    return;
  }
  const filePattern = /\bfile:\s*['"]([^'"]+\.webp)['"]/g;
  let match = null;
  while ((match = filePattern.exec(source))) {
    const wallpaperFile = match[1];
    checkManifestPath(`${directory}/${wallpaperFile}`);
    if (thumbnailSuffix) {
      const thumbnailFile = wallpaperFile.replace(/\.[^.]+$/, thumbnailSuffix);
      checkManifestPath(`${directory}/${thumbnailFile}`);
    }
  }
}

checkManifestPath(storeManifest.background && storeManifest.background.service_worker);
checkManifestPath(storeManifest.chrome_url_overrides && storeManifest.chrome_url_overrides.newtab);
checkManifestPath(storeManifest.options_ui && storeManifest.options_ui.page);
Object.values(storeManifest.icons || {}).forEach(checkManifestPath);
(storeManifest.content_scripts || []).forEach((script) => {
  (script.js || []).forEach(checkManifestPath);
  (script.css || []).forEach(checkManifestPath);
});
(storeManifest.web_accessible_resources || []).forEach((entry) => {
  (entry.resources || []).forEach(checkManifestPath);
});
injectedScriptFiles.forEach(checkManifestPath);
checkRuntimeGetUrlReferences();
checkHtmlReferences();
checkCssFiles();
checkNewtabWallpaperFiles();
if (missing.length > 0) {
  console.error('Manifest resources missing from package:');
  missing.forEach((entry) => console.error(`- ${entry}`));
  process.exit(1);
}

cleanupPackageStage();
console.log(`Created ${zipPath}`);
console.log(`Entries: ${entries.length}`);
