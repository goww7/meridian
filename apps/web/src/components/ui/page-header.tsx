interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4 md:mb-6">
      <div className="min-w-0">
        <h1 className="text-base md:text-lg font-semibold text-text-primary">{title}</h1>
        {description && <p className="text-xs text-text-tertiary mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
