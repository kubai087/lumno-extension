// Tells the wallpaper that what its adaptive tone samples has moved or
// changed (a section laid out, cards drawn, the theme switched), so it
// samples again on its next frame. Parts emit `stale`; the wallpaper page
// follows it.
import { createEventBus } from '../../shared/state/events';
import type { ToneScheduleOptions } from './wallpaper-adaptive-tone';

interface AdaptiveToneEvents {
  stale: ToneScheduleOptions;
}

const adaptiveToneEvents = createEventBus<AdaptiveToneEvents>();

export { adaptiveToneEvents };
