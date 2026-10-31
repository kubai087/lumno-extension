import { useEffect, useRef, useState } from 'react';
import { isNode } from '../../shared/dom-guards';

// A bubble that opens from its trigger: a press outside closes it, and
// Escape or close() closes it and hands focus back to the trigger.
export function usePopconfirm() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreTriggerFocusRef = useRef(false);

  const close = () => {
    restoreTriggerFocusRef.current = true;
    setOpen(false);
  };

  useEffect(() => {
    if (open || !restoreTriggerFocusRef.current) {
      return;
    }
    restoreTriggerFocusRef.current = false;
    triggerRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onDocumentPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(isNode(event.target) ? event.target : null)) {
        setOpen(false);
      }
    };
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener('pointerdown', onDocumentPointerDown);
    document.addEventListener('keydown', onDocumentKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onDocumentPointerDown);
      document.removeEventListener('keydown', onDocumentKeyDown);
    };
  }, [open]);

  return { open, toggle: () => setOpen((value) => !value), close, wrapRef, triggerRef };
}
