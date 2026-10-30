// The React root a test's views are drawn through, as a page's would be.
import { PortalHost } from '../../src/shared/react/portal-host';

let host: PortalHost | null = null;

export function getTestPortals(): PortalHost {
  if (!host) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    host = new PortalHost(container);
  }
  return host;
}
