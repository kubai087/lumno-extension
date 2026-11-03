// Uploads the store package to Microsoft Edge Add-ons and submits it for
// review through the v1.1 API, with the Client ID and API key from Partner
// Center's Publish API page. A version the store already serves is skipped,
// and so is a package identical to the last submission, so a rerun is harmless.
// Usage: node scripts/release/edge-addons-publish.js <package.zip> <version> [certification notes]
const fs = require('fs');

const API = 'https://api.addons.microsoftedge.microsoft.com/v1/products';
const REQUIRED_ENV = ['EDGE_CLIENT_ID', 'EDGE_API_KEY', 'EDGE_PRODUCT_ID', 'EDGE_EXTENSION_ID'];
const POLL_SECONDS = 5;
const MAX_POLLS = 60;

const [packagePath, version, notes = ''] = process.argv.slice(2);
if (!packagePath || !version) {
  console.error('Usage: node scripts/release/edge-addons-publish.js <package.zip> <version> [certification notes]');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The add-on page's public data, which only shows the version in the store.
async function liveVersion() {
  const response = await fetch(
    `https://microsoftedge.microsoft.com/addons/getproductdetailsbycrxid/${process.env.EDGE_EXTENSION_ID}?hl=en-US&gl=US`,
    { headers: { Accept: 'application/json' } }
  );
  return response.ok ? (await response.json()).version : '';
}

async function startOperation(url, options, action) {
  const response = await fetch(url, { ...options, method: 'POST' });
  if (response.status !== 202) {
    throw new Error(`${action} failed with HTTP ${response.status}: ${await response.text()}`);
  }
  // The Location header carries the operation ID.
  return (response.headers.get('location') || '').split('/').pop();
}

async function waitForOperation(url, headers, action) {
  for (let poll = 1; poll <= MAX_POLLS; poll += 1) {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Checking ${action} failed with HTTP ${response.status}: ${await response.text()}`);
    }
    const operation = await response.json();
    if (operation.status !== 'InProgress') {
      return operation;
    }
    await sleep(POLL_SECONDS * 1000);
  }
  throw new Error(`${action} was still in progress after ${MAX_POLLS * POLL_SECONDS}s.`);
}

function describe(operation) {
  const errors = (operation.errors || []).map((error) => error.message || error);
  return [operation.errorCode, operation.message, ...errors].filter(Boolean).join(': ');
}

async function main() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Set ${missing.join(', ')}.`);
  }
  if (await liveVersion() === version) {
    console.log(`Edge Add-ons already serves ${version}; nothing to submit.`);
    return;
  }
  const product = `${API}/${process.env.EDGE_PRODUCT_ID}`;
  const headers = {
    Authorization: `ApiKey ${process.env.EDGE_API_KEY}`,
    'X-ClientID': process.env.EDGE_CLIENT_ID
  };

  const uploadId = await startOperation(`${product}/submissions/draft/package`, {
    headers: { ...headers, 'Content-Type': 'application/zip' },
    body: fs.readFileSync(packagePath)
  }, 'Uploading the package');
  const upload = await waitForOperation(`${product}/submissions/draft/package/operations/${uploadId}`, headers, 'the upload');
  if (upload.status !== 'Succeeded') {
    throw new Error(`The upload failed: ${describe(upload)}`);
  }
  console.log(`Uploaded ${packagePath}.`);

  const publishId = await startOperation(`${product}/submissions`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes })
  }, 'Submitting for review');
  const publish = await waitForOperation(`${product}/submissions/operations/${publishId}`, headers, 'the submission');
  if (publish.status === 'Succeeded') {
    console.log(`Submitted ${version} for review.`);
    return;
  }
  if (publish.errorCode === 'NoModulesUpdated') {
    console.log(`This package matches the last submission; ${version} is already submitted.`);
    return;
  }
  if (publish.errorCode === 'InProgressSubmission') {
    throw new Error('Another version is still in review. Wait for it to finish, or cancel it in Partner Center, then run this again.');
  }
  throw new Error(`The submission failed: ${describe(publish)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
