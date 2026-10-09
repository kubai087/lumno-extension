// Uploads scripts/amo-screenshots/<position>.jpg as the add-on's AMO
// screenshots, skipping positions it already has, so a rerun only fills gaps.
// Usage: node scripts/amo-upload-screenshots.js <add-on guid>
const fs = require('fs');
const path = require('path');
const { createAmoJwt } = require('./amo-jwt');

const API = 'https://addons.mozilla.org/api/v5/addons/addon';
const SCREENSHOT_DIR = path.join(__dirname, 'amo-screenshots');
const MAX_ATTEMPTS = 6;

const addonId = process.argv[2];
if (!addonId) {
  console.error('Usage: node scripts/amo-upload-screenshots.js <add-on guid>');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// AMO rate-limits bursts of writes with HTTP 429; wait as long as it asks.
async function amoFetch(url, options = {}) {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `JWT ${createAmoJwt()}` }
    });
    if (response.status !== 429 || attempt === MAX_ATTEMPTS) {
      return response;
    }
    const waitSeconds = Number(response.headers.get('retry-after')) || 30 * attempt;
    console.log(`Rate limited by AMO; retrying in ${waitSeconds}s.`);
    await sleep(waitSeconds * 1000);
  }
}

async function main() {
  const detail = await amoFetch(`${API}/${encodeURIComponent(addonId)}/`);
  if (!detail.ok) {
    throw new Error(`AMO returned HTTP ${detail.status} for ${addonId}.`);
  }
  const existing = new Set(((await detail.json()).previews || []).map((preview) => preview.position));

  const screenshots = fs.readdirSync(SCREENSHOT_DIR)
    .filter((file) => file.endsWith('.jpg'))
    .map((file) => ({ file, position: Number.parseInt(file, 10) }))
    .sort((a, b) => a.position - b.position);

  for (const { file, position } of screenshots) {
    if (existing.has(position)) {
      console.log(`Skipping ${file}; AMO already has a screenshot at position ${position}.`);
      continue;
    }
    const form = new FormData();
    form.append('image', new Blob([fs.readFileSync(path.join(SCREENSHOT_DIR, file))], { type: 'image/jpeg' }), file);
    form.append('position', String(position));
    const response = await amoFetch(`${API}/${encodeURIComponent(addonId)}/previews/`, {
      method: 'POST',
      body: form
    });
    if (!response.ok) {
      throw new Error(`Uploading ${file} failed with HTTP ${response.status}: ${await response.text()}`);
    }
    console.log(`Uploaded ${file}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
