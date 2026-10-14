import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createBookmarkCascadeViewApi,
  createCascadeLevel,
  createCascadeMenu,
  type CascadeLevelView
} from './bookmark-cascade-view';

let level: CascadeLevelView | null = null;

afterEach(() => {
  if (level) {
    act(() => level?.destroy());
  }
  level = null;
  document.body.innerHTML = '';
});

describe('New Tab React bookmark cascade view', () => {
  it('renders folder and leaf item contracts for the behavior adapter', () => {
    act(() => {
      level = createCascadeLevel({
        copyLabel: 'Copy link',
        documentObj: document,
        folderId: '1',
        folderTitle: 'Design',
        getFigmaFolderSvg: () => '<svg data-folder="true"></svg>',
        getRiSvg: (icon: string) => `<i data-icon="${icon}"></i>`,
        items: [
          { id: '2', index: 0, parentId: '1', title: 'Assets', type: 'folder' },
          {
            id: '3',
            index: 1,
            parentId: '1',
            title: 'Lumno',
            type: 'bookmark',
            url: 'https://lumno.example/'
          }
        ],
        levelIndex: 0
      });
    });
    if (!level) {
      throw new Error('Expected cascade level');
    }

    expect(createBookmarkCascadeViewApi().implementation).toBe('react');
    expect(level.element.dataset.reactIsland).toBe(
      'newtab-bookmark-cascade-level'
    );
    expect(level.items).toHaveLength(2);
    expect(level.items[0].button.dataset.bookmarkDropFolderId).toBe('2');
    expect(level.items[0].icon?.querySelector('svg')).not.toBeNull();
    expect(level.items[1].copyButton?.dataset.tooltip).toBe('Copy link');
    expect(level.items[0].pinButton).toBeNull();
    expect(level.items[1].pinButton?.querySelector('[data-icon="ri-pushpin-line"]')).not.toBeNull();
    expect(level.items[1].pinButton?.getAttribute('aria-label')).toContain('Lumno');
  });

  it('marks the menu surface as React-owned', () => {
    const menu = createCascadeMenu(document);
    expect(menu.dataset.reactIsland).toBe('newtab-bookmark-cascade');
    expect(menu.getAttribute('role')).toBe('menu');
  });
});
