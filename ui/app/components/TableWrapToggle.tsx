import React from 'react';

type TableWrapToggleProps = {
  wrapText: boolean;
  onToggle: (next: boolean) => void;
};

export function TableWrapToggle({ wrapText, onToggle }: TableWrapToggleProps) {
  return (
    <button
      type="button"
      className="secondary-button"
      onClick={() => onToggle(!wrapText)}
      aria-pressed={wrapText}
    >
      {wrapText ? 'Unwrap text' : 'Wrap text'}
    </button>
  );
}
