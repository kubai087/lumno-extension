// The site themes a surface resolved, by theme URL and by host, kept for the
// page's later lookups (the overlay keeps them across openings), and the
// event telling the views that show a site its theme changed after they drew.
import { createEventBus } from '../state/events';
import type { ThemeVariant } from './favicon-theme';

interface SiteThemeEvents {
  changed: { host: string; theme: ThemeVariant };
}

const themeColorCache = new Map<string, ThemeVariant>();
const themeHostCache = new Map<string, ThemeVariant>();
const siteThemeEvents = createEventBus<SiteThemeEvents>();

export { siteThemeEvents, themeColorCache, themeHostCache };
