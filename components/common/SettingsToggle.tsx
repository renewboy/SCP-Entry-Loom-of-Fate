import React from 'react';

interface SettingsToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
  /** Track color when on; the in-game menu follows the stability theme */
  activeClassName?: string;
}

const SettingsToggle: React.FC<SettingsToggleProps> = ({ checked, onChange, ariaLabel, activeClassName = 'bg-scp-accent' }) => (
  <button
    type="button"
    aria-pressed={checked}
    aria-label={ariaLabel}
    onClick={() => onChange(!checked)}
    className={`w-11 h-5 rounded-full p-0.5 transition-colors duration-300 ease-in-out relative ${checked ? activeClassName : 'bg-gray-700'}`}
  >
    <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${checked ? 'translate-x-6' : 'translate-x-0'}`}></div>
  </button>
);

export default SettingsToggle;
