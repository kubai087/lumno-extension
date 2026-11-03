// Uploads the store package to the Chrome Web Store and submits it for review
// through the v2 API, signed in with the OAuth refresh token. A version the
// store already has (say, submitted by hand before its GitHub release) is
// skipped, so a rerun is harmless.
// Usage: node scripts/release/chrome-web-store-publish.js <package.zip> <version>
const fs = require('fs');

const API = 'https://chromewebstore.googleapis.com';
const REQUIRED_ENV = [
  'CWS_CLIENT_ID',
  'CWS_CLIENT_SECRET',
  'CWS_REFRESH_TOKEN',
  'CWS_PUBLISHER_ID',
  'CWS_EXTENSION_ID'
];
const POLL_SECONDS = 10;
const MAX_POLLS = 30;
// The upload response and fetchStatus spell the in-progress state differently.
const IN_PROGRESS_STATES = new Set(['IN_PROGRESS', 'UPLOAD_IN_PROGRESS']);

const [packagePath, version] = process.argv.slice(2);
if (!packagePath || !version) {
  console.error('Usage: node scripts/release/chrome-web-store-publish.js <package.zip> <version>');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson(response, action) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${action} failed with HTTP ${response.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

async function fetchAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: process.env.CWS_CLIENT_ID,
      client_secret: process.env.CWS_CLIENT_SECRET,
      refresh_token: process.env.CWS_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });
  const body = await readJson(response, 'Refreshing the access token');
  return body.access_token;
}

// Versions the store has published or holds in review.
function storeVersions(status) {
  return [status.publishedItemRevisionStatus, status.submittedItemRevisionStatus]
    .flatMap((revision) => (revision && revision.distributionChannels) || [])
    .map((channel) => channel.crxVersion);
}

async function main() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Set ${missing.join(', ')}.`);
  }
  const item = `publishers/${process.env.CWS_PUBLISHER_ID}/items/${process.env.CWS_EXTENSION_ID}`;
  const headers = { Authorization: `Bearer ${await fetchAccessToken()}` };
  const fetchStatus = async () => readJson(
    await fetch(`${API}/v2/${item}:fetchStatus`, { headers }),
    'Fetching the item status'
  );

  const status = await fetchStatus();
  if (storeVersions(status).includes(version)) {
    console.log(`The Chrome Web Store already has ${version}; nothing to submit.`);
    return;
  }

  const upload = await readJson(await fetch(`${API}/upload/v2/${item}:upload`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/zip' },
    body: fs.readFileSync(packagePath)
  }), 'Uploading the package');
  let uploadState = upload.uploadState;
  for (let poll = 1; IN_PROGRESS_STATES.has(uploadState); poll += 1) {
    if (poll > MAX_POLLS) {
      throw new Error(`The upload was still processing after ${MAX_POLLS * POLL_SECONDS}s.`);
    }
    await sleep(POLL_SECONDS * 1000);
    uploadState = (await fetchStatus()).lastAsyncUploadState;
  }
  if (uploadState !== 'SUCCEEDED') {
    throw new Error(`The upload ended in state ${uploadState}: ${JSON.stringify(upload)}`);
  }
  console.log(`Uploaded ${packagePath}.`);

  const published = await readJson(await fetch(`${API}/v2/${item}:publish`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: '{}'
  }), 'Submitting for review');
  for (const warning of (published.warningInfo && published.warningInfo.warnings) || []) {
    console.log(`Warning: ${warning.reason}: ${warning.description}`);
  }
  console.log(`Submitted ${version}; the item is now ${published.state}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
