// Whether a tab can get a split view beside it: the browser has split views
// (Chrome 155 and later) and the tab is not in one already.
interface SplitTabsApi {
  createSplit?: unknown;
}

interface SplitSourceTab {
  id?: number;
  splitViewId?: number;
}

// Whether the browser has split views at all.
function hasSplitViews(tabs: SplitTabsApi | null | undefined): boolean {
  return Boolean(tabs && typeof tabs.createSplit === 'function');
}

function canSplitBeside<T extends SplitSourceTab>(
  tabs: SplitTabsApi | null | undefined,
  sourceTab: T | null | undefined
): sourceTab is T & { id: number } {
  return Boolean(
    hasSplitViews(tabs) &&
    sourceTab &&
    typeof sourceTab.id === 'number' &&
    !(typeof sourceTab.splitViewId === 'number' && sourceTab.splitViewId >= 0)
  );
}

export { canSplitBeside, hasSplitViews };
