import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Spinner } from '../ui/spinner';

const TYPE_LINKS: Record<string, (id: string) => string> = {
  flow: (id) => `/flows/${id}`,
  artifact: (id) => `/flows/${id}`,
  requirement: (id) => `/flows/${id}`,
  task: (id) => `/flows/${id}`,
  evidence: (id) => `/flows/${id}`,
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

  // Cmd+K shortcut
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

  // Close on click outside
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

  // Group by type
  const grouped = results.reduce((acc: Record<string, any[]>, r: any) => {
    const type = r.entity_type || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(r);
    return acc;
  }, {});

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 bg-slate-800 rounded-md border border-slate-700 hover:border-slate-600 transition-colors"
      >
        <span>Search...</span>
        <kbd className="text-xs bg-slate-700 px-1.5 py-0.5 rounded">⌘K</kbd>
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 w-96 bg-white rounded-lg shadow-xl border border-slate-200 z-50">
          <div className="p-3 border-b border-slate-200">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search flows, artifacts, tasks..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-80 overflow-y-auto">
            {query.length < 2 ? (
              <p className="p-4 text-sm text-slate-400 text-center">Type at least 2 characters to search</p>
            ) : isLoading ? (
              <div className="p-4 flex justify-center">
                <Spinner />
              </div>
            ) : results.length === 0 ? (
              <p className="p-4 text-sm text-slate-400 text-center">No results found</p>
            ) : (
              Object.entries(grouped).map(([type, items]) => (
                <div key={type}>
                  <p className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase bg-slate-50">{type}</p>
                  {(items as any[]).map((item: any) => (
                    <button
                      key={item.id || item.entity_id}
                      onClick={() => handleSelect(item)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition-colors flex items-center justify-between"
                    >
                      <span className="font-medium text-slate-900 truncate">{item.title || item.name || item.entity_id}</span>
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
