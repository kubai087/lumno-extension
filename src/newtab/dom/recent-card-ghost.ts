// A recent card's drag ghost: it lifts off the card as the card's own copy,
// shrinks into the site's icon on the pointer, and returns to the card or
// lands where the site is dropped.
import { isHtmlElement, isHtmlTag } from '../../shared/dom-guards';
import { queryHtmlElement } from '../../shared/dom-lookup';
import { createRemixIconElement } from '../../shared/ui/remix-icon';
import type { RecentCardDragSession } from '../recent/recent-card-drag';

interface GhostColors {
  rim: string;
  face: string;
  border: string;
  radius: number;
}

function cloneHtmlElement(element: HTMLElement): HTMLElement | null {
  const clone = element.cloneNode(true);
  return isHtmlElement(clone) ? clone : null;
}

const GHOST_ICON_SIZE_PX = 52;
const GHOST_ICON_RADIUS_PX = 17;
const GHOST_LIFT_MS = 320;
const GHOST_RETURN_MS = 260;
const GHOST_LAND_MS = 180;
const GHOST_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const GHOST_SHADOW = '0 12px 28px rgba(15, 23, 42, 0.22), 0 2px 6px rgba(15, 23, 42, 0.12)';
const GHOST_REST_SHADOW = '0 0 0 rgba(15, 23, 42, 0), 0 0 0 rgba(15, 23, 42, 0)';

function isMotionReduced(): boolean {
  const rootElement = document.documentElement;
  if (rootElement && rootElement.getAttribute('data-lumno-motion-effects') === 'off') {
    return true;
  }
  return Boolean(typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function animate(element: HTMLElement, keyframes: Keyframe[], duration: number): Animation | null {
  if (typeof element.animate !== 'function' || isMotionReduced()) {
    return null;
  }
  return element.animate(keyframes, { duration, easing: GHOST_EASING, fill: 'both' });
}

function whenFinished(animations: ReadonlyArray<Animation | null>, callback: () => void): void {
  const running = animations.filter((animation): animation is Animation => Boolean(animation));
  if (!running.length) {
    callback();
    return;
  }
  let done = false;
  const finish = () => {
    if (!done) {
      done = true;
      callback();
    }
  };
  Promise.all(running.map((animation) => animation.finished)).then(finish, finish);
}

// The site icon shown in the card header: its favicon, or the fallback
// icon that stands in for one that did not (or not yet) load. CSS hides
// a favicon image that is not ready, so ask what is actually shown.
function cloneCardFavicon(card: HTMLElement): HTMLElement {
  const isShown = (node: HTMLElement | null): node is HTMLElement =>
    Boolean(node && window.getComputedStyle(node).display !== 'none');
  const image = queryHtmlElement(card, '.x-nt-recent-favicon');
  const fallback = queryHtmlElement(card, '.x-nt-recent-header ._x_extension_favicon_fallback_2024_unique_');
  let icon: HTMLElement | null = null;
  if (isShown(image) && isHtmlTag(image, 'img') && image.complete && image.naturalWidth > 0) {
    icon = cloneHtmlElement(image);
    if (icon) icon.removeAttribute('loading');
  } else if (isShown(fallback)) {
    icon = cloneHtmlElement(fallback);
  }
  if (!icon) {
    icon = document.createElement('span');
    icon.className = 'x-nt-favicon-fallback';
    icon.append(createRemixIconElement(document, { name: 'ri-link', size: 16 }));
  }
  icon.removeAttribute('id');
  icon.setAttribute('data-visible', 'true');
  icon.classList.add('x-nt-recent-drag-ghost-favicon');
  return icon;
}

// A frozen copy of the card as it looks under the pointer. It keeps the
// card's theme, which comes from custom properties on the card and its
// dock, and shows the card's hover look like an open context menu does.
function createCardSnapshot(card: HTMLElement, rect: DOMRect): HTMLElement {
  const shell = document.createElement('div');
  shell.className = String(card.className || '').replace(/\bx-nt-recent-card--rollback\b/g, '').trim();
  shell.setAttribute('data-recent-context-menu-open', 'true');
  const computed = window.getComputedStyle(card);
  for (let index = 0; index < computed.length; index += 1) {
    const name = computed[index];
    if (name.startsWith('--')) {
      shell.style.setProperty(name, computed.getPropertyValue(name));
    }
  }
  const visual = card.querySelector('.x-nt-recent-card-visual');
  if (visual) {
    shell.appendChild(visual.cloneNode(true));
  }
  shell.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
  shell.classList.add('x-nt-recent-drag-ghost-snapshot');
  shell.style.width = `${rect.width}px`;
  shell.style.height = `${rect.height}px`;
  return shell;
}

function readCardColors(card: HTMLElement): GhostColors {
  const visual = card.querySelector('.x-nt-recent-card-visual');
  const inner = card.querySelector('.x-nt-recent-inner');
  const visualStyle = visual ? window.getComputedStyle(visual) : null;
  const innerStyle = inner ? window.getComputedStyle(inner) : null;
  return {
    rim: visualStyle ? visualStyle.backgroundColor : 'rgba(241, 245, 249, 0.96)',
    face: innerStyle ? innerStyle.backgroundColor : '#ffffff',
    border: visualStyle ? visualStyle.borderTopColor : 'rgba(0, 0, 0, 0.1)',
    radius: visualStyle ? Number.parseFloat(visualStyle.borderTopLeftRadius) || 28 : 28
  };
}

function getCardFrame(state: RecentCardDragSession, colors: GhostColors, pointerX: number, pointerY: number): Keyframe {
  const rect = state.card.getBoundingClientRect();
  return {
    left: `${rect.left - pointerX}px`,
    top: `${rect.top - pointerY}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    borderRadius: `${colors.radius}px`,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    borderColor: 'rgba(0, 0, 0, 0)',
    boxShadow: GHOST_REST_SHADOW
  };
}

function getIconFrame(colors: GhostColors): Keyframe {
  const half = GHOST_ICON_SIZE_PX / 2;
  return {
    left: `${-half}px`,
    top: `${-half}px`,
    width: `${GHOST_ICON_SIZE_PX}px`,
    height: `${GHOST_ICON_SIZE_PX}px`,
    borderRadius: `${GHOST_ICON_RADIUS_PX}px`,
    backgroundColor: colors.rim,
    borderColor: colors.border,
    boxShadow: GHOST_SHADOW
  };
}

function readCurrentFrame(element: HTMLElement): Keyframe {
  const style = window.getComputedStyle(element);
  return {
    left: style.left,
    top: style.top,
    width: style.width,
    height: style.height,
    borderRadius: style.borderTopLeftRadius,
    backgroundColor: style.backgroundColor,
    borderColor: style.borderTopColor,
    boxShadow: style.boxShadow
  };
}

function moveGhost(state: RecentCardDragSession, pointerX: number, pointerY: number): void {
  if (state.ghost) {
    state.ghost.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0)`;
  }
}

// The ghost sits on the pointer. Its body starts as the card's frame,
// measured from the pointer, and closes in on the pointer as it shrinks,
// while the card copy fades out and the site icon fades in.
function liftGhost(state: RecentCardDragSession, pointerX: number, pointerY: number): void {
  const card = state.card;
  const rect = card.getBoundingClientRect();
  const colors = readCardColors(card);
  state.ghostColors = colors;
  const ghost = document.createElement('div');
  ghost.className = 'x-nt-recent-drag-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  const body = document.createElement('div');
  body.className = 'x-nt-recent-drag-ghost-body';
  const snapshot = createCardSnapshot(card, rect);
  const face = document.createElement('div');
  face.className = 'x-nt-recent-drag-ghost-icon';
  face.style.backgroundColor = colors.face;
  face.appendChild(cloneCardFavicon(card));
  body.appendChild(snapshot);
  body.appendChild(face);
  ghost.appendChild(body);
  document.body.appendChild(ghost);
  state.ghost = ghost;
  state.ghostBody = body;
  state.ghostSnapshot = snapshot;
  state.ghostFace = face;
  moveGhost(state, pointerX, pointerY);
  const iconFrame = getIconFrame(colors);
  Object.assign(body.style, iconFrame);
  snapshot.style.opacity = '0';
  snapshot.style.transform = `scale(${GHOST_ICON_SIZE_PX / Math.max(1, rect.width)})`;
  animate(body, [getCardFrame(state, colors, pointerX, pointerY), iconFrame], GHOST_LIFT_MS);
  animate(snapshot, [
    { opacity: 1, transform: 'scale(1)' },
    { opacity: 0, offset: 0.55 },
    { opacity: 0, transform: snapshot.style.transform }
  ], GHOST_LIFT_MS);
  animate(face, [
    { opacity: 0, transform: 'scale(0.6)' },
    { opacity: 0, transform: 'scale(0.6)', offset: 0.25 },
    { opacity: 1, transform: 'scale(1)' }
  ], GHOST_LIFT_MS);
}

function removeGhost(state: RecentCardDragSession): void {
  if (state.ghost) {
    state.ghost.remove();
  }
  state.ghost = null;
  state.ghostBody = null;
  state.ghostSnapshot = null;
  state.ghostFace = null;
}

function cancelGhostAnimations(state: RecentCardDragSession): void {
  [state.ghostBody, state.ghostSnapshot, state.ghostFace].forEach((element) => {
    if (element && typeof element.getAnimations === 'function') {
      element.getAnimations().forEach((animation) => animation.cancel());
    }
  });
}

// Nothing took the drop: the icon grows back into the card it left.
function returnGhost(state: RecentCardDragSession, pointerX: number, pointerY: number, done: () => void): void {
  const { ghostBody: body, ghostSnapshot: snapshot, ghostFace: face, ghostColors: colors } = state;
  if (!body || !snapshot || !face || !colors || !state.card.isConnected) {
    done();
    return;
  }
  const from = readCurrentFrame(body);
  const snapshotStyle = window.getComputedStyle(snapshot);
  const faceStyle = window.getComputedStyle(face);
  const snapshotFrom = { opacity: snapshotStyle.opacity, transform: snapshotStyle.transform };
  const faceFrom = { opacity: faceStyle.opacity, transform: faceStyle.transform };
  cancelGhostAnimations(state);
  const to = getCardFrame(state, colors, pointerX, pointerY);
  Object.assign(body.style, to);
  snapshot.style.opacity = '1';
  snapshot.style.transform = 'scale(1)';
  face.style.opacity = '0';
  whenFinished([
    animate(body, [from, to], GHOST_RETURN_MS),
    animate(snapshot, [snapshotFrom, { opacity: 1, offset: 0.6 }, { opacity: 1, transform: 'scale(1)' }], GHOST_RETURN_MS),
    animate(face, [faceFrom, { opacity: 0, transform: 'scale(0.6)', offset: 0.5 }, { opacity: 0, transform: 'scale(0.6)' }], GHOST_RETURN_MS)
  ], done);
}

// The drop took: the icon sinks into its new place.
function landGhost(state: RecentCardDragSession, done: () => void): void {
  const body = state.ghostBody;
  if (!body) {
    done();
    return;
  }
  const from = readCurrentFrame(body);
  cancelGhostAnimations(state);
  Object.assign(body.style, from);
  if (state.ghostSnapshot) state.ghostSnapshot.style.opacity = '0';
  body.style.opacity = '0';
  body.style.transform = 'scale(0.5)';
  whenFinished([
    animate(body, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.5)' }], GHOST_LAND_MS)
  ], done);
}

export { cancelGhostAnimations, landGhost, liftGhost, moveGhost, removeGhost, returnGhost };
export type { GhostColors };
