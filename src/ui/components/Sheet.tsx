import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import './Sheet.css';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel?: string;
}

const DISMISS_DISTANCE = 90;
const TAP_SLOP = 6;

/** A drag-dismissible bottom sheet. Closes on scrim tap, Escape, a handle tap, or a downward drag past the threshold. */
export function Sheet({ open, onClose, children, ariaLabel }: SheetProps) {
  const [dragY, setDragY] = useState(0);
  const dragging = useRef(false);
  const startY = useRef(0);
  const lastDelta = useRef(0);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setDragY(0);
  }, [open]);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    dragging.current = true;
    startY.current = e.clientY;
    lastDelta.current = 0;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    const delta = Math.max(0, e.clientY - startY.current);
    lastDelta.current = delta;
    setDragY(delta);
  }

  function onPointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    const delta = lastDelta.current;
    if (delta > DISMISS_DISTANCE || delta <= TAP_SLOP) {
      // A near-zero drag is a tap on the handle, which also dismisses.
      onClose();
    }
    setDragY(0);
  }

  return (
    <div className={`sheet-wrap${open ? ' open' : ''}`} aria-hidden={!open}>
      <div className="sheet-scrim" onClick={onClose} />
      <div
        className={`sheet${dragY > 0 ? ' dragging' : ''}`}
        style={dragY > 0 ? { transform: `translateY(${dragY}px)` } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        <div
          className="sheet-handle-hit"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="sheet-handle" />
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
