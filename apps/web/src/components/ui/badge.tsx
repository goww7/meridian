import { cn } from '../../lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
  dotColor?: string;
}

export function Badge({ children, className, dot, dotColor }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium tracking-wide uppercase',
      !className && 'bg-surface-3 text-text-secondary',
      className,
    )}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotColor || 'bg-current')} />}
      {children}
    </span>
  );
}
