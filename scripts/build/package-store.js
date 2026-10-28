const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { BUILD_DIRECTORY } = require('./entries');
const { EXTENSION_ROOTS, copyExtensionFiles } = require('./extension-output');
const { chromeManifest, writeManifest } = require('./manifests');

const storeManifest = chromeManifest({ store: true });
const version = storeManifest.version;
const repoRoot = process.cwd();
const distDir = path.join(process.cwd(), 'dist');
const zipPath = path.join(distDir, `lumno-store-v${version}.zip`);
const packageRoots = EXTENSION_ROOTS;
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

// The package holds what the development build has, with the entries built
// again without source maps.
copyExtensionFiles(packageStageDir);
writeManifest(packageStageDir, storeManifest);
const entryBuild = spawnSync(process.execPath, [
  path.join(__dirname, 'build.js'), '--store', '--outdir', stagedPath(BUILD_DIRECTORY)
], { cwd: repoRoot, stdio: 'inherit' });
if (entryBuild.status !== 0) {
  process.exit(entryBuild.status || 1);
}
function listBuiltScripts(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      return listBuiltScripts(path.join(directory, entry.name), relative);
    }
    return entry.name.endsWith('.js') ? [relative] : [];
  });
}
const stagedBundles = listBuiltScripts(stagedPath(BUILD_DIRECTORY));

function getHtmlBaseHref(source) {
  const baseMatch = source.match(/<base\s+[^>]*href=["']([^"']+)["']/i);
  return baseMatch ? baseMatch[1] : '';
}

// Directory that a page's relative src/href values resolve against.
function getHtmlReferenceBase(packageFile, source) {
  const baseHref = getHtmlBaseHref(source);
  return baseHref
    ? path.normalize(path.join(path.dirname(packageFile), baseHref))
    : path.dirname(packageFile);
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
stagedHtmlFiles.push(stagedPath('newtab.html'));

let zipResult = null;
const zipArgs = ['-r', '-D', zipPath, ...packageRoots, BUILD_DIRECTORY, 'manifest.json'];
const psQuote = (value) => `'${String(value).replace(/'/g, "''")}'`;
const powershell = (command, options = {}) => spawnSync('powershell.exe', [
  '-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
  "$ErrorActionPreference = 'Stop'; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem; " + command
], options);
// Windows has no zip or zipinfo; .NET's ZipFile writes the same file entries.
// The long path keeps entry names right when the temp folder is an 8.3 name.
zipResult = process.platform === 'win32'
  ? powershell(`$stage = ${psQuote(fs.realpathSync.native(packageStageDir))}; $archive = [System.IO.Compression.ZipFile]::Open(${psQuote(zipPath)}, [System.IO.Compression.ZipArchiveMode]::Create); try { Get-ChildItem -LiteralPath $stage -Recurse -File | ForEach-Object { $name = $_.FullName.Substring($stage.Length + 1).Replace('\\', '/'); [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $name, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null } } finally { $archive.Dispose() }`, { stdio: 'inherit' })
  : spawnSync('zip', zipArgs, {
  cwd: packageStageDir,
  stdio: 'inherit'
});
if (zipResult.status !== 0) {
  process.exit(zipResult.status || 1);
}

const listResult = process.platform === 'win32'
  ? powershell(`$archive = [System.IO.Compression.ZipFile]::OpenRead(${psQuote(zipPath)}); try { $archive.Entries | ForEach-Object { $_.FullName } } finally { $archive.Dispose() }`, { encoding: 'utf8' })
  : spawnSync('zipinfo', ['-1', zipPath], {
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
  value = normalizePackagePath(value);
  if (/^(https?:|chrome:|__MSG_)/.test(value)) {
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
  checkManifestPath(normalizePackagePath(resolved));
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

function checkRuntimeGetUrlReferences() {
  const files = listJsFiles(stagedPath('src')).concat(listJsFiles(stagedPath(BUILD_DIRECTORY)));
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
  const files = stagedHtmlFiles;
  const referencePattern = /\b(?:src|href)=["']([^"']+)["']/g;
  files.forEach((file) => {
    const source = fs.readFileSync(file, 'utf8');
    const packageFile = packagePathForFile(file);
    const baseHref = getHtmlBaseHref(source);
    const referenceBase = getHtmlReferenceBase(packageFile, source);
    const referenceFile = path.join(referenceBase, path.basename(packageFile));
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

// The built-in wallpapers the runtime lists, read from its source: the
// package carries the module only inside the new tab bundle.
function checkNewtabWallpaperFiles() {
  const source = fs.readFileSync(path.join(repoRoot, 'src/newtab/wallpaper/wallpaper-options.ts'), 'utf8');
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
    checkManifestPath(`${directory}/${wallpaperFile}`);
    suffixes.forEach((suffix) => {
      checkManifestPath(`${directory}/${wallpaperFile.replace(/\.[^.]+$/, suffix)}`);
    });
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
  (entry.resources || []).forEach((resource) => {
    // Pages could probe a web-accessible _favicon endpoint for visited sites.
    if (/^\/?_favicon(?:\/|$)/.test(String(resource || ''))) {
      throw new Error(`_favicon must not be web accessible in the store package: ${resource}`);
    }
    checkManifestPath(resource);
  });
});
stagedBundles.forEach((file) => checkManifestPath(`${BUILD_DIRECTORY}/${file}`));
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
console.log(`Bundles: ${stagedBundles.length}`);
