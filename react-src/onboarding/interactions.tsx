import type {
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode
} from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { RemixIcon as Icon } from '../shared/remix-icon';

interface InteractionLink {
  actionId?: string;
  href?: string;
  label?: string;
}

interface InteractionAccordion {
  expandedByDefault?: boolean;
  icon?: string;
  links?: InteractionLink[];
  text?: string;
}

interface InteractionInfoTooltip {
  icon?: string;
  label?: string;
  text?: string;
  type?: string;
}

interface InteractionLinkButton {
  href?: string;
  icon?: string;
  label?: string;
  tooltip?: string;
}

export interface InteractionSlot {
  accordion?: InteractionAccordion;
  accordionId?: string;
  actionId?: string;
  browserAvatars?: unknown;
  browserOnly?: string;
  description?: string;
  icon?: string;
  id: string;
  infoTooltip?: InteractionInfoTooltip;
  kind?: string;
  label?: string;
  linkButton?: InteractionLinkButton;
}

export interface InteractionsRenderModel {
  expandedAccordionId: string;
  slots: InteractionSlot[];
}

export interface InteractionsController {
  render(model: InteractionsRenderModel): void;
  setExpandedAccordionId(accordionId: string): void;
  destroy(): void;
}

export interface InteractionsControllerOptions {
  onAction(actionId: string, event: MouseEvent): void;
  onHideInfoTooltip(): void;
  onShowInfoTooltip(
    target: HTMLElement,
    infoTooltip: InteractionInfoTooltip,
    browserAvatars: unknown
  ): void;
  onToggleAccordion(accordionId: string): void;
}

function getAccordionId(slot: InteractionSlot): string {
  return String(slot.accordionId || slot.id || '').trim();
}

function isAccordionExpanded(
  slot: InteractionSlot,
  expandedAccordionId: string
): boolean {
  const accordionId = getAccordionId(slot);
  if (!slot.accordion || !accordionId) {
    return false;
  }
  if (expandedAccordionId) {
    return accordionId === expandedAccordionId;
  }
  return slot.accordion.expandedByDefault === true;
}

function LinkedText({
  links,
  onAction,
  text
}: {
  links: InteractionLink[];
  onAction(actionId: string, event: MouseEvent): void;
  text: string;
}) {
  const sourceText = String(text || '');
  const linkItems = links
    .map((link) => {
      const label = String(link.label || '').trim();
      const href = String(link.href || '').trim();
      const index = label ? sourceText.indexOf(label) : -1;
      return label && href && index >= 0
        ? {
            actionId: String(link.actionId || '').trim(),
            href,
            index,
            label
          }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => left.index - right.index);
  const nodes: ReactNode[] = [];
  let cursor = 0;

  linkItems.forEach((item, index) => {
    if (item.index < cursor) {
      return;
    }
    if (item.index > cursor) {
      nodes.push(sourceText.slice(cursor, item.index));
    }
    nodes.push(
      <a
        className="interaction-accordion-link"
        data-action={item.actionId || undefined}
        href={item.href}
        key={`${item.label}-${index}`}
        onClick={(event) => {
          if (!item.actionId) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          onAction(item.actionId, event.nativeEvent);
        }}
      >
        {item.label}
      </a>
    );
    cursor = item.index + item.label.length;
  });
  if (cursor < sourceText.length) {
    nodes.push(sourceText.slice(cursor));
  }
  return <>{nodes}</>;
}

function InteractionInfoButton({
  browserAvatars,
  infoTooltip,
  options
}: {
  browserAvatars: unknown;
  infoTooltip: InteractionInfoTooltip;
  options: InteractionsControllerOptions;
}) {
  const show = (
    event: ReactMouseEvent<HTMLButtonElement> |
      ReactFocusEvent<HTMLButtonElement>
  ): void => {
    options.onShowInfoTooltip(
      event.currentTarget,
      infoTooltip,
      browserAvatars
    );
  };
  const handleKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>
  ): void => {
    if (event.key === 'Escape') {
      options.onHideInfoTooltip();
      event.currentTarget.blur();
    }
  };

  return (
    <button
      aria-label={String(infoTooltip.label || 'Info')}
      className="interaction-info-button"
      data-tooltip={String(infoTooltip.text || '')}
      data-tooltip-type={infoTooltip.type || undefined}
      onBlur={options.onHideInfoTooltip}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        show(event);
      }}
      onFocus={show}
      onKeyDown={handleKeyDown}
      onMouseEnter={show}
      onMouseLeave={options.onHideInfoTooltip}
      type="button"
    >
      <Icon className={String(infoTooltip.icon || 'ri-information-line')} />
    </button>
  );
}

function InteractionLinkAffordance({
  linkButton,
  options
}: {
  linkButton: InteractionLinkButton;
  options: InteractionsControllerOptions;
}) {
  const label = String(linkButton.label || 'GitHub repo').trim() || 'GitHub repo';
  const tooltip = String(linkButton.tooltip || label).trim() || label;
  const tooltipModel = { text: tooltip };
  const show = (
    event: ReactMouseEvent<HTMLAnchorElement> |
      ReactFocusEvent<HTMLAnchorElement>
  ): void => {
    options.onShowInfoTooltip(event.currentTarget, tooltipModel, null);
  };
  return (
    <a
      aria-label={label}
      className="interaction-info-button interaction-link-button"
      data-tooltip={tooltip}
      href={String(linkButton.href || '')}
      onBlur={options.onHideInfoTooltip}
      onClick={options.onHideInfoTooltip}
      onFocus={show}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          options.onHideInfoTooltip();
          event.currentTarget.blur();
        }
      }}
      onMouseEnter={show}
      onMouseLeave={options.onHideInfoTooltip}
      rel="noreferrer noopener"
      target="_blank"
    >
      <Icon className={String(linkButton.icon || 'ri-github-fill')} />
    </a>
  );
}

function InteractionSlotCopy({
  expandedAccordionId,
  options,
  slot
}: {
  expandedAccordionId: string;
  options: InteractionsControllerOptions;
  slot: InteractionSlot;
}) {
  const accordion = slot.accordion || null;
  const accordionId = getAccordionId(slot);
  const expanded = isAccordionExpanded(slot, expandedAccordionId);
  const hasInfoTooltip = Boolean(
    slot.infoTooltip &&
      (slot.infoTooltip.text || slot.infoTooltip.type)
  );
  const hasLinkButton = Boolean(slot.linkButton?.href);
  const hasInlineAffordance = hasInfoTooltip || hasLinkButton;

  return (
    <>
      {slot.icon ? (
        <span className="interaction-row-icon">
          <Icon className={String(slot.icon)} />
        </span>
      ) : null}
      <span
        className={`interaction-copy${
          hasInlineAffordance ? ' interaction-copy--with-info' : ''
        }`}
      >
        {slot.label && accordion ? (
          <button
            aria-controls={`${slot.id}-accordion`}
            aria-expanded={expanded ? 'true' : 'false'}
            className="interaction-accordion-trigger"
            data-accordion-id={accordionId}
            data-action={String(slot.actionId || '')}
            id={`${slot.id}-accordion-trigger`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              options.onToggleAccordion(accordionId);
            }}
            type="button"
          >
            <span className="interaction-label">{slot.label}</span>
            <span
              aria-hidden="true"
              className="interaction-accordion-chevron"
            >
              <Icon
                className={String(
                  accordion.icon || 'ri-arrow-left-s-line'
                )}
              />
            </span>
          </button>
        ) : slot.label ? (
          <span className="interaction-label">{slot.label}</span>
        ) : (
          <>
            <span
              aria-hidden="true"
              className="skeleton-line skeleton-line--label"
            />
            <span
              aria-hidden="true"
              className="skeleton-line skeleton-line--meta"
            />
          </>
        )}
        {slot.description ? (
          <span className="interaction-description">
            {slot.description}
          </span>
        ) : null}
        {hasInfoTooltip && slot.infoTooltip ? (
          <InteractionInfoButton
            browserAvatars={slot.browserAvatars}
            infoTooltip={slot.infoTooltip}
            options={options}
          />
        ) : null}
        {hasLinkButton && slot.linkButton ? (
          <InteractionLinkAffordance
            linkButton={slot.linkButton}
            options={options}
          />
        ) : null}
      </span>
      {accordion?.text ? (
        <span
          aria-labelledby={`${slot.id}-accordion-trigger`}
          className="interaction-accordion-panel"
          data-open={expanded ? 'true' : 'false'}
          id={`${slot.id}-accordion`}
        >
          <span
            aria-hidden={expanded ? 'false' : 'true'}
            className="interaction-accordion-text t-panel-slide"
            data-open={expanded ? 'true' : 'false'}
          >
            <LinkedText
              links={Array.isArray(accordion.links) ? accordion.links : []}
              onAction={options.onAction}
              text={String(accordion.text)}
            />
          </span>
        </span>
      ) : null}
    </>
  );
}

function InteractionSlotView({
  expandedAccordionId,
  options,
  slot
}: {
  expandedAccordionId: string;
  options: InteractionsControllerOptions;
  slot: InteractionSlot;
}) {
  const hasAccordion = Boolean(slot.accordion?.text);
  const hasInfoTooltip = Boolean(
    slot.infoTooltip &&
      (slot.infoTooltip.text || slot.infoTooltip.type)
  );
  const hasLinkButton = Boolean(slot.linkButton?.href);
  const itemHasAction = Boolean(slot.actionId) && !hasAccordion;
  const expanded = hasAccordion &&
    isAccordionExpanded(slot, expandedAccordionId);
  const className = [
    'interaction-slot',
    itemHasAction ? '' : 'interaction-slot--static',
    hasAccordion ? 'interaction-slot--accordion' : '',
    hasInfoTooltip || hasLinkButton ? 'interaction-slot--with-info' : ''
  ].filter(Boolean).join(' ');
  const content = (
    <InteractionSlotCopy
      expandedAccordionId={expandedAccordionId}
      options={options}
      slot={slot}
    />
  );

  if (itemHasAction) {
    return (
      <button
        className={className}
        data-action={String(slot.actionId)}
        data-browser-only={slot.browserOnly || undefined}
        data-interaction-kind={String(slot.kind || '')}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          options.onAction(String(slot.actionId), event.nativeEvent);
        }}
        type="button"
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={className}
      data-accordion-id={hasAccordion ? getAccordionId(slot) : undefined}
      data-browser-only={slot.browserOnly || undefined}
      data-expanded={hasAccordion ? (expanded ? 'true' : 'false') : undefined}
      data-interaction-kind={String(slot.kind || '')}
    >
      {content}
    </div>
  );
}

export function createInteractionsController(
  host: HTMLElement | null,
  options: InteractionsControllerOptions
): InteractionsController {
  if (!host) {
    return {
      render() {},
      setExpandedAccordionId() {},
      destroy() {}
    };
  }

  const hostElement: HTMLElement = host;
  const reactRoot: Root = createRoot(hostElement);
  let destroyed = false;
  let currentModel: InteractionsRenderModel | null = null;
  hostElement.setAttribute('data-react-island', 'onboarding-interactions');

  function commit(model: InteractionsRenderModel): void {
    if (destroyed) {
      return;
    }
    currentModel = {
      expandedAccordionId: String(model.expandedAccordionId || ''),
      slots: Array.isArray(model.slots) ? model.slots : []
    };
    options.onHideInfoTooltip();
    hostElement.hidden = currentModel.slots.length === 0;
    hostElement.dataset.visible = currentModel.slots.length > 0 ? 'true' : 'false';
    hostElement.dataset.accordion = currentModel.slots.some(
      (slot) => Boolean(slot.accordion?.text)
    ) ? 'true' : 'false';

    flushSync(() => {
      reactRoot.render(
        currentModel?.slots.map((slot) => (
          <InteractionSlotView
            expandedAccordionId={
              currentModel?.expandedAccordionId || ''
            }
            key={slot.id}
            options={options}
            slot={slot}
          />
        ))
      );
    });
  }

  return Object.freeze({
    render: commit,
    setExpandedAccordionId(accordionId: string) {
      if (!currentModel) {
        return;
      }
      commit({
        ...currentModel,
        expandedAccordionId: String(accordionId || '')
      });
    },
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      options.onHideInfoTooltip();
      flushSync(() => {
        reactRoot.unmount();
      });
    }
  });
}

export function createInteractionsApi() {
  return Object.freeze({
    implementation: 'react',
    createInteractionsController
  });
}
