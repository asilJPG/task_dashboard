'use client';

import { useEffect, useRef } from 'react';

// Open modals, oldest first. Escape must only reach the topmost one, otherwise confirming a
// delete on top of a task would dismiss both windows at once.
const modalStack = [];

/**
 * Standard modal keyboard/scroll behaviour:
 *  - Escape closes the window (topmost only)
 *  - the page behind stops scrolling while the window is open
 *
 * @param {boolean} isOpen
 * @param {Function} onClose
 */
export function useModalBehavior(isOpen, onClose) {
  // Kept in a ref so an inline arrow prop does not re-subscribe on every render.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const token = {};
    modalStack.push(token);

    const handleKey = (e) => {
      if (e.key !== 'Escape') return;
      if (modalStack[modalStack.length - 1] !== token) return;
      e.stopPropagation();
      closeRef.current?.();
    };

    window.addEventListener('keydown', handleKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKey);
      const index = modalStack.indexOf(token);
      if (index !== -1) modalStack.splice(index, 1);
      // Only the last window open restores scrolling.
      if (modalStack.length === 0) document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);
}

/** Puts the caret in the first text field so a form can be filled without reaching for the mouse. */
export function useAutoFocus(isOpen, ref) {
  useEffect(() => {
    if (!isOpen || !ref?.current) return;
    const timer = setTimeout(() => ref.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [isOpen, ref]);
}
