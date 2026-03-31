import { useAuth } from '../../lib/auth';
import { Card } from '../../components/ui/card';

export function SettingsPage() {
  const { user, org } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Organization</h2>
          <div className="space-y-2 text-sm">
            <p><span className="text-slate-500">Name:</span> {org?.name}</p>
            <p><span className="text-slate-500">Slug:</span> {org?.slug}</p>
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Account</h2>
          <div className="space-y-2 text-sm">
            <p><span className="text-slate-500">Name:</span> {user?.name}</p>
            <p><span className="text-slate-500">Email:</span> {user?.email}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
