const assert = require('assert');
const fs = require('fs');
const settings = require('../src/shared/settings.js');

const optionsHtml = fs.readFileSync('src/options/options.html', 'utf8');
const optionsSource = fs.readFileSync('src/options/options.js', 'utf8');
const newtabHtml = fs.readFileSync('src/newtab/newtab.html', 'utf8');
const newtabSource = fs.readFileSync('src/newtab/newtab.js', 'utf8');
const onboardingHtml = fs.readFileSync('src/onboarding/onboarding.html', 'utf8');
const motionPreloadSource = fs.readFileSync('src/shared/motion-preload.js', 'utf8');
const overlayRuntimeSource = fs.readFileSync('src/overlay/runtime.js', 'utf8');
const overlaySource = fs.readFileSync('src/overlay/search-panel.js', 'utf8');
const tabSwitcherSource = fs.readFileSync('src/overlay/tab-switcher.js', 'utf8');
const backgroundSource = fs.readFileSync('src/background/background.js', 'utf8');
const selectionActionsSource = fs.readFileSync('src/content/selection-quick-actions.js', 'utf8');

const appearanceStart = optionsHtml.indexOf('data-content="appearance"');
const labsStart = optionsHtml.indexOf('data-content="labs"', appearanceStart);
const appearanceContent = optionsHtml.slice(appearanceStart, labsStart);
const themeIndex = appearanceContent.indexOf('id="_x_extension_theme_mode_row_2026_unique_"');
const motionIndex = appearanceContent.indexOf('data-i18n="settings_motion_effects_title"');
const newtabSectionIndex = appearanceContent.indexOf('data-i18n="settings_newtab_section_title"');

assert(themeIndex >= 0, 'appearance should keep the global theme setting');
assert(
  motionIndex > themeIndex && motionIndex < newtabSectionIndex,
  'motion effects should appear in Appearance between theme and New Tab settings'
);
assert.match(
  appearanceContent,
  /data-i18n="settings_motion_effects_desc">如遇卡顿，或倾向于更利落的唤起方式，可关闭</,
  'the simplified Chinese fallback should use the requested guidance'
);
assert.match(
  appearanceContent,
  /id="_x_extension_motion_effects_toggle_2026_unique_" type="checkbox" checked/,
  'motion effects should default to enabled in markup'
);

assert.strictEqual(
  settings.MOTION_EFFECTS_ENABLED_STORAGE_KEY,
  '_x_extension_motion_effects_enabled_2026_unique_'
);
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes(settings.MOTION_EFFECTS_ENABLED_STORAGE_KEY));
assert.match(
  optionsSource,
  /const MOTION_EFFECTS_ENABLED_STORAGE_KEY = SETTINGS\.MOTION_EFFECTS_ENABLED_STORAGE_KEY[\s\S]*?_x_extension_motion_effects_enabled_2026_unique_/,
  'options should use the shared synchronized motion key'
);
assert.match(
  optionsSource,
  /MOTION_EFFECTS_ENABLED_STORAGE_KEY,[\s\S]*AUTO_PIP_ENABLED_STORAGE_KEY,/,
  'motion effects should be part of options export and import sync payloads'
);
assert.match(
  optionsSource,
  /motionEffectsToggle\.addEventListener\('change'[\s\S]*?storageArea\.set\(\{ \[MOTION_EFFECTS_ENABLED_STORAGE_KEY\]: next \}\)/,
  'motion effects changes should persist immediately'
);
assert.match(
  optionsSource,
  /storageArea\.get\(\[MOTION_EFFECTS_ENABLED_STORAGE_KEY\][\s\S]*?setOptionsToggleState\(motionEffectsToggle, stored\)/,
  'options should restore the synchronized motion setting'
);

assert(
  newtabHtml.includes('../shared/motion-preload.js'),
  'New Tab should preload the synchronized entry-motion preference before it is revealed'
);
[optionsHtml, onboardingHtml].forEach((source) => {
  assert(
    !source.includes('../shared/motion-preload.js'),
    'Options and Onboarding should not apply the New Tab entry-motion preference'
  );
});
assert.strictEqual(
  fs.existsSync('src/shared/motion-preference.css'),
  false,
  'the user setting should not install a global animation/transition override stylesheet'
);
assert.match(
  motionPreloadSource,
  /_x_extension_motion_effects_enabled_2026_unique_[\s\S]*LumnoMotionPreferenceReady[\s\S]*data-lumno-motion-effects[\s\S]*resolveInitialPreference\(enabled\)[\s\S]*storage\.onChanged\.addListener/,
  'the New Tab preload should resolve the saved entry preference and react to synchronized changes'
);

assert.match(
  newtabSource,
  /function shouldSkipNewtabEntryMotion\(\)[\s\S]*data-lumno-motion-effects'\) !== 'off'[\s\S]*SETTINGS\.shouldSkipEntryMotion\(window, motionEffectsEnabled\)/,
  'New Tab should combine the synchronized setting with the OS preference only for entry motion'
);
assert.strictEqual(
  (newtabSource.match(/shouldSkipNewtabEntryMotion\(\)/g) || []).length,
  5,
  'the user preference should be read only by the four New Tab entry decisions and its helper'
);
assert.match(
  newtabSource,
  /function shouldAnimateNewtabLayoutShift\(\)[\s\S]*!prefersSystemReducedMotion\(\)/,
  'post-load New Tab layout animation should continue to follow only the OS preference'
);
assert.match(
  newtabSource,
  /function applyNewtabTopContentVisibility\([\s\S]*!prefersSystemReducedMotion\(\)/,
  'post-load New Tab top-content transitions should remain enabled when only the user setting is off'
);
assert.match(
  newtabSource,
  /function restartWordmarkEntryAnimation\(\)[\s\S]*if \(prefersSystemReducedMotion\(\)\)/,
  'later New Tab wordmark changes should continue to follow only the OS preference'
);
assert.match(
  newtabSource,
  /function revealNewtabWithoutEntryMotion\(\)[\s\S]*setAttribute\('data-nt-enter', 'done'\)[\s\S]*root\.setAttribute\('data-lumno-search-entry', 'done'\)[\s\S]*finishWordmarkEntryAnimation\(\);[\s\S]*setAttribute\('data-nt-ready', '1'\)/,
  'motion-free New Tabs should install every final entry state before revealing the page'
);
assert.match(
  newtabSource,
  /function scheduleNewtabReadyAfterViewportSettle\(\)[\s\S]*if \(shouldSkipNewtabEntryMotion\(\)\) \{\s*revealNewtabWithoutEntryMotion\(\);\s*return;\s*\}[\s\S]*window\.setTimeout\([\s\S]*requestAnimationFrame/,
  'motion-free New Tabs should bypass the animated viewport delay and paint-frame gate'
);
assert.match(
  newtabSource,
  /initialMotionPreferenceReadyTask[\s\S]*initialVisualReadyPromise = Promise\.all\([\s\S]*initialMotionPreferenceReadyTask[\s\S]*initialNewtabSkipsEntryMotion = shouldSkipNewtabEntryMotion\(\);[\s\S]*if \(!initialNewtabSkipsEntryMotion\)[\s\S]*Promise\.all\(\[\s*initialLanguageReadyTask,\s*sectionPolicyReadyPromise,\s*initialShortcutsReadyTask\s*\]\)[\s\S]*const recentSitesReadyTask = loadRecentSites\(\);\s*const bookmarksReadyTask = loadBookmarks\(\);[\s\S]*return Promise\.all\(\[recentSitesReadyTask, bookmarksReadyTask\]\);[\s\S]*markNewtabReady\(\)/,
  'motion-free New Tabs should wait for text and visible sections before one atomic reveal'
);

assert.match(
  overlayRuntimeSource,
  /motionEffectsEnabled: '_x_extension_motion_effects_enabled_2026_unique_'/,
  'Overlay runtime should expose the synchronized entry-motion key'
);
assert.match(
  overlaySource,
  /function shouldSkipOverlayEntryMotion\(\)[\s\S]*SETTINGS\.shouldSkipEntryMotion\(window, motionEffectsEnabled\)/,
  'Overlay should combine the OS and synchronized preferences in its entry-only helper'
);
assert.strictEqual(
  (overlaySource.match(/shouldSkipOverlayEntryMotion\(\)/g) || []).length,
  2,
  'the Overlay user preference should be consulted only by its reveal path and helper'
);
assert.match(
  overlaySource,
  /const reduceMotion = revealOptions\.forceInstant === true \|\|[\s\S]*?shouldSkipOverlayEntryMotion\(\);[\s\S]*?if \(reduceMotion\) \{[\s\S]*?finishOverlayPanelEnterAnimation\(overlay\);[\s\S]*?\} else \{[\s\S]*?overlayFrameTracker\.runEnterAnimation/,
  'turning motion effects off or detecting a slow first frame should skip only the Overlay entrance path'
);
assert.match(
  overlaySource,
  /function shouldAnimateOverlayUpdateNoticeMount\([\s\S]*return !window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/,
  'Overlay notice motion should continue to follow only the OS preference'
);
assert.doesNotMatch(
  overlaySource,
  /function animateSuggestionsHeight\(/,
  'Overlay result height should update directly instead of participating in motion preferences'
);

[
  ['background', backgroundSource],
  ['Alt+Q tab switcher', tabSwitcherSource],
  ['selection quick actions', selectionActionsSource]
].forEach(([surface, source]) => {
  assert(
    !source.includes('_x_extension_motion_effects_enabled_2026_unique_'),
    `${surface} should not read the New Tab/Overlay entry-motion setting`
  );
  assert(
    !source.includes('data-motion-effects'),
    `${surface} should retain its own ordinary motion behavior`
  );
});

const expectedCopy = {
  en: ['Motion effects', 'Turn this off if performance stutters or you prefer a snappier opening experience'],
  ja: ['アニメーション効果', '動作が重い場合や、より素早く表示したい場合はオフにできます'],
  zh_CN: ['动态效果', '如遇卡顿，或倾向于更利落的唤起方式，可关闭'],
  zh_TW: ['動態效果', '若遇到卡頓，或偏好更俐落的喚起方式，可關閉']
};
Object.entries(expectedCopy).forEach(([locale, [title, description]]) => {
  const messages = JSON.parse(fs.readFileSync(`_locales/${locale}/messages.json`, 'utf8'));
  assert.strictEqual(messages.settings_motion_effects_title.message, title);
  assert.strictEqual(messages.settings_motion_effects_desc.message, description);
});

console.log('motion effects setting tests passed');
