import { cn } from '../../lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
  active?: boolean;
}

export function Card({ children, className, onClick, hover, active }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface-1 rounded-lg border border-edge',
        hover && 'cursor-pointer transition-all duration-150 hover:border-edge-strong hover:bg-surface-2',
        active && 'ring-1 ring-accent-cyan/40 border-accent-cyan/30',
        onClick && 'cursor-pointer',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
