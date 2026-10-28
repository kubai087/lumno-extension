// New Tab recent sites: which list shows, how many, the pinned and hidden
// sites, and episode progress tracking.
import { defineSetting } from './define';
import { custom, flag, opaque } from './schema';

type RecentMode = 'latest' | 'most';

// Most visited unless the person picked the latest.
const recentMode = defineSetting({
  key: '_x_extension_recent_mode_2024_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: custom((value): RecentMode => (value === 'latest' ? 'latest' : 'most'))
});

// The cards come in rows of four, up to two rows; 0 hides them.
const recentCount = defineSetting({
  key: '_x_extension_recent_count_2024_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: custom((value) => {
    const parsed = Number.parseInt(String(value), 10);
    return parsed === 0 || parsed === 4 || parsed === 8 ? parsed : 4;
  })
});

// The site lists' format belongs to domain/recent-sites-store.ts.
const pinnedRecentSites = defineSetting({
  key: '_x_extension_newtab_pinned_recent_sites_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: opaque()
});

const hiddenRecentSites = defineSetting({
  key: '_x_extension_newtab_hidden_recent_sites_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: opaque()
});

// Pinning an episode or chapter tracks it unless the person turns this off.
const progressTrackingEnabled = defineSetting({
  key: '_x_extension_progress_tracking_enabled_2026_unique_',
  area: 'preferences',
  sync: 'browser',
  schema: flag(true)
});

// Where each tracked episode or chapter was left; the format belongs to
// domain/progress-history.ts.
const progressHistory = defineSetting({
  key: '_x_extension_newtab_progress_history_2026_unique_',
  area: 'device',
  schema: opaque()
});

export { hiddenRecentSites, pinnedRecentSites, progressHistory, progressTrackingEnabled, recentCount, recentMode };
export type { RecentMode };
