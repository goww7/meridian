import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { ArrowRight, AlertCircle } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<any>('/auth/login', { email, password });
      login(res.access_token, res.user, res.org);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-surface-0">
      {/* Branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-surface-1 border-r border-edge flex-col justify-between p-12 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-12">
            <div className="w-7 h-7 rounded-md bg-accent-cyan flex items-center justify-center">
              <span className="text-xs font-bold text-surface-0">M</span>
            </div>
            <span className="text-lg font-semibold text-text-primary tracking-tight">Meridian</span>
          </div>
          <h2 className="text-3xl font-semibold text-text-primary leading-tight max-w-md">
            The operating system for software delivery
          </h2>
          <p className="text-sm text-text-tertiary mt-4 max-w-md leading-relaxed">
            Unify planning, execution, governance, and compliance. Ship with confidence.
          </p>
        </div>

        <div className="relative z-10 space-y-3">
          {['Graph-native traceability', 'AI artifact generation', 'Policy-as-code governance'].map((feat) => (
            <div key={feat} className="flex items-center gap-2.5 text-xs text-text-secondary">
              <div className="w-1 h-1 rounded-full bg-accent-cyan" />
              {feat}
            </div>
          ))}
        </div>

        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-6 h-6 rounded-md bg-accent-cyan flex items-center justify-center">
              <span className="text-[10px] font-bold text-surface-0">M</span>
            </div>
            <span className="text-base font-semibold text-text-primary">Meridian</span>
          </div>

          <h1 className="text-lg font-semibold text-text-primary">Sign in</h1>
          <p className="text-xs text-text-tertiary mt-1 mb-6">Enter your credentials to access your workspace</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-surface-2 border border-edge rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-cyan/40 focus:border-accent-cyan/40 transition-colors"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-surface-2 border border-edge rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-cyan/40 focus:border-accent-cyan/40 transition-colors"
                placeholder="Enter password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
              {!loading && <ArrowRight className="w-3.5 h-3.5" />}
            </Button>

            <p className="text-center text-xs text-text-muted">
              No account?{' '}
              <Link to="/register" className="text-accent-cyan hover:text-cyan-300 transition-colors">
                Create one
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
