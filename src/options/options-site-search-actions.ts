// What the site search lists and the add form do: each asks the providers
// to change, then tells the outcome in a toast or in the form.
import type { GetMessage } from './options-types';
import { getSiteSearchErrorMessage } from './features/site-search/error-copy';
import type { EditOutcome, KeyConflictCheck, SiteSearchProviders } from './features/site-search/providers';
import type { SiteSearchProviderDraft, SiteSearchSaveResult } from './react/site-search-list';

interface SiteSearchActionsDeps {
  providers: SiteSearchProviders;
  getMessage: GetMessage;
  showToast(message: string, isError?: boolean): void;
  // Whether a trigger key is taken by a provider or an aggregate search.
  hasKeyConflict: KeyConflictCheck;
}

function createSiteSearchActions(deps: SiteSearchActionsDeps) {
  const { providers, getMessage, showToast, hasKeyConflict } = deps;
  const failureMessage = (): string => getMessage('toast_error', '操作失败，请重试。');
  const showError = (): void => showToast(failureMessage(), true);

  // A saved draft is told by a toast; a refused one by the form's error.
  // An edit that storage refused is told by a toast as well.
  function tellSave(outcome: EditOutcome, toastSaveFailure: boolean): SiteSearchSaveResult {
    if (outcome.ok) {
      showToast(getMessage('toast_saved', '已保存'), false);
      return { ok: true };
    }
    if (outcome.saveFailed) {
      if (toastSaveFailure) {
        showError();
      }
      return { ok: false, error: failureMessage() };
    }
    return { ok: false, error: getSiteSearchErrorMessage(getMessage, outcome.error) };
  }

  function addProvider(draft: SiteSearchProviderDraft): Promise<SiteSearchSaveResult> {
    return providers.add(draft, hasKeyConflict).then((outcome) => tellSave(outcome, false));
  }

  function saveProvider(key: string, isBuiltin: boolean, draft: SiteSearchProviderDraft): Promise<SiteSearchSaveResult> {
    return providers.edit(key, isBuiltin, draft, hasKeyConflict).then((outcome) => tellSave(outcome, true));
  }

  function removeProvider(key: string, isBuiltin: boolean): Promise<void> {
    return providers.remove(key, isBuiltin)
      .then(() => showToast(getMessage('toast_removed', '已移除'), false))
      .catch(showError);
  }

  function resetBuiltinProviders(): Promise<void> {
    return providers.resetBuiltins().catch(showError);
  }

  function clearCustomProviders(): Promise<void> {
    return providers.clearCustom()
      .then(() => showToast(getMessage('toast_cleared', '已清空'), false))
      .catch(showError);
  }

  return { addProvider, saveProvider, removeProvider, resetBuiltinProviders, clearCustomProviders };
}

export { createSiteSearchActions };
export type { SiteSearchActionsDeps };
