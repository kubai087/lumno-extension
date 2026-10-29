// The models and options of the tooltip view (src/shared/react/tooltip-view.tsx)
// and the feature hint view (src/shared/react/feature-hint-view.tsx).

import type { RemixIconSpec } from '../shared/ui/remix-icon';
import type { PortalHost } from '../shared/react/portal-host';
import type { Store } from '../shared/state/store';

export interface TooltipElementOptions {
  className?: string;
  documentObj?: Document;
  id?: string;
  kind?: string;
  positionMode?: string;
}

export interface CursorTagModel {
  keyText: string;
  label: string;
  windowsLogo?: boolean;
}

export interface BrowserAvatar {
  id?: string;
  name?: string;
  src?: string;
}

export interface BrowserAvatarTooltipModel {
  browsers?: readonly BrowserAvatar[];
  browserNameSeparator?: string;
  browserAvatarSuffix?: string;
}

export interface FeatureHintViewModel {
  actions?: Array<{
    icon?: RemixIconSpec;
    id: string;
    variant?: 'primary' | 'secondary';
  }>;
  alignMode: string;
  arrowAlign: string;
  arrowSide: string;
  badgeIcon?: RemixIconSpec;
  badgeIconImageSrc?: string;
  badgeIconText?: string;
  badgeWordmarkDarkImageSrc?: string;
  badgeWordmarkImageSrc?: string;
  className?: string;
  dismissStorage: string;
  elementId: string;
  hasLink: boolean;
  hintId: string;
  inlineActions?: boolean;
  placement?: string;
  roundedArrowTip: boolean;
  surface?: string;
  textId: string;
  version?: string;
  widthMode: string;
}

export interface FeatureHintViewLabels {
  actions?: Record<string, string>;
  badge: string;
  close: string;
  connector?: string;
  link?: string;
  text: string;
  trailing?: string;
}

export interface FeatureHintViewOptions {
  portals: PortalHost;
  documentObj?: Document;
  // The hint's copy in the page's language, as the hint sets it.
  labels: Store<{ labels: FeatureHintViewLabels }>;
  model: FeatureHintViewModel;
  onActionClick?(actionId: string, event: MouseEvent): void;
  onDismiss?(): void;
  onLinkClick?(event: MouseEvent): void;
}

export interface FeatureHintViewController {
  actionButtons: HTMLButtonElement[];
  arrowTip: HTMLSpanElement | null;
  badge: HTMLSpanElement;
  closeButton: HTMLButtonElement;
  destroy(): void;
  element: HTMLSpanElement;
  linkButton: HTMLButtonElement | null;
  text: HTMLSpanElement;
}

