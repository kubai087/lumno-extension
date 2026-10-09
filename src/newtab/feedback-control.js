(function(root) {
  // The feedback button and popover: community links, QR code refresh and
  // the React-rendered control.
  function createFeedbackControlRuntime(deps) {
    const {
      COMMUNITY_LINKS,
      LUMNO_FEEDBACK_LINKS_FALLBACK,
      getSystemLocale,
      normalizeLocale,
      t,
      openExternalNewTabUrl,
      hideTopActionTooltip,
      NEWTAB_FEEDBACK_CONTROL,
      showTopActionTooltip
    } = deps;

    // Page state still owned by newtab.js; read and written through accessors.
    const pageState = deps.pageState;

    const LUMNO_FEEDBACK_QR_REFRESH_TIMEOUT_MS = 5000;
    let feedbackRefreshResultTooltipTimer = 0;
    let feedbackLinksLoaded = false;

    function normalizeFeedbackHttpsUrl(value) {
      return COMMUNITY_LINKS.normalizeHttpsUrl(value);
    }

    function loadFeedbackLinks(options) {
      const force = Boolean(options && options.force);
      if (!force && feedbackLinksLoaded) {
        return Promise.resolve(pageState.feedbackLinks);
      }
      return COMMUNITY_LINKS.load({ force })
        .then((links) => {
          pageState.feedbackLinks = links || LUMNO_FEEDBACK_LINKS_FALLBACK;
          feedbackLinksLoaded = true;
          return pageState.feedbackLinks;
        });
    }

    function getFeedbackWebLocale() {
      const locale = pageState.currentResolvedLocale ||
        (pageState.currentLanguageMode === 'system' ? getSystemLocale() : normalizeLocale(pageState.currentLanguageMode));
      if (locale === 'zh_CN') {
        return 'zh-CN';
      }
      if (locale === 'zh_TW') {
        return 'zh-TW';
      }
      if (locale === 'ja') {
        return 'ja';
      }
      return 'en';
    }

    function getFeedbackCommunityChannel(links) {
      return COMMUNITY_LINKS.getCommunityChannel(links, getFeedbackWebLocale());
    }

    function clearFeedbackRefreshResultTooltipTimer() {
      if (!feedbackRefreshResultTooltipTimer) {
        return;
      }
      window.clearTimeout(feedbackRefreshResultTooltipTimer);
      feedbackRefreshResultTooltipTimer = 0;
    }

    function buildFreshFeedbackQrUrl(value) {
      return COMMUNITY_LINKS.buildFreshQrUrl(value);
    }

    function preloadFeedbackQrImage(url) {
      return new Promise((resolve) => {
        if (!url) {
          resolve(false);
          return;
        }
        const preloader = new Image();
        let settled = false;
        const finish = (loaded) => {
          if (settled) {
            return;
          }
          settled = true;
          window.clearTimeout(timeoutId);
          preloader.onload = null;
          preloader.onerror = null;
          resolve(loaded);
        };
        const timeoutId = window.setTimeout(() => {
          finish(false);
        }, LUMNO_FEEDBACK_QR_REFRESH_TIMEOUT_MS);
        preloader.onload = () => {
          finish(true);
        };
        preloader.onerror = () => {
          finish(false);
        };
        preloader.src = url;
      });
    }

    function buildFeedbackReactModel() {
      const links = pageState.feedbackLinks || LUMNO_FEEDBACK_LINKS_FALLBACK;
      const channel = getFeedbackCommunityChannel(links);
      return {
        buttonLabel: t('newtab_feedback_button_aria', 'Send feedback'),
        channel,
        chromeReviewLabel: t('newtab_feedback_chrome_review_label', 'Store rating'),
        chromeReviewTooltip: t(
          'newtab_feedback_chrome_review_tooltip',
          'Rate Lumno in the extension store'
        ),
        chromeReviewUrl: COMMUNITY_LINKS.getReviewUrl(links),
        closeTooltip: t('newtab_feedback_wechat_close_tooltip', 'Close'),
        communityLabel: channel === 'wechat'
          ? t('newtab_feedback_wechat_label', 'WeChat')
          : t('newtab_feedback_discord_label', 'Discord'),
        communityTooltip: channel === 'wechat'
          ? t('newtab_feedback_wechat_tooltip', 'Join the WeChat group')
          : t('newtab_feedback_discord_tooltip', 'Join Discord'),
        discordUrl: links.discord || LUMNO_FEEDBACK_LINKS_FALLBACK.discord,
        githubIssueLabel: t('newtab_feedback_github_issue_label', 'GitHub Issue'),
        githubIssueTooltip: t(
          'newtab_feedback_github_issue_tooltip',
          'Open a GitHub issue'
        ),
        githubIssueUrl: links.githubIssue || LUMNO_FEEDBACK_LINKS_FALLBACK.githubIssue,
        menuAriaLabel: t('newtab_feedback_menu_aria', 'Feedback channels'),
        panelTitle: channel === 'wechat'
          ? t('newtab_feedback_wechat_panel_title', 'Bug reports & feature requests')
          : t('newtab_feedback_discord_label', 'Discord'),
        qrAlt: t('newtab_feedback_wechat_qr_alt', 'Lumno WeChat group QR code'),
        qrUrl: links.wechatQr || LUMNO_FEEDBACK_LINKS_FALLBACK.wechatQr,
        refreshTooltip: t('newtab_feedback_wechat_refresh_tooltip', 'Refresh QR code'),
        xLabel: t('newtab_feedback_x_label', 'X'),
        xTooltip: t('newtab_feedback_x_tooltip', 'Contact us on X'),
        xUrl: links.x || LUMNO_FEEDBACK_LINKS_FALLBACK.x
      };
    }

    function syncFeedbackReactElementReferences() {
      if (!pageState.feedbackControl) {
        return;
      }
      pageState.feedbackButton = pageState.feedbackControl.querySelector('.x-nt-feedback-button');
    }

    function renderFeedbackControlWithReact() {
      if (!pageState.feedbackReactController ||
          typeof pageState.feedbackReactController.render !== 'function') {
        return false;
      }
      pageState.feedbackReactController.render(buildFeedbackReactModel());
      syncFeedbackReactElementReferences();
      return true;
    }

    function updateFeedbackContactUi() {
      renderFeedbackControlWithReact();
    }

    function openFeedbackExternalUrl(url, disposition) {
      const safeUrl = normalizeFeedbackHttpsUrl(url);
      if (!safeUrl) {
        return false;
      }
      return openExternalNewTabUrl(safeUrl, disposition || 'newTab');
    }

    function updateFeedbackLanguageStrings() {
      renderFeedbackControlWithReact();
    }

    function isFeedbackPopoverOpen() {
      return pageState.feedbackReactController.isOpen();
    }

    function closeFeedbackPopover(options) {
      setFeedbackPopoverOpen(false, options);
    }

    function setFeedbackPopoverOpen(open, options) {
      if (!open) {
        clearFeedbackRefreshResultTooltipTimer();
        hideTopActionTooltip();
      }
      if (open) {
        pageState.feedbackReactController.setOpen(true);
      } else {
        pageState.feedbackReactController.close(options);
      }
    }

    function createFeedbackControls() {
      pageState.feedbackControl = document.createElement('div');
      pageState.feedbackReactController =
        NEWTAB_FEEDBACK_CONTROL.createFeedbackControlController(
          pageState.feedbackControl,
          {
            onHideTooltip() {
              clearFeedbackRefreshResultTooltipTimer();
              hideTopActionTooltip();
            },
            onOpen() {
              return loadFeedbackLinks({ force: true }).then(() => {
                renderFeedbackControlWithReact();
              });
            },
            onOpenExternal(url, disposition) {
              openFeedbackExternalUrl(url, disposition);
            },
            async onRefreshQr() {
              try {
                const links = await loadFeedbackLinks({ force: true });
                pageState.feedbackLinks = links || pageState.feedbackLinks;
                const channel = getFeedbackCommunityChannel(pageState.feedbackLinks);
                if (channel !== 'wechat') {
                  renderFeedbackControlWithReact();
                  return {};
                }
                const refreshedUrl = buildFreshFeedbackQrUrl(
                  pageState.feedbackLinks.wechatQr ||
                    LUMNO_FEEDBACK_LINKS_FALLBACK.wechatQr
                );
                const loaded = await preloadFeedbackQrImage(refreshedUrl);
                return loaded
                  ? {
                      message: t(
                        'newtab_feedback_wechat_refresh_success',
                        'Latest QR code loaded'
                      ),
                      qrUrl: refreshedUrl
                    }
                  : {
                      message: t(
                        'newtab_feedback_wechat_refresh_error',
                        'Could not refresh. Try again.'
                      )
                    };
              } catch (error) {
                return {
                  message: t(
                    'newtab_feedback_wechat_refresh_error',
                    'Could not refresh. Try again.'
                  )
                };
              }
            },
            onShowTooltip(target, label) {
              showTopActionTooltip(target, label, {
                checkActive: false,
                placement: 'top'
              });
            }
          }
        );
      renderFeedbackControlWithReact();
    }

    return {
      getFeedbackWebLocale,
      openFeedbackExternalUrl,
      updateFeedbackLanguageStrings,
      isFeedbackPopoverOpen,
      closeFeedbackPopover,
      createFeedbackControls
    };
  }

  root.LumnoNewtabFeedbackControlRuntime = { createFeedbackControlRuntime };
})(globalThis);
