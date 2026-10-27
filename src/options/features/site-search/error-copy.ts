// The text for a site search or aggregate search key that cannot be saved,
// from the locale message key the checks name.
import type { GetMessage } from '../../options-types';

function getSiteSearchErrorMessage(getMessage: GetMessage, errorKey: string): string {
  switch (errorKey) {
    case 'shortcuts_error_key':
      return getMessage('shortcuts_error_key', '请填写触发词。');
    case 'shortcuts_error_key_space':
      return getMessage('shortcuts_error_key_space', '触发词不能包含空格。');
    case 'shortcuts_error_key_duplicate':
      return getMessage('shortcuts_error_key_duplicate', '该触发词已存在，请更换。');
    case 'toast_error_template':
      return getMessage('toast_error_template', '搜索模板必须包含 {query}。');
    default:
      return getMessage('toast_error', '操作失败，请重试。');
  }
}

export { getSiteSearchErrorMessage };
