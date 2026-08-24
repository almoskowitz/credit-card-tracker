import './TapToggle.css';

interface TapToggleProps {
  checked: boolean;
  onToggle: () => void;
  /** aria-label when unchecked; "Undo" is used automatically when checked. */
  label: string;
  disabled?: boolean;
}

/** The 56px one-tap redemption toggle — spring-filled ring with a drawn checkmark. */
export function TapToggle({ checked, onToggle, label, disabled }: TapToggleProps) {
  return (
    <button
      type="button"
      className="tap-toggle"
      aria-pressed={checked}
      aria-label={checked ? 'Undo' : label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <span className="ring">
        <span className="fill" />
        <svg viewBox="0 0 18 18">
          <path d="M3.5 9.5l3.6 3.6L14.5 5.5" />
        </svg>
      </span>
    </button>
  );
}
