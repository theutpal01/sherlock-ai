import { useCallback, useEffect, useRef, type KeyboardEvent, type RefObject } from 'react';

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Keeps keyboard focus inside a modal and returns it to the opener on close. */
export function useDialogFocus(
  onClose?: () => void,
  fallbackFocusRef?: RefObject<HTMLElement | null>,
) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const restoreOnUnmount = useRef(true);

  useEffect(() => {
    const activeElement = document.activeElement;
    returnFocus.current = activeElement instanceof HTMLElement
      ? activeElement === document.body && fallbackFocusRef?.current
        ? fallbackFocusRef.current
        : activeElement
      : fallbackFocusRef?.current ?? null;
    dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    return () => {
      if (restoreOnUnmount.current && returnFocus.current?.isConnected) {
        returnFocus.current.focus();
      }
    };
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && onClose) {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) {
      event.preventDefault();
    } else if (!event.currentTarget.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, [onClose]);

  const skipFocusRestore = () => {
    restoreOnUnmount.current = false;
  };

  return { dialogRef, handleKeyDown, skipFocusRestore };
}
