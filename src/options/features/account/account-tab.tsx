// The Account tab: the browser sync card and the WebDAV card, once both
// have their first models.
import { useStore } from '../../../shared/react/use-store';
import { useOptionsPage } from '../../app/context';
import { AccountTab as AccountTabView } from '../../react/account-tab';

export function AccountTab() {
  const { account } = useOptionsPage();
  const { browserSync, webdav } = useStore(account.store);
  return browserSync && webdav
    ? <AccountTabView handlers={account.handlers} model={{ browserSync, webdav }} />
    : null;
}
