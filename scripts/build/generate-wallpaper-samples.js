'use strict';

// Writes each built-in wallpaper's small copy (<name>-sample.avif next to it), which the New Tab's
// effects and adaptive tone sample instead of decoding the full image. Each copy is the image the
// sampler in wallpaper-effects.ts would build from the full file: drawn into a canvas of
// getSamplerSize() in Chrome the way the sampler draws it, then encoded by avifenc as AVIF with
// full-resolution colour (4:4:4) at quality 95. Lossy WebP keeps colour at half resolution, which
// wiped out the fine colour specks dither, halftone and ASCII pick up from painted wallpapers.
//
//   node scripts/build/generate-wallpaper-samples.js
//
// Run it after adding or changing a built-in wallpaper. It needs a local Chromium build
// (see scripts/dev/chrome-launcher.js) and avifenc (brew install libavif).

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { launchChrome } = require('../dev/chrome-launcher.js');
require('../node/register-typescript');

const repoRoot = path.resolve(__dirname, '..', '..');
const AVIFENC_ARGS = ['-q', '95', '-y', '444', '-s', '0'];

function readWallpaperFiles() {
  const source = fs.readFileSync(path.join(repoRoot, 'src/newtab/wallpaper/wallpaper-options.ts'), 'utf8');
  const directory = (source.match(/NEWTAB_WALLPAPER_EXTENSION_DIRECTORY\s*=\s*['"]([^'"]+)['"]/) || [])[1];
  const suffix = (source.match(/NEWTAB_WALLPAPER_SAMPLE_SUFFIX\s*=\s*['"]([^'"]+)['"]/) || [])[1];
  if (!directory || !suffix) {
    throw new Error('wallpaper-options.ts no longer names the wallpaper directory or sample suffix.');
  }
  const files = [];
  const filePattern = /\bfile:\s*['"]([^'"]+\.webp)['"]/g;
  let match = null;
  while ((match = filePattern.exec(source))) {
    files.push(match[1]);
  }
  return { directory: path.join(repoRoot, directory), suffix, files };
}

// CDP over --remote-debugging-pipe: fd 3 carries requests, fd 4 responses, each ending in a NUL.
function createPipeConnection(child) {
  const writer = child.stdio[3];
  const reader = child.stdio[4];
  const pending = new Map();
  let nextId = 1;
  let buffer = '';
  reader.on('data', (chunk) => {
    buffer += chunk.toString();
    let end;
    while ((end = buffer.indexOf('\0')) >= 0) {
      const message = JSON.parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
      if (message.id && pending.has(message.id)) {
        const { resolve, reject, method } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(`${method}: ${message.error.message}`));
        else resolve(message.result || {});
      }
    }
  });
  return {
    send(method, params = {}, sessionId) {
      const id = nextId++;
      writer.write(`${JSON.stringify({ id, method, params, sessionId })}\0`);
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject, method }));
    }
  };
}

// Runs in the page; the images come from the same local origin, so the canvas stays readable.
const RENDER_SAMPLE = `async (url, width, height) => {
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('Could not load ' + url));
    image.src = url;
  });
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  // Read-optimised like the sampler's canvas: Chrome then draws on the CPU, which filters a
  // downscale differently from the GPU.
  canvas.getContext('2d', { willReadFrequently: true }).drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/png').split(',')[1];
}`;

async function main() {
  try {
    execFileSync('avifenc', ['--version'], { stdio: 'ignore' });
  } catch (error) {
    throw new Error('avifenc was not found; install it with `brew install libavif`.', { cause: error });
  }
  const { getSamplerSize } = await import(path.join(repoRoot, 'src/domain/wallpaper-sampler-size.ts'));
  const { directory, suffix, files } = readWallpaperFiles();
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumno-wallpaper-samples-'));
  const server = http.createServer((request, response) => {
    const name = path.basename(decodeURIComponent(request.url.split('?')[0]));
    if (files.includes(name)) {
      response.setHeader('content-type', 'image/webp');
      response.end(fs.readFileSync(path.join(directory, name)));
      return;
    }
    response.setHeader('content-type', 'text/html');
    response.end('<!doctype html><title>Wallpaper samples</title>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = launchChrome({
    args: ['--headless=new', '--remote-debugging-pipe', '--no-first-run', '--no-default-browser-check'],
    profileName: 'wallpaper-samples',
    stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe']
  });
  const cdp = createPipeConnection(browser.child);
  try {
    const { targetId } = await cdp.send('Target.createTarget', { url: `${origin}/` });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Runtime.evaluate', {
      expression: 'new Promise((resolve) => document.readyState === "complete" ? resolve() : addEventListener("load", resolve))',
      awaitPromise: true
    }, sessionId);
    let totalBytes = 0;
    for (const file of files) {
      const dimensions = await cdp.send('Runtime.evaluate', {
        expression: `new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve([image.naturalWidth, image.naturalHeight]); image.onerror = reject; image.src = ${JSON.stringify(`${origin}/${file}`)}; })`,
        awaitPromise: true,
        returnByValue: true
      }, sessionId);
      const [naturalWidth, naturalHeight] = dimensions.result.value;
      const size = getSamplerSize(naturalWidth, naturalHeight);
      const result = await cdp.send('Runtime.evaluate', {
        expression: `(${RENDER_SAMPLE})(${JSON.stringify(`${origin}/${file}`)}, ${size.width}, ${size.height})`,
        awaitPromise: true,
        returnByValue: true
      }, sessionId);
      if (result.exceptionDetails) {
        throw new Error(`${file}: ${result.exceptionDetails.exception ? result.exceptionDetails.exception.description : result.exceptionDetails.text}`);
      }
      const pngPath = path.join(workDir, file.replace(/\.[^.]+$/, '.png'));
      fs.writeFileSync(pngPath, Buffer.from(result.result.value, 'base64'));
      const sampleFile = file.replace(/\.[^.]+$/, suffix);
      execFileSync('avifenc', [...AVIFENC_ARGS, pngPath, path.join(directory, sampleFile)], { stdio: 'ignore' });
      const bytes = fs.statSync(path.join(directory, sampleFile)).size;
      totalBytes += bytes;
      console.log(`${sampleFile}  ${size.width}x${size.height}  ${(bytes / 1024).toFixed(1)} KB`);
    }
    console.log(`Wrote ${files.length} samples, ${(totalBytes / 1024).toFixed(0)} KB in all.`);
  } finally {
    await browser.close();
    server.close();
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
