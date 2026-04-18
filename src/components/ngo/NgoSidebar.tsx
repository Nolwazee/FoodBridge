import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Search,
  History,
  MapPinned,
  Users,
  FileText,
  Settings,
  HelpCircle,
  LogOut,
  Leaf,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export type NgoSectionId =
  | 'overview'
  | 'browse'
  | 'my-requests'
  | 'directions'
  | 'profile'
  | 'documents'
  | 'settings';

interface NgoSidebarProps {
  active: NgoSectionId;
  onChange: (id: NgoSectionId) => void;
  onNewRequest: () => void;
}

const items: { id: NgoSectionId; label: string; icon: any }[] = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'browse', label: 'Browse Food', icon: Search },
  { id: 'my-requests', label: 'My Requests', icon: History },
  { id: 'directions', label: 'Pickup Schedule', icon: MapPinned },
  { id: 'profile', label: 'NGO Profile', icon: Users },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function NgoSidebar({ active, onChange, onNewRequest }: NgoSidebarProps) {
  return (
    <aside className="w-[260px] shrink-0 bg-white border-r border-slate-100 min-h-[calc(100vh-64px)] sticky top-16">
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-emerald-600 flex items-center justify-center">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-extrabold text-slate-900 leading-tight">FoodBridge</div>
            <div className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">NGO Portal</div>
          </div>
        </div>

        <nav className="mt-6 space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChange(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors',
                  isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <Icon className={cn('h-4 w-4', isActive ? 'text-emerald-700' : 'text-slate-400')} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-8">
          <Button
            className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold h-11"
            onClick={onNewRequest}
          >
            <Plus className="h-4 w-4 mr-2" /> New Request
          </Button>

          <div className="mt-6 border-t border-slate-100 pt-4 space-y-1">
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900">
              <HelpCircle className="h-4 w-4 text-slate-400" /> Help Center
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900">
              <LogOut className="h-4 w-4 text-slate-400" /> Logout
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

