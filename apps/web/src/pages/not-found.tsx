import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowLeft } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-12 md:py-24 text-center px-4">
      <p className="text-5xl md:text-6xl font-mono font-bold text-text-muted mb-2">404</p>
      <p className="text-sm text-text-tertiary mb-6">This page doesn't exist.</p>
      <Link to="/">
        <Button size="sm" variant="secondary">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </Button>
      </Link>
    </div>
  );
}
