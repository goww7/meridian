import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { Card } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';
import { Tabs } from '../../components/ui/tabs';
import { MembersSection } from './members';
import { TeamsSection } from './teams';
import { ApiKeysSection } from './api-keys';
import { SsoSection } from './sso';
import { WebhooksSection } from './webhooks';
import { Building2, User } from 'lucide-react';

const SETTINGS_TABS = [
  { id: 'general', label: 'General' },
  { id: 'members', label: 'Members' },
  { id: 'teams', label: 'Teams' },
  { id: 'api-keys', label: 'API Keys' },
  { id: 'sso', label: 'SSO' },
  { id: 'webhooks', label: 'Webhooks' },
];

export function SettingsPage() {
  const { user, org } = useAuth();
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div>
      <PageHeader title="Settings" description="Manage your organization, teams, and account" />
      <Tabs tabs={SETTINGS_TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'general' && (
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-md bg-surface-3 border border-edge flex items-center justify-center"><Building2 className="w-4 h-4 text-text-muted" /></div>
              <h2 className="text-sm font-medium text-text-primary">Organization</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><p className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-1">Name</p><p className="text-sm text-text-primary">{org?.name}</p></div>
              <div><p className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-1">Slug</p><p className="text-sm text-text-secondary font-mono">{org?.slug}</p></div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-md bg-surface-3 border border-edge flex items-center justify-center"><User className="w-4 h-4 text-text-muted" /></div>
              <h2 className="text-sm font-medium text-text-primary">Account</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><p className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-1">Name</p><p className="text-sm text-text-primary">{user?.name}</p></div>
              <div><p className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-1">Email</p><p className="text-sm text-text-secondary">{user?.email}</p></div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'members' && <MembersSection />}
      {activeTab === 'teams' && <TeamsSection />}
      {activeTab === 'api-keys' && <ApiKeysSection />}
      {activeTab === 'sso' && <SsoSection />}
      {activeTab === 'webhooks' && <WebhooksSection />}
    </div>
  );
}
