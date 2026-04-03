import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './lib/auth';
import { AppLayout } from './components/layout/app-layout';
import { LoginPage } from './pages/auth/login';
import { RegisterPage } from './pages/auth/register';
import { DashboardPage } from './pages/dashboard';
import { FlowListPage } from './pages/flows';
import { FlowDetailPage } from './pages/flows/detail';
import { PoliciesPage } from './pages/policies';
import { SettingsPage } from './pages/settings';
import { AuditPage } from './pages/audit';
import { AnalyticsPage } from './pages/analytics';
import { IntegrationsPage } from './pages/integrations';
import { ApprovalsPage } from './pages/approvals';
import { CompliancePage } from './pages/compliance';
import { NotFoundPage } from './pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<DashboardPage />} />
              <Route path="flows" element={<FlowListPage />} />
              <Route path="flows/:flowId/*" element={<FlowDetailPage />} />
              <Route path="policies" element={<PoliciesPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="integrations" element={<IntegrationsPage />} />
              <Route path="approvals" element={<ApprovalsPage />} />
              <Route path="compliance" element={<CompliancePage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: { background: '#1c1c20', border: '1px solid #363640', color: '#f4f4f5', fontSize: '13px' },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
