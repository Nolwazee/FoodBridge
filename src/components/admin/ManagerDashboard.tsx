import { useMemo, useState } from 'react';
import type { UserProfile } from '@/src/types';
import DonationsOverview from './DonationsOverview';
import AdminReports from './AdminReports';
import AuditLogViewer from './AuditLogViewer';
import UserManagement from './UserManagement';
import VerificationQueue from './VerificationQueue';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Boxes,
  ClipboardList,
  Users,
  BarChart3,
  Search,
  Bell,
  Settings,
  LogOut,
  Leaf,
} from 'lucide-react';

type ManagerSectionId = 'overview' | 'inventory' | 'queue' | 'partners' | 'reports';

export default function ManagerDashboard({ profile }: { profile: UserProfile }) {
  const [activeTopTab, setActiveTopTab] = useState<'dashboard' | 'analytics' | 'inventory' | 'donations'>('dashboard');
  const [section, setSection] = useState<ManagerSectionId>('overview');
  const [search, setSearch] = useState('');
  const canManageDonations = profile.role === 'admin';

  const menuItems = useMemo(
    () =>
      [
        { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
        { id: 'inventory' as const, label: 'Live Inventory', icon: Boxes },
        { id: 'queue' as const, label: 'Donation Queue', icon: ClipboardList },
        { id: 'partners' as const, label: 'Retail Partners', icon: Users },
        { id: 'reports' as const, label: 'Reports', icon: BarChart3 },
      ],
    []
  );

  const metrics = useMemo(
    () => [
      {
        label: 'Total Food Saved',
        value: '12,840',
        suffix: 'kg',
        hint: '+12.5% this month',
        color: 'text-emerald-700',
        chip: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      },
      {
        label: 'Active Listings',
        value: '42',
        hint: '5 expiring soon',
        color: 'text-slate-900',
        chip: 'bg-amber-50 text-amber-700 border-amber-100',
      },
      {
        label: 'Pending Pickups',
        value: '18',
        hint: '9 scheduled today',
        color: 'text-slate-900',
        chip: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      },
    ],
    []
  );

  const renderContent = () => {
    if (section === 'overview') {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {metrics.map((m) => (
              <div key={m.label} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">{m.label}</div>
                <div className={cn('mt-3 text-3xl font-extrabold tracking-tight', m.color)}>
                  {m.value}
                  {m.suffix ? <span className="text-base font-bold text-slate-500 ml-1">{m.suffix}</span> : null}
                </div>
                <div className="mt-3">
                  <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold', m.chip)}>
                    {m.hint}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-extrabold text-slate-900">Live Inventory</div>
                  <div className="text-sm text-slate-500 mt-1">Quick view of recent donation listings</div>
                </div>
                <Button variant="outline" className="rounded-xl" onClick={() => setSection('inventory')}>
                  View All
                </Button>
              </div>
              <div className="mt-5">
                <DonationsOverview adminId={profile.uid} allowActions={canManageDonations} />
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-extrabold text-slate-900">Recent Activity</div>
                    <div className="text-sm text-slate-500 mt-1">System actions and approvals</div>
                  </div>
                  <Badge variant="outline" className="rounded-full">
                    Live
                  </Badge>
                </div>
                <div className="mt-5">
                  <AuditLogViewer />
                </div>
              </div>

              <div className="rounded-2xl overflow-hidden border border-emerald-100 bg-gradient-to-br from-emerald-900 to-emerald-700 p-6 text-white shadow-sm">
                <div className="text-sm font-bold opacity-90">Partner Outreach</div>
                <div className="mt-2 text-xl font-extrabold leading-tight">Connect with more food banks to reduce waste</div>
                <div className="mt-2 text-sm text-white/80">Invite partners and track pickups across your network.</div>
                <Button className="mt-5 rounded-xl bg-white text-emerald-900 hover:bg-white/90">View Partners</Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (section === 'inventory') {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-extrabold text-slate-900">Live Inventory</div>
              <div className="text-sm text-slate-500 mt-1">All donation listings across the platform</div>
            </div>
          </div>
          <DonationsOverview adminId={profile.uid} allowActions={canManageDonations} />
        </div>
      );
    }

    if (section === 'queue') {
      return (
        <div className="space-y-4">
          <div>
            <div className="text-2xl font-extrabold text-slate-900">Donation Queue</div>
            <div className="text-sm text-slate-500 mt-1">Verify NGOs and manage platform onboarding</div>
          </div>
          <VerificationQueue adminId={profile.uid} />
        </div>
      );
    }

    if (section === 'partners') {
      return (
        <div className="space-y-4">
          <div>
            <div className="text-2xl font-extrabold text-slate-900">Retail Partners</div>
            <div className="text-sm text-slate-500 mt-1">Manage users, roles, and partner access</div>
          </div>
          <UserManagement adminId={profile.uid} />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div>
          <div className="text-2xl font-extrabold text-slate-900">Reports</div>
          <div className="text-sm text-slate-500 mt-1">Performance, collections, and exports</div>
        </div>
        <AdminReports />
      </div>
    );
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F7FAF9]">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-[260px] shrink-0 bg-white border-r border-slate-100 min-h-[calc(100vh-64px)] sticky top-16">
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-emerald-600 flex items-center justify-center">
                <Leaf className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-slate-900 leading-tight">FoodBridge</div>
                <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Hub Management</div>
              </div>
            </div>

            <nav className="mt-6 space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSection(item.id);
                      if (item.id === 'reports') setActiveTopTab('analytics');
                      else if (item.id === 'inventory') setActiveTopTab('inventory');
                      else if (item.id === 'queue') setActiveTopTab('donations');
                      else setActiveTopTab('dashboard');
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors',
                      active ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    )}
                  >
                    <Icon className={cn('h-4 w-4', active ? 'text-emerald-700' : 'text-slate-400')} />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="mt-8">
              <Button className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold h-11">
                + Create Donation
              </Button>
              <div className="mt-6 border-t border-slate-100 pt-4 space-y-1">
                <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900">
                  <Settings className="h-4 w-4 text-slate-400" /> Settings
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900">
                  <LogOut className="h-4 w-4 text-slate-400" /> Logout
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0">
          {/* Topbar */}
          <div className="sticky top-16 z-10 bg-[#F7FAF9]/80 backdrop-blur border-b border-slate-100">
            <div className="max-w-[1400px] mx-auto px-8 py-4 flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="text-xl font-extrabold text-slate-900">Dashboard</div>
                <div className="hidden md:flex items-center gap-2 text-sm font-bold text-slate-500">
                  <button
                    className={cn('px-3 py-1.5 rounded-full', activeTopTab === 'dashboard' && 'bg-white border border-slate-100 text-emerald-700')}
                    onClick={() => {
                      setActiveTopTab('dashboard');
                      setSection('overview');
                    }}
                  >
                    Dashboard
                  </button>
                  <button
                    className={cn('px-3 py-1.5 rounded-full', activeTopTab === 'analytics' && 'bg-white border border-slate-100 text-emerald-700')}
                    onClick={() => {
                      setActiveTopTab('analytics');
                      setSection('reports');
                    }}
                  >
                    Analytics
                  </button>
                  <button
                    className={cn('px-3 py-1.5 rounded-full', activeTopTab === 'inventory' && 'bg-white border border-slate-100 text-emerald-700')}
                    onClick={() => {
                      setActiveTopTab('inventory');
                      setSection('inventory');
                    }}
                  >
                    Inventory
                  </button>
                  <button
                    className={cn('px-3 py-1.5 rounded-full', activeTopTab === 'donations' && 'bg-white border border-slate-100 text-emerald-700')}
                    onClick={() => {
                      setActiveTopTab('donations');
                      setSection('queue');
                    }}
                  >
                    Donations
                  </button>
                </div>
              </div>

              <div className="flex-1" />

              <div className="hidden lg:flex items-center gap-2 bg-white border border-slate-100 rounded-full px-3 py-2 w-[420px] shadow-sm">
                <Search className="h-4 w-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search operations..."
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-7 px-2"
                />
              </div>

              <button className="h-10 w-10 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 shadow-sm">
                <Bell className="h-4 w-4" />
              </button>
              <button className="h-10 w-10 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 shadow-sm">
                <Settings className="h-4 w-4" />
              </button>
              <div className="h-10 px-3 rounded-full bg-white border border-slate-100 flex items-center gap-2 shadow-sm">
                <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-extrabold">
                  {(profile.displayName || profile.email || 'U')[0]?.toUpperCase()}
                </div>
                <div className="hidden sm:block text-sm font-bold text-slate-700 max-w-[180px] truncate">
                  {profile.organizationName || profile.displayName || profile.email}
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-[1400px] mx-auto px-8 py-8">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
