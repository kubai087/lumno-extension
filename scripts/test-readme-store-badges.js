const assert = require('assert');
const fs = require('fs');
const path = require('path');

const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
const packageJson = require(path.join('..', 'package.json'));
const escapedVersion = String(packageJson.version || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const badgeAssets = [
  'chrome-web-store-large-bordered.png',
  'microsoft-edge-addons-badge.png'
];

const widths = badgeAssets.map((name) => {
  const match = readme.match(new RegExp(
    `<img[^>]+src="\\./assets/images/readme/${name}"[^>]+width="(\\d+)"`
  ));
  assert.ok(match, `missing store badge markup for ${name}`);
  return Number(match[1]);
});

assert.strictEqual(widths[0], widths[1], 'store badges must use the same width');

assert.ok(
  /chrome-web-store-large-bordered\.png[\s\S]*?<\/a><br \/>[\s\S]*?microsoft-edge-addons-badge\.png/.test(readme),
  'store badges must be stacked vertically with Chrome first'
);

assert.ok(
  new RegExp(
    `microsoft-edge-addons-badge\\.png[\\s\\S]*?<p align="center">Current version: <code>${escapedVersion}<\\/code>(?: \\(custom fork\\))?<\\/p>`
  ).test(readme),
  'the current version must be centered below the store badges'
);

console.log('README store badge layout test passed');
