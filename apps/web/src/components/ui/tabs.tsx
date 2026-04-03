import { cn } from '../../lib/utils';

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex gap-0.5 border-b border-edge mb-4 md:mb-6 overflow-x-auto scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'px-2.5 sm:px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0',
            active === tab.id
              ? 'border-accent-cyan text-text-primary'
              : 'border-transparent text-text-tertiary hover:text-text-secondary',
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn(
              'ml-1.5 px-1.5 py-0.5 rounded text-[10px] tabular-nums',
              active === tab.id ? 'bg-accent-cyan/15 text-accent-cyan' : 'bg-surface-3 text-text-muted',
            )}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
