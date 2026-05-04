declare module '*.css';

import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import './Button.css';

interface ButtonProps {
  children: ReactNode;
  to?: string;              // optional route to navigate to
  onClick?: () => void;     // optional click handler
  variant?: 'primary' | 'secondary' | 'accent';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
}

export function Button({
  children,
  to,
  onClick,
  variant = 'primary',
  size = 'medium',
  disabled = false,
}: ButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (disabled) return;
    if (onClick) onClick();
    if (to) navigate(to);
  };

  return (
    <button
      className={`btn btn-${variant} btn-${size}`}
      onClick={handleClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
