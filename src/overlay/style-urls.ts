// The stylesheets the panel's shadow root loads, as extension URLs.
import { getRuntimeUrl } from './runtime';

function getOverlayStyleUrls() {
  return {
    remixIconCssUrl: getRuntimeUrl(chrome, 'assets/remixicon/fonts/remixicon.css'),
    searchInputCssUrl: getRuntimeUrl(chrome, 'src/shared/search/search-input.css'),
    featureHintsCssUrl: getRuntimeUrl(chrome, 'src/shared/ui/feature-hints.css'),
    tooltipCssUrl: getRuntimeUrl(chrome, 'src/shared/ui/tooltip.css'),
    cursorTooltipCssUrl: getRuntimeUrl(chrome, 'src/shared/ui/cursor-tooltip.css'),
    toastCssUrl: getRuntimeUrl(chrome, 'src/shared/ui/toast.css'),
    externalLinkIconCssUrl: getRuntimeUrl(chrome, 'src/shared/ui/external-link-icon.css'),
    overlaySuggestionsCssUrl: getRuntimeUrl(chrome, 'src/overlay/suggestions-view.css')
  };
}

export { getOverlayStyleUrls };
