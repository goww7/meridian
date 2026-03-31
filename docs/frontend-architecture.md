# Meridian — Frontend Architecture

## Overview

The Meridian frontend is a React 18 SPA built with TypeScript, Vite, TailwindCSS, and React Query. It provides the primary UI for managing delivery flows, viewing traceability graphs, editing artifacts, and configuring policies.

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| React 18 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool and dev server |
| TailwindCSS | Utility-first styling |
| React Router v6 | Client-side routing |
| React Query (TanStack Query) | Server state management, caching |
| Zustand | Minimal client state (UI state only) |
| React Flow | Graph/traceability visualization |
| Radix UI | Accessible, unstyled component primitives |
| React Hook Form + Zod | Form handling and validation |
| Sonner | Toast notifications |
| date-fns | Date formatting |

## Project Structure

```
apps/web/src/
├── main.tsx                    # App entry point
├── app.tsx                     # Root component (providers, router)
├── api/                        # API client layer
│   ├── client.ts               # Fetch wrapper with auth, error handling
│   ├── flows.ts                # Flow API functions
│   ├── artifacts.ts            # Artifact API functions
│   ├── policies.ts             # Policy API functions
│   ├── evidence.ts             # Evidence API functions
│   ├── orgs.ts                 # Org API functions
│   ├── teams.ts                # Team API functions
│   ├── integrations.ts         # Integration API functions
│   └── types.ts                # API response types (re-exports from shared)
├── hooks/                      # Custom React hooks
│   ├── use-auth.ts             # Auth context hook
│   ├── use-flow.ts             # Flow query hooks (useFlow, useFlows, etc.)
│   ├── use-artifacts.ts        # Artifact query hooks
│   ├── use-policies.ts         # Policy query hooks
│   ├── use-evidence.ts         # Evidence query hooks
│   ├── use-websocket.ts        # WebSocket connection hook
│   └── use-debounce.ts         # Utility hooks
├── pages/                      # Route pages
│   ├── auth/
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── dashboard/
│   │   └── index.tsx           # Org dashboard with flow overview
│   ├── flows/
│   │   ├── index.tsx           # Flow list with filters
│   │   ├── [flowId]/
│   │   │   ├── index.tsx       # Flow detail (overview tab)
│   │   │   ├── trace.tsx       # Traceability graph view
│   │   │   ├── artifacts.tsx   # Artifacts list and viewer
│   │   │   ├── requirements.tsx # Requirements list
│   │   │   ├── tasks.tsx       # Task board
│   │   │   ├── evidence.tsx    # Evidence list
│   │   │   └── readiness.tsx   # Release readiness dashboard
│   ├── policies/
│   │   ├── index.tsx           # Policy list
│   │   └── [policyId].tsx      # Policy editor
│   ├── settings/
│   │   ├── index.tsx           # General settings
│   │   ├── members.tsx         # Org members
│   │   ├── teams.tsx           # Teams
│   │   └── integrations.tsx    # Integration settings
│   └── not-found.tsx
├── components/
│   ├── ui/                     # Design system primitives
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── badge.tsx
│   │   ├── card.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   ├── tooltip.tsx
│   │   ├── skeleton.tsx
│   │   ├── avatar.tsx
│   │   └── separator.tsx
│   ├── layout/
│   │   ├── app-layout.tsx      # Main layout with sidebar
│   │   ├── sidebar.tsx         # Navigation sidebar
│   │   ├── header.tsx          # Top bar with user menu
│   │   └── breadcrumbs.tsx
│   ├── flow/
│   │   ├── flow-card.tsx       # Flow summary card for lists
│   │   ├── flow-stage-badge.tsx # Stage indicator (assess/plan/build/release)
│   │   ├── flow-stage-timeline.tsx # Visual stage progression
│   │   ├── flow-create-dialog.tsx
│   │   ├── flow-transition-dialog.tsx # Stage advance with gate results
│   │   └── flow-filters.tsx    # Filter bar for flow list
│   ├── artifact/
│   │   ├── artifact-viewer.tsx # Rendered artifact content
│   │   ├── artifact-editor.tsx # Edit artifact (markdown/structured)
│   │   ├── artifact-diff.tsx   # Version diff view
│   │   ├── artifact-generate-dialog.tsx
│   │   └── artifact-approve-dialog.tsx
│   ├── graph/
│   │   ├── trace-graph.tsx     # React Flow traceability graph
│   │   ├── graph-node.tsx      # Custom node renderer
│   │   ├── graph-edge.tsx      # Custom edge renderer
│   │   └── graph-controls.tsx  # Zoom, fit, layout controls
│   ├── policy/
│   │   ├── policy-builder.tsx  # Visual policy rule builder
│   │   ├── policy-preview.tsx  # Policy preview/dry-run
│   │   └── gate-result.tsx     # Gate evaluation result display
│   ├── evidence/
│   │   ├── evidence-card.tsx   # Evidence item display
│   │   ├── evidence-submit-dialog.tsx
│   │   └── readiness-matrix.tsx # Requirements × evidence matrix
│   └── common/
│       ├── empty-state.tsx     # Empty state illustrations
│       ├── error-boundary.tsx
│       ├── loading.tsx
│       └── confirm-dialog.tsx
├── stores/
│   └── ui-store.ts             # Zustand store for UI state (sidebar collapsed, etc.)
├── lib/
│   ├── auth-provider.tsx       # Auth context with token management
│   ├── query-provider.tsx      # React Query client configuration
│   ├── websocket-provider.tsx  # WebSocket connection management
│   ├── routes.tsx              # Route definitions
│   └── utils.ts                # classNames helper, formatters
└── styles/
    └── globals.css             # Tailwind directives and global styles
```

## Routing

```typescript
// lib/routes.tsx
const routes = [
  // Public
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },

  // Protected (requires auth)
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/flows', element: <FlowListPage /> },
      { path: '/flows/:flowId', element: <FlowDetailPage /> },
      { path: '/flows/:flowId/trace', element: <FlowTracePage /> },
      { path: '/flows/:flowId/artifacts', element: <FlowArtifactsPage /> },
      { path: '/flows/:flowId/requirements', element: <FlowRequirementsPage /> },
      { path: '/flows/:flowId/tasks', element: <FlowTasksPage /> },
      { path: '/flows/:flowId/evidence', element: <FlowEvidencePage /> },
      { path: '/flows/:flowId/readiness', element: <FlowReadinessPage /> },
      { path: '/policies', element: <PolicyListPage /> },
      { path: '/policies/:policyId', element: <PolicyEditorPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/settings/members', element: <MembersPage /> },
      { path: '/settings/teams', element: <TeamsPage /> },
      { path: '/settings/integrations', element: <IntegrationsPage /> },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
];
```

## State Management

### Server State (React Query)

All server data is managed by React Query. No client-side duplication.

```typescript
// hooks/use-flow.ts
export function useFlows(filters?: FlowFilters) {
  return useQuery({
    queryKey: ['flows', filters],
    queryFn: () => api.flows.list(filters),
  });
}

export function useFlow(flowId: string) {
  return useQuery({
    queryKey: ['flows', flowId],
    queryFn: () => api.flows.get(flowId),
  });
}

export function useCreateFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.flows.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows'] });
    },
  });
}

export function useTransitionFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ flowId, toStage, reason }: TransitionParams) =>
      api.flows.transition(flowId, toStage, reason),
    onSuccess: (_, { flowId }) => {
      queryClient.invalidateQueries({ queryKey: ['flows', flowId] });
      queryClient.invalidateQueries({ queryKey: ['flows'] });
    },
  });
}
```

### Client State (Zustand)

Minimal client-only state:

```typescript
// stores/ui-store.ts
interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  selectedGraphNodes: string[];
  setSelectedGraphNodes: (ids: string[]) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  selectedGraphNodes: [],
  setSelectedGraphNodes: (ids) => set({ selectedGraphNodes: ids }),
}));
```

## API Client

```typescript
// api/client.ts
class ApiClient {
  private baseUrl: string;
  private getToken: () => string | null;

  async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const token = this.getToken();
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new ApiError(error);
    }

    if (response.status === 204) return undefined as T;
    return response.json();
  }

  get<T>(path: string) { return this.fetch<T>(path); }
  post<T>(path: string, body: any) { return this.fetch<T>(path, { method: 'POST', body: JSON.stringify(body) }); }
  patch<T>(path: string, body: any) { return this.fetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }); }
  delete(path: string) { return this.fetch(path, { method: 'DELETE' }); }
}
```

## WebSocket Integration

Real-time updates are pushed via WebSocket:

```typescript
// lib/websocket-provider.tsx
function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;

    const ws = new WebSocket(`${WS_URL}?token=${token}`);

    ws.onmessage = (event) => {
      const { event: eventType, data } = JSON.parse(event.data);

      // Invalidate relevant queries based on event type
      switch (eventType) {
        case 'flow.stage_changed':
          queryClient.invalidateQueries({ queryKey: ['flows', data.flow_id] });
          break;
        case 'artifact.generated':
          queryClient.invalidateQueries({ queryKey: ['artifacts', data.artifact_id] });
          queryClient.invalidateQueries({ queryKey: ['jobs', data.job_id] });
          break;
        case 'evidence.collected':
          queryClient.invalidateQueries({ queryKey: ['evidence', { flowId: data.flow_id }] });
          break;
      }
    };

    return () => ws.close();
  }, [token]);

  return children;
}
```

## Key Pages

### Dashboard

- Flow count by stage (bar chart)
- Recent flows (list)
- Pending approvals (for admins)
- Team activity feed

### Flow Detail

Tabbed layout:
- **Overview** — Title, stage timeline, counts, metadata
- **Traceability** — Interactive graph (React Flow)
- **Artifacts** — List with generate/view/approve actions
- **Requirements** — Table with status, priority, acceptance criteria
- **Tasks** — Kanban board (todo / in progress / review / done)
- **Evidence** — Evidence list grouped by type
- **Readiness** — Release readiness matrix (requirements × evidence)

### Traceability Graph

Interactive graph using React Flow:

```
[Initiative] ──▶ [Objective] ──▶ [Requirement] ──▶ [Task] ──▶ [Evidence]
```

- Nodes colored by entity type
- Edges show relationship type
- Click node to see details panel
- Highlight incomplete chains (gap detection)
- Filter by status, type
- Auto-layout with dagre algorithm

### Readiness Matrix

Table showing requirements vs. evidence coverage:

```
Requirement          | Tests | Security | Review | Status
─────────────────────┼───────┼──────────┼────────┼────────
Encrypt PII at rest  |  ✅   |    ✅    |   ✅   | Ready
Async payments       |  ✅   |    ⬜    |   ✅   | Partial
Audit logging        |  ⬜   |    ⬜    |   ⬜   | Missing
```

## Design System

Built on Radix UI primitives + Tailwind CSS:

- **Colors:** Slate (neutrals), Blue (primary), Green (success), Red (danger), Amber (warning)
- **Typography:** Inter (sans-serif), JetBrains Mono (monospace)
- **Spacing:** 4px grid (Tailwind default)
- **Radius:** 6px default (rounded-md)
- **Shadows:** Minimal, subtle elevation

### Stage Colors

```css
assess:  bg-purple-100 text-purple-700
plan:    bg-blue-100 text-blue-700
build:   bg-amber-100 text-amber-700
release: bg-green-100 text-green-700
done:    bg-slate-100 text-slate-700
```

### Priority Colors

```css
low:      bg-slate-100 text-slate-600
medium:   bg-blue-100 text-blue-600
high:     bg-amber-100 text-amber-600
critical: bg-red-100 text-red-600
```

## Build & Deploy

```json
// vite.config.ts
{
  "server": { "port": 5173, "proxy": { "/api": "http://localhost:3001" } },
  "build": { "outDir": "dist", "sourcemap": true }
}
```

- Dev: Vite dev server with API proxy
- Production: Static build → served from CDN or nginx
- Environment variables: `VITE_API_URL`, `VITE_WS_URL`
