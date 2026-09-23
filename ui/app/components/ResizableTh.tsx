import React, { useRef } from 'react';
import { useTranslation } from '../i18n/LanguageProvider';

const MIN_COLUMN_WIDTH = 72;
const KEYBOARD_STEP = 16;

type DragState = {
  startX: number;
  startColumnWidth: number;
  startTableWidth: number;
  table: HTMLTableElement;
  cell: HTMLTableCellElement;
};

export function ResizableTh({ children, className = '', ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  const { t } = useTranslation();
  const dragState = useRef<DragState | null>(null);

  function resizeColumn(cell: HTMLTableCellElement, delta: number, startColumnWidth = cell.getBoundingClientRect().width) {
    const table = cell.closest('table');
    if (table === null) return;

    const nextWidth = Math.max(MIN_COLUMN_WIDTH, startColumnWidth + delta);
    const appliedDelta = nextWidth - startColumnWidth;
    const parentWidth = table.parentElement?.clientWidth ?? 0;
    const nextTableWidth = Math.max(parentWidth, table.getBoundingClientRect().width + appliedDelta);

    cell.style.width = `${nextWidth}px`;
    cell.style.minWidth = `${nextWidth}px`;
    table.style.width = `${nextTableWidth}px`;
  }

  function handlePointerDown(event: React.PointerEvent<HTMLSpanElement>) {
    const cell = event.currentTarget.parentElement as HTMLTableCellElement;
    const table = cell.closest('table');
    if (table === null) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      startX: event.clientX,
      startColumnWidth: cell.getBoundingClientRect().width,
      startTableWidth: table.getBoundingClientRect().width,
      table,
      cell,
    };
    document.body.classList.add('is-resizing-column');
  }

  function handlePointerMove(event: React.PointerEvent<HTMLSpanElement>) {
    const state = dragState.current;
    if (state === null) return;

    const nextWidth = Math.max(MIN_COLUMN_WIDTH, state.startColumnWidth + event.clientX - state.startX);
    const delta = nextWidth - state.startColumnWidth;
    const parentWidth = state.table.parentElement?.clientWidth ?? 0;
    state.cell.style.width = `${nextWidth}px`;
    state.cell.style.minWidth = `${nextWidth}px`;
    state.table.style.width = `${Math.max(parentWidth, state.startTableWidth + delta)}px`;
  }

  function finishPointerResize(event: React.PointerEvent<HTMLSpanElement>) {
    if (dragState.current === null) return;
    dragState.current = null;
    document.body.classList.remove('is-resizing-column');
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLSpanElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const cell = event.currentTarget.parentElement as HTMLTableCellElement;
    resizeColumn(cell, event.key === 'ArrowRight' ? KEYBOARD_STEP : -KEYBOARD_STEP);
  }

  return (
    <th {...props} className={`resizable-header ${className}`.trim()}>
      {children}
      <span
        className="column-resizer"
        role="separator"
        aria-label={t('table.resizeColumn')}
        aria-orientation="vertical"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerResize}
        onPointerCancel={finishPointerResize}
        onKeyDown={handleKeyDown}
      />
    </th>
  );
}