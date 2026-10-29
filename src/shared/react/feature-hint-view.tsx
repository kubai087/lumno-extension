import type {
  FeatureHintViewController,
  FeatureHintViewLabels,
  FeatureHintViewModel,
  FeatureHintViewOptions
} from '../../types/view-apis';
import { queryHtmlTag, queryHtmlTags } from '../dom-lookup';
import { RemixIcon } from './remix-icon';

export type {
  FeatureHintViewController,
  FeatureHintViewLabels,
  FeatureHintViewModel,
  FeatureHintViewOptions
};

type HintAction = NonNullable<FeatureHintViewModel['actions']>[number];
type HintClickEvent = React.MouseEvent<HTMLButtonElement>;

// A click, or a middle click; other auxiliary clicks do nothing.
function readActivation(event: HintClickEvent): MouseEvent | null {
  event.preventDefault();
  event.stopPropagation();
  return event.type === 'auxclick' && event.button !== 1 ? null : event.nativeEvent;
}

function HintActionButton({ action, labels, onActionClick }: {
  action: HintAction;
  labels: FeatureHintViewLabels;
  onActionClick: FeatureHintViewOptions['onActionClick'];
}) {
  const activate = (event: HintClickEvent): void => {
    const activation = readActivation(event);
    if (activation) {
      onActionClick?.(action.id, activation);
    }
  };
  return (
    <button
      aria-label={labels.actions?.[action.id] || ''}
      className="x-lumno-feature-hint__link x-lumno-feature-hint__action"
      data-action-id={action.id}
      data-variant={action.variant || 'secondary'}
      onAuxClick={activate}
      onClick={activate}
      type="button"
    >
      {action.icon ? (
        <span aria-hidden="true" className="x-lumno-feature-hint__action-icon">
          <RemixIcon {...action.icon} />
        </span>
      ) : null}
      <span className="x-lumno-feature-hint__action-text">{labels.actions?.[action.id] || ''}</span>
    </button>
  );
}

// The badge's icon: Lumno's mark, a Remix icon or a character.
function BadgeIcon({ model }: { model: FeatureHintViewModel }) {
  if (model.badgeIconImageSrc) {
    return (
      <span className="x-lumno-feature-hint__brand-icon">
        <img alt="" draggable={false} src={model.badgeIconImageSrc} />
      </span>
    );
  }
  if (model.badgeIcon) {
    return (
      <span className="x-lumno-feature-hint__badge-icon">
        <RemixIcon {...model.badgeIcon} />
      </span>
    );
  }
  return model.badgeIconText ? (
    <span className="x-lumno-feature-hint__badge-icon" data-icon-type="text">{model.badgeIconText}</span>
  ) : null;
}

// The badge: its icon, then Lumno's wordmark in light and dark, or its text.
function HintBadge({ model, labels }: { model: FeatureHintViewModel; labels: FeatureHintViewLabels }) {
  return (
    <span
      aria-label={labels.badge}
      className="x-lumno-feature-hint__badge"
      data-brand={model.badgeIconImageSrc || model.badgeWordmarkImageSrc ? 'lumno' : undefined}
    >
      <BadgeIcon model={model} />
      {model.badgeWordmarkImageSrc ? (
        <span aria-hidden="true" className="x-lumno-feature-hint__brand-wordmark">
          <img
            alt=""
            className="x-lumno-feature-hint__brand-wordmark-image x-lumno-feature-hint__brand-wordmark-image--light"
            draggable={false}
            src={model.badgeWordmarkImageSrc}
          />
          {model.badgeWordmarkDarkImageSrc ? (
            <img
              alt=""
              className="x-lumno-feature-hint__brand-wordmark-image x-lumno-feature-hint__brand-wordmark-image--dark"
              draggable={false}
              src={model.badgeWordmarkDarkImageSrc}
            />
          ) : null}
        </span>
      ) : (
        <span className="x-lumno-feature-hint__badge-text">{labels.badge}</span>
      )}
    </span>
  );
}

// The text with its actions inside the sentence: "text [first] connector
// [others] trailing".
function HintSentence({ model, labels, actions, onActionClick }: {
  model: FeatureHintViewModel;
  labels: FeatureHintViewLabels;
  actions: HintAction[];
  onActionClick: FeatureHintViewOptions['onActionClick'];
}) {
  return (
    <span className="x-lumno-feature-hint__sentence">
      <span className="x-lumno-feature-hint__text" id={model.textId}>{labels.text}</span>
      <HintActionButton action={actions[0]} labels={labels} onActionClick={onActionClick} />
      {labels.connector ? <span className="x-lumno-feature-hint__connector">{labels.connector}</span> : null}
      {actions.slice(1).map((action) => (
        <HintActionButton action={action} key={action.id} labels={labels} onActionClick={onActionClick} />
      ))}
      {labels.trailing ? <span className="x-lumno-feature-hint__trailing">{labels.trailing}</span> : null}
    </span>
  );
}

function HintLink({ labels, onLinkClick }: { labels: FeatureHintViewLabels; onLinkClick: FeatureHintViewOptions['onLinkClick'] }) {
  const activate = (event: HintClickEvent): void => {
    const activation = readActivation(event);
    if (activation) {
      onLinkClick?.(activation);
    }
  };
  return (
    <button
      aria-label={labels.link || ''}
      className="x-lumno-feature-hint__link"
      onAuxClick={activate}
      onClick={activate}
      title={labels.link || ''}
      type="button"
    >
      <span className="x-lumno-feature-hint__link-text">{labels.link || ''}</span>
      <span className="x-lumno-feature-hint__link-icon">
        <RemixIcon name="ri-arrow-right-line" size={12} />
      </span>
    </button>
  );
}

function FeatureHintContent({ labels, model, onDismiss, onLinkClick, onActionClick }: Omit<FeatureHintViewOptions, 'documentObj' | 'portals'>) {
  const actions = model.actions || [];
  const inline = Boolean(model.inlineActions) && actions.length > 0;
  return (
    <>
      {model.roundedArrowTip ? <span aria-hidden="true" className="x-lumno-feature-hint__arrow-tip" /> : null}
      <HintBadge labels={labels} model={model} />
      {inline ? (
        <HintSentence actions={actions} labels={labels} model={model} onActionClick={onActionClick} />
      ) : (
        <span className="x-lumno-feature-hint__text" id={model.textId}>{labels.text}</span>
      )}
      {model.hasLink ? <HintLink labels={labels} onLinkClick={onLinkClick} /> : null}
      {!model.inlineActions && actions.length > 0 ? (
        <span aria-label={labels.text} className="x-lumno-feature-hint__actions" role="group">
          {actions.map((action) => (
            <HintActionButton action={action} key={action.id} labels={labels} onActionClick={onActionClick} />
          ))}
        </span>
      ) : null}
      <button
        aria-label={labels.close}
        className="x-lumno-feature-hint__close"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onDismiss?.();
        }}
        type="button"
      >
        <RemixIcon name="ri-close-line" size={12} />
      </button>
    </>
  );
}

// The hint's element, with the attributes its styles and placement read.
function createHintElement(documentObj: Document, model: FeatureHintViewModel): HTMLSpanElement {
  const element = documentObj.createElement('span');
  element.id = model.elementId;
  element.className = ['x-lumno-feature-hint', model.className || ''].filter(Boolean).join(' ');
  const attributes: Array<[string, string]> = [
    ['role', 'note'],
    ['data-react-island', 'feature-hint'],
    ['data-feature-hint-id', model.hintId],
    ['data-feature-hint-surface', model.surface || ''],
    ['data-feature-hint-placement', model.placement || ''],
    ['data-feature-hint-version', model.version || ''],
    ['data-arrow-side', model.arrowSide],
    ['data-arrow-align', model.arrowAlign],
    ['data-dismiss-storage', model.dismissStorage],
    ['data-width-mode', model.widthMode],
    ['data-align-mode', model.alignMode],
    ['data-multiline', 'false'],
    ['data-has-link', model.hasLink ? 'true' : 'false'],
    ['data-has-actions', model.actions && model.actions.length > 0 ? 'true' : 'false'],
    ['data-rounded-arrow-tip', model.roundedArrowTip ? 'true' : 'false'],
    ['data-visible', 'false'],
    ['data-dismissed', 'false'],
    ['aria-hidden', 'true']
  ];
  attributes.forEach(([name, value]) => element.setAttribute(name, value));
  return element;
}

export function createFeatureHintView(options: FeatureHintViewOptions): FeatureHintViewController | null {
  const documentObj = options.documentObj || document;
  if (!documentObj || !options.model) {
    return null;
  }
  const model = options.model;
  const element = createHintElement(documentObj, model);
  let labels = options.labels;
  let destroyed = false;
  const render = (): void => {
    if (destroyed) {
      return;
    }
    options.portals.show(element, (
      <FeatureHintContent
        labels={labels}
        model={model}
        onActionClick={options.onActionClick}
        onDismiss={options.onDismiss}
        onLinkClick={options.onLinkClick}
      />
    ));
  };
  render();

  const badge = queryHtmlTag(element, '.x-lumno-feature-hint__badge', 'span');
  const text = queryHtmlTag(element, '.x-lumno-feature-hint__text', 'span');
  const closeButton = queryHtmlTag(element, '.x-lumno-feature-hint__close', 'button');
  if (!badge || !text || !closeButton) {
    options.portals.remove(element);
    return null;
  }

  return {
    actionButtons: Array.from(queryHtmlTags(element, '.x-lumno-feature-hint__action', 'button')),
    arrowTip: queryHtmlTag(element, '.x-lumno-feature-hint__arrow-tip', 'span'),
    badge,
    closeButton,
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      options.portals.remove(element);
    },
    element,
    linkButton: queryHtmlTag(element, '.x-lumno-feature-hint__link', 'button'),
    text,
    updateLabels(nextLabels) {
      labels = nextLabels;
      render();
    }
  };
}
