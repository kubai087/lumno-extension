// The "sync now" button's floating tooltip names the last sync, so it is
// shown again while the pointer or focus is on the button and that changes.
const SYNC_NOW_BUTTON_ID = '_x_extension_sync_now_2024_unique_';

function refreshSyncNowTooltip(doc: Document, showTooltipFor: (target: HTMLElement) => void): void {
  const button = doc.getElementById(SYNC_NOW_BUTTON_ID);
  if (button instanceof HTMLButtonElement && (button.matches(':hover') || button.matches(':focus'))) {
    showTooltipFor(button);
  }
}

export { refreshSyncNowTooltip };
