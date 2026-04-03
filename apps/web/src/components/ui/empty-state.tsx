import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { Button } from './button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 md:py-16 text-center">
      <div className="w-10 h-10 rounded-lg bg-surface-3 border border-edge flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-text-tertiary" />
      </div>
      <h3 className="text-sm font-medium text-text-primary">{title}</h3>
      {description && <p className="mt-1 text-xs text-text-tertiary max-w-sm">{description}</p>}
      {action && (
        <Button size="sm" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
