// The wallpaper's adaptive tone and the parts it colors. `stale`: what the
// tone samples moved or changed (a section laid out, cards drawn, the theme
// switched), so the wallpaper samples again on its next frame. `applied`:
// the tones are on their targets, or cleared, so marks drawn in an ink (the
// wordmark) draw again.
import { createEventBus } from '../../shared/state/events';
import type { ToneScheduleOptions } from './wallpaper-adaptive-tone';

interface AdaptiveToneEvents {
  stale: ToneScheduleOptions;
  applied: null;
}

const adaptiveToneEvents = createEventBus<AdaptiveToneEvents>();

export { adaptiveToneEvents };
