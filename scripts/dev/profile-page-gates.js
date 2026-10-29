'use strict';

// The page performance gates: New Tab ready (cold and warm), its first paint
// and script cost, overlay open latency (first and repeated), suggestion
// latency in the overlay and on New Tab, worker wake and Options ready.
// Each metric is the median of repeated runs, each run in a fresh headless
// Chrome with the given unpacked build. With --baseline, the same runs are
// made on that build and each metric is compared against it.
//
//   node scripts/dev/profile-page-gates.js --extension=dist/chrome --runs=7
//   node scripts/dev/profile-page-gates.js --extension=<head> --baseline=<base> --out=gates.json

const fs = require('fs');
const path = require('path');
require('../node/register-typescript');
const { launchBrowser, delay } = require('../../tests/e2e/browser');
const { startFixtureServer } = require('../../tests/e2e/fixtures');

const OVERLAY_HOST_ID = '_x_extension_overlay_host_2026_unique_';
const OVERLAY_INPUT = '#_x_extension_search_input_2024_unique_';
const NEWTAB_INPUT_ID = '_x_extension_newtab_search_input_2024_unique_';

// Recorded from the document's first script: when New Tab marked itself
// ready, the long tasks before it, and what the first frame painted.
const NEWTAB_PROBE = `(() => {
  const probe = { readyAt: 0, longTasks: [], firstFrame: null };
  window.__lumnoGateProbe = probe;
  try {
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => probe.longTasks.push({ start: entry.startTime, duration: entry.duration }));
    }).observe({ type: 'longtask', buffered: true });
  } catch (error) {}
  // What a frame paints behind the page: the root's background, or the
  // body's, which the root takes when it has none. The body itself stays
  // hidden until the wallpaper is ready.
  const readLook = () => {
    const rootColor = getComputedStyle(document.documentElement).backgroundColor;
    const bodyColor = document.body ? getComputedStyle(document.body).backgroundColor : '';
    const canvas = /^rgba\\(.*,\\s*0\\)$/.test(rootColor) || rootColor === 'transparent' ? bodyColor : rootColor;
    return { canvas, theme: document.body ? document.body.getAttribute('data-theme') || '' : '' };
  };
  const firstFrame = () => {
    if (document.body) {
      probe.firstFrame = readLook();
    } else {
      requestAnimationFrame(firstFrame);
    }
  };
  requestAnimationFrame(firstFrame);
  const isDarkColor = (color) => {
    const parts = String(color).match(/\\d+(\\.\\d+)?/g) || ['255', '255', '255'];
    const [r, g, b] = parts.map(Number);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
  };
  probe.isDarkColor = isDarkColor;
  const check = () => {
    if (!probe.readyAt && document.body && document.body.getAttribute('data-nt-ready') === '1') {
      probe.readyAt = performance.now();
      probe.readyLook = readLook();
    }
  };
  new MutationObserver(check).observe(document, { subtree: true, attributes: true, childList: true, attributeFilter: ['data-nt-ready'] });
})();`;

function parseArguments(argv) {
  const options = { runs: 7, extension: '', baseline: '', out: '', only: '' };
  argv.forEach((argument) => {
    const [key, value] = argument.replace(/^--/, '').split('=');
    if (key === 'runs') options.runs = Math.max(1, Number(value) || 1);
    else if (key === 'only') options.only = value;
    else if (key in options) options[key] = path.resolve(value);
  });
  if (!options.extension) {
    throw new Error('Pass --extension=<unpacked build>.');
  }
  return options;
}

async function waitUntil(check, { timeout = 15000, interval = 5, message = 'timed out' } = {}) {
  const started = Date.now();
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() - started > timeout) throw new Error(message);
    await delay(interval);
  }
}

// Tabs start on a fixture page, so the probe is in place before the page
// under test loads.
async function openProbedNewtab(browser, fixtures) {
  const page = await browser.openPage(fixtures.url('/page.html'));
  // New Tab marks itself ready from an animation frame, which only the active tab gets.
  await focusTab(browser, page);
  // A dark system, where a first frame painted before the theme shows as a
  // white flash; on a light one it would pass unseen.
  await browser.cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'dark' }]
  }, page.sessionId);
  await browser.cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: NEWTAB_PROBE }, page.sessionId);
  await browser.cdp.send('Page.navigate', { url: browser.extensionUrl('newtab.html') }, page.sessionId);
  const probe = await waitUntil(() => page.evaluate(`(() => {
    const probe = window.__lumnoGateProbe;
    if (!probe || !probe.readyAt) return null;
    const scripts = performance.getEntriesByType('resource')
      .filter((entry) => entry.initiatorType === 'script' && entry.startTime < probe.readyAt);
    const navigation = performance.getEntriesByType('navigation')[0];
    return {
      readyMs: probe.readyAt,
      longTaskMs: probe.longTasks.filter((task) => task.start < probe.readyAt).reduce((sum, task) => sum + task.duration, 0),
      // The first frame is dark exactly when the page gets ready dark.
      firstFrameMatches: Boolean(probe.firstFrame && probe.readyLook) &&
        probe.isDarkColor(probe.firstFrame.canvas) === (probe.readyLook.theme === 'dark'),
      domContentLoadedMs: navigation ? navigation.domContentLoadedEventEnd : 0,
      scriptUrls: scripts.map((entry) => entry.name).concat(Array.from(document.scripts).map((script) => script.src).filter(Boolean))
    };
  })()`), { message: 'New Tab did not mark itself ready' });
  return { page, probe };
}

// Bytes of the extension's scripts a page loaded, read from the build.
function scriptBytes(extensionPath, urls) {
  return Array.from(new Set(urls)).reduce((sum, url) => {
    const file = path.join(extensionPath, new URL(url).pathname);
    return sum + (fs.existsSync(file) ? fs.statSync(file).size : 0);
  }, 0);
}

async function measureNewtab(browser, fixtures, extensionPath) {
  const cold = await openProbedNewtab(browser, fixtures);
  await browser.closePage(cold.page);
  const warm = await openProbedNewtab(browser, fixtures);
  const { page } = warm;
  await page.waitFor(`Boolean(document.getElementById('${NEWTAB_INPUT_ID}'))`, { message: 'no New Tab search box' });
  await page.evaluate(`(() => {
    const input = document.getElementById('${NEWTAB_INPUT_ID}');
    input.focus();
    input.select();
  })()`);
  const typed = Date.now();
  await page.type('Lumno fixture');
  await waitUntil(() => page.evaluate(`document.querySelectorAll('.x-nt-suggestion-item').length > 0`),
    { message: 'New Tab listed no suggestion' });
  const suggestionMs = Date.now() - typed;
  await browser.closePage(page);
  return {
    newtabReadyColdMs: cold.probe.readyMs,
    newtabReadyWarmMs: warm.probe.readyMs,
    newtabScriptBytes: scriptBytes(extensionPath, warm.probe.scriptUrls),
    newtabLongTaskMs: warm.probe.longTaskMs,
    newtabFirstPaintCorrect: cold.probe.firstFrameMatches && warm.probe.firstFrameMatches ? 1 : 0,
    newtabSuggestionMs: suggestionMs
  };
}

async function focusTab(browser, page) {
  const href = await page.evaluate('location.href');
  await browser.worker.evaluate(`(async () => {
    const [tab] = await chrome.tabs.query({ url: ${JSON.stringify(href)} });
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  })()`);
}

async function openOverlay(browser, page) {
  const started = Date.now();
  await browser.worker.evaluate(`chrome.commands.onCommand.dispatch('show-search')`);
  await waitUntil(() => page.evaluate(`(() => {
    const host = document.getElementById('${OVERLAY_HOST_ID}');
    return Boolean(host && host.isConnected && !host.hasAttribute('data-lumno-overlay-mount-hidden'));
  })()`), { message: 'the overlay did not show' });
  return Date.now() - started;
}

async function closeOverlay(page) {
  await page.press('Escape');
  await page.waitFor(`!document.getElementById('${OVERLAY_HOST_ID}')`, { message: 'the overlay did not close' });
}

async function measureOverlay(browser, fixtures) {
  await browser.openPage(fixtures.url('/fixture.html'));
  const page = await browser.openPage(fixtures.url('/page.html'));
  await focusTab(browser, page);
  const firstOpenMs = await openOverlay(browser, page);
  await closeOverlay(page);
  await delay(300);
  const repeatOpenMs = await openOverlay(browser, page);
  await page.waitForShadow(OVERLAY_HOST_ID, OVERLAY_INPUT, function isFocused() {
    return this.getRootNode().activeElement === this;
  }, (results) => results.length === 1 && results[0] === true, { message: 'the overlay input was not focused' });
  const typed = Date.now();
  await page.type('Lumno fixture');
  await waitUntil(() => page.inShadow(OVERLAY_HOST_ID, '.x-ov-suggestion-item', function text() {
    return this.textContent;
  }).then((texts) => Array.isArray(texts) && texts.length > 0, () => false), { message: 'the overlay listed no suggestion' });
  const suggestionMs = Date.now() - typed;
  await closeOverlay(page);
  return { overlayOpenFirstMs: firstOpenMs, overlayOpenRepeatMs: repeatOpenMs, overlaySuggestionMs: suggestionMs };
}

async function measureOptions(browser, fixtures) {
  const page = await browser.openPage(fixtures.url('/page.html'));
  await focusTab(browser, page);
  const started = Date.now();
  await browser.cdp.send('Page.navigate', { url: browser.extensionUrl('src/options/options.html') }, page.sessionId);
  await waitUntil(() => page.evaluate(`document.documentElement.getAttribute('data-lumno-options-ready') === 'true'`)
    .catch(() => false), { message: 'Options did not mark itself ready' });
  return { optionsReadyMs: Date.now() - started };
}

// From asking the browser for the worker's state to its first answer to a
// page's message, after the worker was stopped.
async function measureWorkerWake(browser) {
  const page = await browser.openPage(browser.extensionUrl('newtab.html'));
  await focusTab(browser, page);
  await page.waitFor(`document.body && document.body.getAttribute('data-nt-ready') === '1'`, { timeout: 15000 });
  await browser.cdp.send('ServiceWorker.enable', {}, page.sessionId);
  await browser.cdp.send('ServiceWorker.stopAllWorkers', {}, page.sessionId);
  await delay(500);
  const ms = await page.evaluate(`(async () => {
    const started = performance.now();
    await new Promise((resolve) => chrome.runtime.sendMessage({ action: 'getShortcutRules' }, () => {
      void chrome.runtime.lastError;
      resolve();
    }));
    return performance.now() - started;
  })()`);
  return { workerWakeMs: ms };
}

async function runOnce(extensionPath, fixtures, only) {
  const results = {};
  const named = [
    ['newtab', (browser) => measureNewtab(browser, fixtures, extensionPath)],
    ['overlay', (browser) => measureOverlay(browser, fixtures)],
    ['options', (browser) => measureOptions(browser, fixtures)],
    ['worker', (browser) => measureWorkerWake(browser)]
  ];
  // --only=newtab,overlay limits the run to those pages.
  const steps = named.filter(([name]) => !only || only.split(',').includes(name)).map(([, step]) => step);
  for (const step of steps) {
    Object.assign(results, await runStep(extensionPath, step));
  }
  return results;
}

const STEP_TIMEOUT_MS = 60000;
const STEP_ATTEMPTS = 3;

// A step in a fresh browser, given up after a time limit, since a browser
// that dies mid-step leaves its pending calls unanswered; then tried anew.
async function runStep(extensionPath, step) {
  for (let attempt = 1; ; attempt += 1) {
    let timer = null;
    let browser = null;
    try {
      const expired = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`step timed out after ${STEP_TIMEOUT_MS} ms`)), STEP_TIMEOUT_MS);
      });
      return await Promise.race([
        (async () => {
          browser = await launchBrowser({ extensionPath });
          return step(browser);
        })(),
        expired
      ]);
    } catch (error) {
      if (attempt >= STEP_ATTEMPTS) throw error;
      process.stdout.write(`  retrying a step: ${error.message}\n`);
    } finally {
      clearTimeout(timer);
      if (browser) await Promise.race([browser.close().catch(() => {}), delay(5000)]);
    }
  }
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

// The spread of a metric's runs (median absolute deviation, scaled to a
// standard deviation), the noise a difference must exceed to count.
function noise(values) {
  const center = median(values);
  return 1.4826 * median(values.map((value) => Math.abs(value - center)));
}

function summarize(samples) {
  const summary = {};
  Object.entries(samples).forEach(([name, values]) => {
    summary[name] = { median: median(values), noise: noise(values), runs: values };
  });
  return summary;
}

// Measures the builds run by run in turn, so a machine slowing down or
// speeding up over the session weighs on each build alike.
async function measureBuilds(extensionPaths, runs, fixtures, only) {
  const samples = extensionPaths.map(() => ({}));
  for (let run = 0; run < runs; run += 1) {
    for (let index = 0; index < extensionPaths.length; index += 1) {
      const result = await runOnce(extensionPaths[index], fixtures, only);
      Object.entries(result).forEach(([name, value]) => {
        (samples[index][name] = samples[index][name] || []).push(value);
      });
    }
    process.stdout.write(`  run ${run + 1}/${runs} done\n`);
  }
  return samples.map(summarize);
}

// A metric passes when it is no worse than the baseline by more than the
// two builds' noise together, plus a small floor for timer resolution.
function compare(head, baseline) {
  return Object.keys(head).map((name) => {
    const now = head[name];
    const then = baseline[name];
    if (!then) return { name, head: now.median, pass: true };
    const higherIsBetter = name === 'newtabFirstPaintCorrect';
    const margin = Math.max(now.noise + then.noise, Math.abs(then.median) * 0.05, higherIsBetter ? 0 : 2);
    const worse = higherIsBetter ? then.median - now.median : now.median - then.median;
    return { name, baseline: then.median, head: now.median, margin, pass: worse <= margin };
  });
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const fixtures = await startFixtureServer();
  try {
    const builds = options.baseline ? [options.extension, options.baseline] : [options.extension];
    process.stdout.write(`Measuring ${builds.join(' and ')}\n`);
    const [head, baseline = null] = await measureBuilds(builds, options.runs, fixtures, options.only);
    const report = { runs: options.runs, head, baseline, gates: baseline ? compare(head, baseline) : null };
    if (options.out) {
      fs.writeFileSync(options.out, `${JSON.stringify(report, null, 2)}\n`);
    }
    const rows = report.gates || Object.entries(head).map(([name, value]) => ({ name, head: value.median }));
    rows.forEach((row) => {
      const parts = [row.name.padEnd(26), `head ${row.head.toFixed(1)}`];
      if (row.baseline !== undefined) parts.push(`baseline ${row.baseline.toFixed(1)}`, `margin ${row.margin.toFixed(1)}`, row.pass ? 'pass' : 'FAIL');
      process.stdout.write(`${parts.join('  ')}\n`);
    });
    if (report.gates && report.gates.some((gate) => !gate.pass)) {
      process.exitCode = 1;
    }
  } finally {
    await fixtures.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exit(1);
});
