import type { RecentHistoryDialogController, RecentHistoryDialogOptions } from './recent-history-dialog';

// The history dialog opens only from a linked card's context menu; keep it off
// the initial New Tab route.
export async function createRecentHistoryDialog(options: RecentHistoryDialogOptions): Promise<RecentHistoryDialogController | null> {
  const dialog = await import('./recent-history-dialog');
  return dialog.createRecentHistoryDialog(options);
}
