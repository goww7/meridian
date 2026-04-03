import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Spinner } from '../ui/spinner';
import { Search, ArrowRight } from 'lucide-react';

const TYPE_LINKS: Record<string, (id: string) => string> = {
  flow: (id) => `/flows/${id}`,
  artifact: (id) => `/flows/${id}`,
  requirement: (id) => `/flows/${id}`,
  task: (id) => `/flows/${id}`,
  evidence: (id) => `/flows/${id}`,
};

const TYPE_LABELS: Record<string, string> = {
  flow: 'Flows',
  artifact: 'Artifacts',
  requirement: 'Requirements',
  task: 'Tasks',
  evidence: 'Evidence',
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['search', query],
    queryFn: () => api.get<{ data: any[] }>(`/search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
  });

  const results = data?.data || [];

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function handleSelect(result: any) {
    const linkFn = TYPE_LINKS[result.entity_type];
    const path = linkFn ? linkFn(result.flow_id || result.entity_id || result.id) : '/';
    navigate(path);
    setOpen(false);
    setQuery('');
  }

  const grouped = results.reduce((acc: Record<string, any[]>, r: any) => {
    const type = r.entity_type || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(r);
    return acc;
  }, {});

  return (
    <div ref={containerRef} className="relative flex-1 max-w-xs sm:max-w-sm md:max-w-md">
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
        className="flex items-center gap-2 px-2.5 py-1 text-xs text-text-muted bg-surface-2 rounded-md border border-edge hover:border-edge-strong transition-colors w-full"
      >
        <Search className="w-3 h-3 shrink-0" />
        <span className="flex-1 text-left truncate">Search...</span>
        <kbd className="hidden sm:inline text-[10px] font-mono bg-surface-3 px-1.5 py-0.5 rounded border border-edge text-text-muted">⌘K</kbd>
      </button>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 right-0 sm:right-auto sm:w-[400px] bg-surface-1 rounded-lg border border-edge shadow-xl shadow-black/40 z-50 animate-slide-down overflow-hidden">
          <div className="p-2 border-b border-edge">
            <div className="flex items-center gap-2 px-2">
              <Search className="w-3.5 h-3.5 text-text-muted shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search flows, artifacts, tasks..."
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none py-1.5"
              />
              {isLoading && <Spinner className="h-3 w-3" />}
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {query.length < 2 ? (
              <p className="px-4 py-6 text-xs text-text-muted text-center">Type to search across all entities</p>
            ) : results.length === 0 && !isLoading ? (
              <p className="px-4 py-6 text-xs text-text-muted text-center">No results found</p>
            ) : (
              Object.entries(grouped).map(([type, items]) => (
                <div key={type}>
                  <p className="px-3 py-1.5 text-[10px] font-medium text-text-muted uppercase tracking-wider bg-surface-2">
                    {TYPE_LABELS[type] || type}
                  </p>
                  {(items as any[]).map((item: any) => (
                    <button
                      key={item.id || item.entity_id}
                      onClick={() => handleSelect(item)}
                      className="w-full text-left px-3 py-2.5 hover:bg-surface-2 transition-colors flex items-center justify-between group"
                    >
                      <div className="min-w-0">
                        <p className="text-text-primary text-xs truncate">{item.title || item.name || item.entity_id}</p>
                        {item.flow_title && <p className="text-[10px] text-text-muted truncate">in {item.flow_title}</p>}
                        {item.status && <span className="text-[10px] text-text-muted">{item.status}</span>}
                      </div>
                      <ArrowRight className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
