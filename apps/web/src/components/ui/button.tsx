import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:ring-offset-1 focus:ring-offset-surface-0 disabled:opacity-40 disabled:pointer-events-none',
          {
            'bg-accent-cyan text-surface-0 hover:bg-cyan-300 active:bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.15)]': variant === 'primary',
            'bg-surface-3 text-text-primary border border-edge hover:bg-surface-4 hover:border-edge-strong': variant === 'secondary',
            'text-text-secondary hover:text-text-primary hover:bg-surface-3': variant === 'ghost',
            'bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 hover:text-red-300': variant === 'danger',
          },
          {
            'px-2.5 py-1 text-xs gap-1.5': size === 'sm',
            'px-3.5 py-1.5 text-sm gap-2': size === 'md',
            'px-5 py-2.5 text-sm gap-2': size === 'lg',
          },
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
