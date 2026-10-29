// New Tab's preload, a classic script in <head> that runs before first paint:
// the scrollbar mode, the focus route, the storage and locale prefetch, the
// motion preference and the cached wallpaper.
import '../shared/scrollbar-mode';
import './newtab-focus-entry';
import './newtab-storage-prefetch';
import '../shared/motion-preload';
import './dom/wallpaper-preload';
