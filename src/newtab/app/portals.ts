// The New Tab's one React root. Every view on the page is drawn through it,
// made with the first view.
import { PortalHost } from '../../shared/react/portal-host';
import { createAppRootContainer } from '../dom/app-root';

let pagePortals: PortalHost | null = null;

function getPagePortals(): PortalHost {
  if (!pagePortals) {
    pagePortals = new PortalHost(createAppRootContainer(document));
  }
  return pagePortals;
}

export { getPagePortals };
