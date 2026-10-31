import React from 'react';
import '../../styles/gameButton.css';

export type GameButtonVariant = 'primary' | 'secondary' | 'danger' | 'quiet' | 'icon';

interface GameButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GameButtonVariant;
  size?: 'md' | 'sm';
  block?: boolean;
  /** Shows a running line and blocks clicks while an action is in progress */
  loading?: boolean;
}

/** The one button style for everything in the game, so a new screen never invents its own */
const GameButton = React.forwardRef<HTMLButtonElement, GameButtonProps>(({
  variant = 'secondary',
  size = 'md',
  block = false,
  loading = false,
  className = '',
  type = 'button',
  disabled,
  children,
  ...rest
}, ref) => (
  <button
    ref={ref}
    type={type}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    className={[
      'gbtn',
      `gbtn-${variant}`,
      size === 'sm' && 'gbtn-sm',
      block && 'gbtn-block',
      className,
    ].filter(Boolean).join(' ')}
    {...rest}
  >
    {children}
    {loading && <span className="gbtn-run" aria-hidden="true"><i /></span>}
  </button>
));

GameButton.displayName = 'GameButton';

export default GameButton;
