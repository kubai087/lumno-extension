import { describe, expect, it } from 'vitest';
import * as icons from './selection-action-icons';
import { ACTIONS } from './selection-intent';

describe('selection action icons', () => {
  it('come from Remix only', () => {
    expect(Object.keys(icons)).toEqual(['remix']);
  });

  it('draw every toolbar action as one path on a 24 px grid', () => {
    ACTIONS.forEach((action) => {
      expect(icons.remix[action].viewBox).toBe('0 0 24 24');
      expect(icons.remix[action].path).not.toBe('');
    });
  });
});
