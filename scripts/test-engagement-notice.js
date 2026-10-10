const assert = require('assert');
const fs = require('fs');

const communityLinks = require('../src/shared/community-links.js');
const engagementNotice = require('../src/shared/engagement-notice.js');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

function flushMicrotasks() {
  return new Promise((resolve) => setImmediate(resolve));
}

function createEligibleState(surface, now) {
  const state = engagementNotice.normalizeEngagementState(null);
  state[surface] = {
    activeDays: ['2026-07-01', '2026-07-03', '2026-07-05', '2026-07-07'],
    firstSeenAt: now - 8 * engagementNotice.DAY_MS,
    meaningfulUses: surface === 'newtab' ? 5 : 0,
    opens: surface === 'newtab' ? 8 : 10
  };
  return state;
}

(async () => {
  const now = Date.UTC(2026, 6, 20, 8);
  const overlayState = createEligibleState('overlay', now);
  assert.strictEqual(
    engagementNotice.shouldShowEngagementNotice(overlayState, 'overlay', now),
    true,
    'an overlay-only user should become eligible after 10 opens across 4 days and one week'
  );
  overlayState.overlay.opens = 9;
  assert.strictEqual(
    engagementNotice.shouldShowEngagementNotice(overlayState, 'overlay', now),
    false,
    'overlay users should not see the prompt before the tenth intentional invocation'
  );

  const newtabState = createEligibleState('newtab', now);
  newtabState.newtab.meaningfulUses = 4;
  assert.strictEqual(
    engagementNotice.shouldShowEngagementNotice(newtabState, 'newtab', now),
    false,
    'newtab visits alone should not qualify without meaningful search input'
  );
  newtabState.newtab.meaningfulUses = 5;
  assert.strictEqual(
    engagementNotice.shouldShowEngagementNotice(newtabState, 'newtab', now),
    true,
    'newtab users should qualify only after repeated meaningful search use'
  );
  newtabState.exposureCount = 1;
  newtabState.lastShownAt = now - 13 * engagementNotice.DAY_MS;
  assert.strictEqual(
    engagementNotice.shouldShowEngagementNotice(newtabState, 'newtab', now),
    false,
    'an ignored prompt should cool down for two weeks'
  );
  newtabState.lastShownAt = now - 15 * engagementNotice.DAY_MS;
  assert.strictEqual(
    engagementNotice.shouldShowEngagementNotice(newtabState, 'newtab', now),
    true,
    'one quiet retry should be allowed after the cooldown'
  );
  newtabState.exposureCount = engagementNotice.MAX_EXPOSURES;
  assert.strictEqual(
    engagementNotice.shouldShowEngagementNotice(newtabState, 'newtab', now),
    false,
    'the prompt should never expose more than twice'
  );

  assert.strictEqual(
    engagementNotice.getCommunityUrl('zh_CN'),
    engagementNotice.WECHAT_QR_URL,
    'Simplified Chinese users should be guided to the WeChat QR code'
  );
  assert.strictEqual(
    engagementNotice.getCommunityUrl('zh_TW'),
    engagementNotice.WECHAT_QR_URL,
    'Traditional Chinese users should also be guided to the WeChat QR code'
  );
  assert.strictEqual(
    engagementNotice.getCommunityChannel('zh_TW'),
    'wechat',
    'Traditional Chinese engagement actions should use the WeChat treatment'
  );
  assert.strictEqual(
    engagementNotice.getCommunityUrl('en'),
    engagementNotice.X_URL,
    'non-Chinese users should be guided to the author on X'
  );
  assert.strictEqual(
    engagementNotice.WECHAT_QR_URL,
    communityLinks.FALLBACK_LINKS.wechatQr,
    'the engagement fallback should come from the shared community links runtime'
  );

  const localStore = {
    [engagementNotice.ENGAGEMENT_NOTICE_STORAGE_KEY]: createEligibleState(
      'overlay',
      now
    )
  };
  const chromeApi = {
    runtime: { lastError: null },
    storage: {
      local: {
        get(keys, callback) {
          const result = {};
          keys.forEach((key) => {
            result[key] = localStore[key];
          });
          callback(result);
        },
        set(values, callback) {
          Object.assign(localStore, values);
          if (callback) {
            callback();
          }
        }
      }
    }
  };
  let featureHintOptions = null;
  let reviewClicks = 0;
  const elementAttributes = {};
  const element = {
    setAttribute(name, value) {
      elementAttributes[name] = String(value);
    }
  };
  const featureHints = {
    createFeatureHint(options) {
      featureHintOptions = options;
      let dismissed = false;
      return {
        destroy() {},
        dismiss() {
          if (dismissed) {
            return;
          }
          dismissed = true;
          options.onDismiss();
        },
        element,
        isDismissed() {
          return dismissed;
        },
        setVisible(visible) {
          elementAttributes['data-visible'] = visible ? 'true' : 'false';
        },
        updateLanguage() {}
      };
    }
  };
  const fakeWindow = {
    clearTimeout() {},
    setTimeout(callback) {
      callback();
      return 1;
    }
  };
  assert.strictEqual(
    engagementNotice.ENGAGEMENT_NOTICE_ENABLED,
    true,
    'the engagement mechanism should be enabled behind its eligibility lifecycle'
  );
  const controller = engagementNotice.createEngagementNotice({
    chromeApi,
    delayMs: 0,
    documentObj: { defaultView: fakeWindow },
    featureHints,
    locale: 'zh_TW',
    now: () => now,
    onReview() {
      reviewClicks += 1;
    },
    surface: 'overlay'
  });
  assert(controller, 'engagement notice controller should be created');
  await flushMicrotasks();
  await flushMicrotasks();
  assert.strictEqual(
    elementAttributes['data-visible'],
    'true',
    'an eligible idle overlay invocation should reveal the prompt'
  );
  assert.strictEqual(
    featureHintOptions.actions.length,
    2,
    'the reused hint component should expose rating and community actions'
  );
  assert.strictEqual(
    featureHintOptions.definition.inlineActions,
    true,
    'the engagement prompt should render its actions inside one sentence'
  );
  assert(
    featureHintOptions.badgeIconImageSrc.endsWith('/assets/images/lumno.png') &&
      featureHintOptions.badgeWordmarkImageSrc.endsWith(
        '/assets/images/lumno-wordmark-mask.svg'
      ),
    'the engagement prompt should reuse the Lumno icon and solid wordmark mask'
  );
  assert.deepStrictEqual(
    featureHintOptions.actions.map((action) => action.icon),
    ['ri-external-link-line', 'ri-wechat-fill'],
    'the Traditional Chinese engagement action should identify WeChat'
  );
  assert.strictEqual(
    featureHintOptions.actions[0].labelFallback,
    'leave 5 stars',
    'the review action should use the updated rating language'
  );
  featureHintOptions.actions[0].onClick({});
  await flushMicrotasks();
  assert.strictEqual(reviewClicks, 1, 'the rating action should reach the surface');
  assert(
    localStore[engagementNotice.ENGAGEMENT_NOTICE_STORAGE_KEY].completedAt > 0,
    'acting on the prompt should permanently complete the local lifecycle'
  );

  const deferredStore = {
    [engagementNotice.ENGAGEMENT_NOTICE_STORAGE_KEY]: createEligibleState('overlay', now)
  };
  const deferredChromeApi = {
    runtime: { lastError: null },
    storage: {
      local: {
        get(keys, callback) {
          const result = {};
          keys.forEach((key) => {
            result[key] = deferredStore[key];
          });
          callback(result);
        },
        set(values, callback) {
          Object.assign(deferredStore, values);
          if (callback) {
            callback();
          }
        }
      }
    }
  };
  let resolveUpdateDecision = null;
  const updateDecision = new Promise((resolve) => {
    resolveUpdateDecision = resolve;
  });
  let updateClaimsSessionSlot = false;
  const deferredElementAttributes = {};
  const deferredFeatureHints = {
    createFeatureHint() {
      return {
        destroy() {},
        dismiss() {},
        element: {
          setAttribute(name, value) {
            deferredElementAttributes[name] = String(value);
          }
        },
        setVisible(visible) {
          deferredElementAttributes['data-visible'] = visible ? 'true' : 'false';
        },
        updateLanguage() {}
      };
    }
  };
  const deferredController = engagementNotice.createEngagementNotice({
    chromeApi: deferredChromeApi,
    delayMs: 0,
    documentObj: { defaultView: fakeWindow },
    exposureGate: updateDecision,
    featureHints: deferredFeatureHints,
    now: () => now,
    canShow() {
      return !updateClaimsSessionSlot;
    },
    surface: 'overlay'
  });
  assert(deferredController, 'a gated engagement controller should be created');
  await flushMicrotasks();
  assert.notStrictEqual(
    deferredElementAttributes['data-visible'],
    'true',
    'the rating prompt should wait for the update notice decision before exposing'
  );
  updateClaimsSessionSlot = true;
  resolveUpdateDecision(true);
  await flushMicrotasks();
  await flushMicrotasks();
  assert.notStrictEqual(
    deferredElementAttributes['data-visible'],
    'true',
    'an update-owned session should keep the rating prompt hidden after the gate resolves'
  );
  assert.strictEqual(
    deferredStore[engagementNotice.ENGAGEMENT_NOTICE_STORAGE_KEY].exposureCount,
    0,
    'deferring for an update should not consume a rating exposure'
  );
  deferredController.destroy();

  const resumedController = engagementNotice.createEngagementNotice({
    chromeApi: deferredChromeApi,
    delayMs: 0,
    documentObj: { defaultView: fakeWindow },
    exposureGate: Promise.resolve(false),
    featureHints: deferredFeatureHints,
    now: () => now + 1,
    canShow() {
      return true;
    },
    surface: 'overlay'
  });
  assert(resumedController, 'the deferred rating prompt should remain eligible next session');
  await flushMicrotasks();
  await flushMicrotasks();
  assert.strictEqual(
    deferredElementAttributes['data-visible'],
    'true',
    'the next session should expose a rating prompt that an update previously deferred'
  );
  assert.strictEqual(
    deferredStore[engagementNotice.ENGAGEMENT_NOTICE_STORAGE_KEY].exposureCount,
    1,
    'only the actually visible rating prompt should count as an exposure'
  );
  resumedController.destroy();

  const newtabSource = readNewtabRuntimeSource();
  const overlaySource = fs.readFileSync('src/overlay/search-panel.js', 'utf8');
  const newtabReactEntrySource = fs.readFileSync(
    'react-src/newtab/react-islands-entry.ts',
    'utf8'
  );
  const overlayReactEntrySource = fs.readFileSync(
    'react-src/overlay/react-islands-entry.ts',
    'utf8'
  );
  assert(
    newtabSource.includes('engagementNoticeController.recordMeaningfulUse()'),
    'newtab input should suppress the prompt and count meaningful use'
  );
  assert(
    newtabSource.includes('function createNewtabEngagementNoticeController()') &&
      newtabSource.includes('initialLanguageReadyPromise,') &&
      newtabSource.includes('updateNoticeController && updateNoticeController.ready') &&
      newtabSource.includes('engagementNoticeController = createNewtabEngagementNoticeController();'),
    'newtab should not create the prompt until language and update arbitration are ready'
  );
  assert(
    newtabSource.includes('loadLocaleMessages(targetLocale).then(applyResolvedMessages);') &&
      !newtabSource.includes('_x_extension_language_messages_2024_unique_'),
    'newtab should load packaged locale messages without a synced cache payload'
  );
  assert(
    overlaySource.includes('overlayEngagementNoticeController.recordMeaningfulUse()'),
    'overlay input should suppress the prompt for the active invocation'
  );
  assert(
      overlaySource.includes('ENGAGEMENT_NOTICE.loadCommunityUrl({') &&
      overlaySource.includes("locale: overlayLanguageMode === 'system'") &&
      overlaySource.includes("const disposition = getOpenDisposition(event, 'newTab');") &&
      /chrome\.runtime\.sendMessage\(\{\s*action: 'createTab',\s*url,\s*disposition\s*\}\);/.test(
        overlaySource
      ) &&
      newtabSource.includes('ENGAGEMENT_NOTICE.loadCommunityUrl({') &&
      newtabSource.includes('locale: getFeedbackWebLocale()') &&
      newtabSource.includes('openFeedbackExternalUrl(url, disposition);'),
    'both surfaces should preserve click disposition while resolving the shared community URL'
  );
  assert(
    newtabReactEntrySource.includes(
      "import { createFeatureHintViewApi } from '../shared/feature-hint-view';"
    ) &&
      overlayReactEntrySource.includes(
        "import { createFeatureHintViewApi } from '../shared/feature-hint-view';"
      ),
    'newtab and overlay should render engagement hints through the same shared React component'
  );
  assert(
    !newtabSource.includes('previewMode') &&
      !overlaySource.includes('previewMode') &&
      !fs.readFileSync('src/shared/engagement-notice.js', 'utf8').includes('previewMode'),
    'engagement runtime should not ship the temporary visual-review bypass'
  );
  assert(
    newtabSource.includes('exposureGate: updateNoticeController && updateNoticeController.ready') &&
      newtabSource.includes('!updateNoticeClaimsSessionSlot()') &&
      overlaySource.includes('exposureGate: overlayUpdateNoticeController && overlayUpdateNoticeController.ready') &&
      overlaySource.includes('!overlayUpdateNoticeClaimsSessionSlot()'),
    'both surfaces should wait for update arbitration and keep the update slot sticky for the session'
  );
  const zhCnMessages = JSON.parse(
    fs.readFileSync('_locales/zh_CN/messages.json', 'utf8')
  );
  const enMessages = JSON.parse(
    fs.readFileSync('_locales/en/messages.json', 'utf8')
  );
  const jaMessages = JSON.parse(
    fs.readFileSync('_locales/ja/messages.json', 'utf8')
  );
  const zhTwMessages = JSON.parse(
    fs.readFileSync('_locales/zh_TW/messages.json', 'utf8')
  );
  assert.strictEqual(
    zhCnMessages.engagement_notice_text.message,
    '如果用得开心，诚邀',
    'the Chinese prompt should stay concise enough for the compact layout'
  );
  assert.strictEqual(
    zhCnMessages.engagement_notice_review.message,
    '满分好评',
    'the Chinese rating action should ask for a full-score review'
  );
  assert.deepStrictEqual(
    [
      enMessages.engagement_notice_text.message,
      enMessages.engagement_notice_review.message,
      enMessages.engagement_notice_connector.message,
      enMessages.engagement_notice_community.message,
      enMessages.engagement_notice_trailing.message
    ],
    ['Like Lumno? Why not', 'leave 5 stars', 'or', 'find us on X', 'and say hi.'],
    'English engagement copy should name X directly'
  );
  assert.deepStrictEqual(
    [
      jaMessages.engagement_notice_text.message,
      jaMessages.engagement_notice_review.message,
      jaMessages.engagement_notice_connector.message,
      jaMessages.engagement_notice_community.message,
      jaMessages.engagement_notice_trailing.message
    ],
    ['気に入ったら、', '★5で評価', 'するか、', 'X で声をかけて', 'みませんか。'],
    'Japanese engagement copy should name X directly'
  );
  assert.deepStrictEqual(
    [
      zhTwMessages.engagement_notice_text.message,
      zhTwMessages.engagement_notice_review.message,
      zhTwMessages.engagement_notice_connector.message,
      zhTwMessages.engagement_notice_community.message,
      zhTwMessages.engagement_notice_trailing.message
    ],
    ['如果用得開心，歡迎', '留下五星好評', '，或是', '加入微信群組', '和我們聊聊。'],
    'Traditional Chinese engagement copy should name the WeChat group directly'
  );
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  assert(
    manifest.web_accessible_resources.some((entry) =>
      entry.resources.includes('assets/images/lumno-wordmark-mask.svg')
    ),
    'the injected overlay should be able to load the Lumno wordmark mask'
  );

  console.log('engagement notice tests passed');
})();
