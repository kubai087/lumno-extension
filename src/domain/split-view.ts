// Whether a tab can get a split view beside it: the browser has split views
// (Chrome 155 and later) and the tab is not in one already.
interface SplitTabsApi {
  createSplit?: unknown;
}

interface SplitSourceTab {
  id?: number;
  splitViewId?: number;
}

function canSplitBeside<T extends SplitSourceTab>(
  tabs: SplitTabsApi | null | undefined,
  sourceTab: T | null | undefined
): sourceTab is T & { id: number } {
  return Boolean(
    tabs &&
    typeof tabs.createSplit === 'function' &&
    sourceTab &&
    typeof sourceTab.id === 'number' &&
    !(typeof sourceTab.splitViewId === 'number' && sourceTab.splitViewId >= 0)
  );
}

export { canSplitBeside };
