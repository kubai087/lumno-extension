// Where the page goes: the default search engine, opening addresses and
// cards in this or another tab, and the feedback control's links.
import * as NEWTAB_FEEDBACK_CONTROL_RUNTIME from '../feedback-control';
import * as NEWTAB_PAGE_NAVIGATION from '../page-navigation';
import { DefaultSearchEngine } from '../../shared/search-panel/default-engine';
import type { PageContext } from '../app/context';
import type { ShellFeature } from './shell';

interface NavigationFeatureDeps {
  shell: ShellFeature;
}

function createNavigationFeature(ctx: PageContext, deps: NavigationFeatureDeps) {
  const { locale, settings, t } = ctx;
  const { hideTopActionTooltip, showToast, showTopActionTooltip } = deps.shell;

  // The default search engine, which the page's search and navigation follow.
  const searchEngine = new DefaultSearchEngine(settings);
  searchEngine.follow();

  const {
    navigateToUrl,
    isMiddleClick,
    getOpenDisposition,
    openExternalNewTabUrl,
    openUrlFromNewtabCard,
    navigateToQuery
  } = NEWTAB_PAGE_NAVIGATION.createPageNavigation({
    settings,
    showToast,
    t,
    searchEngine
  });

  const {
    openCommunityQrDialog,
    getFeedbackLinks,
    getFeedbackControl,
    getFeedbackButton,
    getFeedbackWebLocale,
    openFeedbackExternalUrl,
    updateFeedbackLanguageStrings,
    isFeedbackPopoverOpen,
    closeFeedbackPopover,
    createFeedbackControls
  } = NEWTAB_FEEDBACK_CONTROL_RUNTIME.createFeedbackControlRuntime({
    locale,
    t,
    openExternalNewTabUrl,
    hideTopActionTooltip,
    showTopActionTooltip
  });

  return {
    closeFeedbackPopover,
    createFeedbackControls,
    getFeedbackButton,
    getFeedbackControl,
    getFeedbackLinks,
    getFeedbackWebLocale,
    getOpenDisposition,
    isFeedbackPopoverOpen,
    isMiddleClick,
    navigateToQuery,
    navigateToUrl,
    openCommunityQrDialog,
    openExternalNewTabUrl,
    openFeedbackExternalUrl,
    openUrlFromNewtabCard,
    searchEngine,
    updateFeedbackLanguageStrings
  };
}

type NavigationFeature = ReturnType<typeof createNavigationFeature>;

export { createNavigationFeature };
export type { NavigationFeature };
