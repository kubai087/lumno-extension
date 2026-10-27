const assert = require('assert');
const fs = require('fs');
const path = require('path');

const script = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'onboarding', 'features', 'overlay-demo.ts'),
  'utf8'
);

assert.match(
  script,
  /const ONBOARDING_SEARCH_OVERLAY_COMMAND_ACTION = 'triggerOnboardingSearchOverlayFromCommand';/,
  'onboarding should share the background action name for command-triggered overlay open'
);

assert.match(
  script,
  /function handleOnboardingCommandMessage\([\s\S]*?ONBOARDING_SEARCH_OVERLAY_COMMAND_ACTION[\s\S]*?openDemoOverlay\(\)/,
  'onboarding should open the local overlay when background forwards the browser command shortcut'
);

assert.match(
  script,
  /runtime\.onMessage\.addListener\(handleOnboardingCommandMessage\)/,
  'onboarding should register the background command message listener'
);

console.log('onboarding command message tests passed');
