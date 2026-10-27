// The tabs row stays pinned at the top; once it has stuck there it draws
// its stuck look. Measured on scroll and resize, once a frame.
function updateStuck(tabsRow: HTMLElement, win: Window): void {
  const stickyTop = parseFloat(win.getComputedStyle(tabsRow).top || '0') || 0;
  const isStuck = tabsRow.getBoundingClientRect().top <= stickyTop + 0.5;
  tabsRow.setAttribute('data-stuck', isStuck ? 'true' : 'false');
}

// Returns the function that stops following.
function followStickyTabs(tabsRow: HTMLElement, win: Window): () => void {
  let frame = 0;
  const schedule = (): void => {
    if (frame) {
      return;
    }
    frame = win.requestAnimationFrame(() => {
      frame = 0;
      updateStuck(tabsRow, win);
    });
  };
  updateStuck(tabsRow, win);
  win.addEventListener('scroll', schedule, { passive: true });
  win.addEventListener('resize', schedule, { passive: true });
  return () => {
    win.cancelAnimationFrame(frame);
    win.removeEventListener('scroll', schedule);
    win.removeEventListener('resize', schedule);
  };
}

// Where menus that flip upward stop: below the pinned tabs row.
function getTabsRowInset(host: ParentNode): number {
  const tabsRow = host.querySelector('._x_extension_settings_tabs_row_2024_unique_');
  return tabsRow ? Math.max(0, tabsRow.getBoundingClientRect().bottom + 8) : 8;
}

export { followStickyTabs, getTabsRowInset };
