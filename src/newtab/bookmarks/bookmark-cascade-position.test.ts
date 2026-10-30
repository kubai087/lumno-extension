import { describe, expect, it } from 'vitest';
import {
  buildCascadeSafeTriangle,
  getTranslateNeutralRect,
  isPointInsideCascadeSafeTriangle,
  placeCascadeSubmenu,
  placeRootCascadeMenu
} from './bookmark-cascade-position';

const viewport = { width: 760, height: 520 };
const spacing = 8;

describe('root cascade menu placement', () => {
  it('stays where it was when the anchor folder lifts on hover', () => {
    const menuRect = { width: 210, height: 180 };
    const resting = placeRootCascadeMenu({
      anchorRect: { left: 32, right: 212, top: 42, bottom: 93, width: 180, height: 51 },
      menuRect, viewport, spacing
    });
    const hovered = placeRootCascadeMenu({
      anchorRect: getTranslateNeutralRect({ left: 32, right: 212, top: 39.5, bottom: 90.5, width: 180, height: 51 }, 'matrix(1, 0, 0, 1, 0, -2.5)'),
      menuRect, viewport, spacing
    });
    expect(hovered).toEqual(resting);
  });

  it('opens below and left-aligned when there is room', () => {
    expect(placeRootCascadeMenu({
      anchorRect: { left: 32, right: 212, top: 42, bottom: 92, width: 180, height: 50 },
      menuRect: { width: 210, height: 180 }, viewport, spacing
    })).toEqual({ left: 32, top: 100, horizontal: 'left', vertical: 'below' });
  });

  it('flips above and right-aligns when the bottom and right are tight', () => {
    expect(placeRootCascadeMenu({
      anchorRect: { left: 620, right: 740, top: 420, bottom: 470, width: 120, height: 50 },
      menuRect: { width: 210, height: 180 }, viewport, spacing
    })).toEqual({ left: 530, top: 232, horizontal: 'right', vertical: 'above' });
  });

  it('takes the side with more room when neither fits', () => {
    expect(placeRootCascadeMenu({
      anchorRect: { left: 280, right: 460, top: 300, bottom: 350, width: 180, height: 50 },
      menuRect: { width: 210, height: 300 }, viewport, spacing
    })).toEqual({ left: 280, top: 8, horizontal: 'left', vertical: 'above' });
  });

  it('stays below an occupied top surface', () => {
    expect(placeRootCascadeMenu({
      anchorRect: { left: 280, right: 460, top: 300, bottom: 350, width: 180, height: 50 },
      menuRect: { width: 210, height: 300 }, viewport, spacing, viewportTopPadding: 48
    }).top).toBe(48);
  });

  it('keeps a top bar folder menu a compact gap below the bar', () => {
    expect(placeRootCascadeMenu({
      anchorRect: { left: 194, right: 333, top: 4, bottom: 32, width: 139, height: 28 },
      menuRect: { width: 258, height: 246 }, viewport, spacing, viewportTopPadding: 40
    }).top).toBe(40);
  });
});

describe('cascade submenu placement', () => {
  it('flips left of its level and clamps vertically without moving earlier levels', () => {
    expect(placeCascadeSubmenu({
      parentLevelRect: { left: 550, right: 760, top: 180, bottom: 430, width: 210, height: 250 },
      triggerRect: { left: 558, right: 752, top: 360, bottom: 392, width: 194, height: 32 },
      menuRect: { width: 210, height: 170 }, viewport, spacing
    })).toEqual({ left: 332, top: 342, side: 'left' });
  });

  it('alternates back to the right when that side has room', () => {
    expect(placeCascadeSubmenu({
      parentLevelRect: { left: 332, right: 542, top: 342, bottom: 512, width: 210, height: 170 },
      triggerRect: { left: 340, right: 534, top: 456, bottom: 488, width: 194, height: 32 },
      menuRect: { width: 210, height: 170 }, viewport: { width: 780, height: 520 }, spacing
    })).toEqual({ left: 550, top: 342, side: 'right' });
  });

  it('keeps a negative spacing, so later levels overlap earlier ones slightly', () => {
    expect(placeCascadeSubmenu({
      parentLevelRect: { left: 44, right: 254, top: 180, bottom: 298, width: 210, height: 118 },
      triggerRect: { left: 52, right: 246, top: 220, bottom: 252, width: 194, height: 32 },
      menuRect: { width: 210, height: 82 }, viewport, spacing: -8
    })).toEqual({ left: 246, top: 220, side: 'right' });
  });

  it('clamps an oversized submenu inside the viewport on the roomier side', () => {
    const result = placeCascadeSubmenu({
      parentLevelRect: { left: 280, right: 490, top: 170, bottom: 420, width: 210, height: 250 },
      triggerRect: { left: 288, right: 482, top: 240, bottom: 272, width: 194, height: 32 },
      menuRect: { width: 620, height: 180 }, viewport, spacing
    });
    expect([result.left, result.side]).toEqual([8, 'left']);
  });

  it('clamps below an occupied top surface', () => {
    expect(placeCascadeSubmenu({
      parentLevelRect: { left: 40, right: 250, top: 48, bottom: 250, width: 210, height: 202 },
      triggerRect: { left: 48, right: 242, top: 20, bottom: 52, width: 194, height: 32 },
      menuRect: { width: 210, height: 120 }, viewport, spacing, viewportTopPadding: 48
    }).top).toBe(48);
  });
});

describe('cascade safe triangle', () => {
  it('reaches from the pointer to the near edge of a submenu opening right', () => {
    const triangle = buildCascadeSafeTriangle({
      pointer: { x: 100, y: 120 },
      submenuRect: { left: 220, right: 420, top: 80, bottom: 220 },
      side: 'right'
    });
    expect(triangle).toEqual([{ x: 100, y: 120 }, { x: 220, y: 80 }, { x: 220, y: 220 }]);
    expect(isPointInsideCascadeSafeTriangle({ x: 180, y: 128 }, triangle)).toBe(true);
    expect(isPointInsideCascadeSafeTriangle({ x: 180, y: 40 }, triangle)).toBe(false);
  });

  it('reaches from the pointer to the near edge of a submenu opening left', () => {
    const triangle = buildCascadeSafeTriangle({
      pointer: { x: 500, y: 220 },
      submenuRect: { left: 120, right: 320, top: 160, bottom: 360 },
      side: 'left'
    });
    expect(triangle).toEqual([{ x: 500, y: 220 }, { x: 320, y: 160 }, { x: 320, y: 360 }]);
    expect(isPointInsideCascadeSafeTriangle({ x: 410, y: 230 }, triangle)).toBe(true);
    expect(isPointInsideCascadeSafeTriangle({ x: 410, y: 120 }, triangle)).toBe(false);
  });
});
