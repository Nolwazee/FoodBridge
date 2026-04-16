import { cn } from '@/lib/utils';
import { Leaf, LayoutDashboard, Package, History, BarChart3, Users, Plus, HelpCircle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { auth } from '@/src/lib/firebase';
import { signOut } from 'firebase/auth';

export type RetailSectionId = 'overview' | 'inventory' | 'donation-history' | 'impact-reports' | 'team';

export default function RetailSidebar({
  active,
  onChange,
  onNewDonation,
}: {
  active: RetailSectionId;
  onChange: (id: RetailSectionId) => void;
  onNewDonation: () => void;
}) {
  const items: { id: RetailSectionId; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'donation-history', label: 'Donation History', icon: History },
    { id: 'impact-reports', label: 'Impact Reports', icon: BarChart3 },
    { id: 'team', label: 'Team', icon: Users },
  ];

  return (
    <aside className="w-72 bg-white border-r border-gray-100 flex flex-col h-[calc(100vh-64px)] sticky top-16">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="bg-[#2D9C75] p-1.5 rounded-lg">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#1A2B2B] leading-tight">FoodBridge</div>
            <div className="text-[11px] text-gray-500 -mt-0.5">Retailer Portal</div>
          </div>
        </div>

        <nav className="space-y-1">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                active === item.id ? 'bg-[#E9F5F1] text-[#2D9C75]' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon className={cn('h-4 w-4', active === item.id ? 'text-[#2D9C75]' : 'text-gray-400')} />
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="px-6">
        <Button
          onClick={onNewDonation}
          className="w-full bg-[#2D9C75] hover:bg-[#258563] text-white rounded-xl h-11 font-bold gap-2"
        >
          <Plus className="h-4 w-4" /> New Donation
        </Button>
      </div>

      <div className="mt-auto p-6 border-t border-gray-50 space-y-2">
        <button className="w-full flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900">
          <HelpCircle className="h-4 w-4 text-gray-400" />
          Help Center
        </button>
        <button
          onClick={() => signOut(auth)}
          className="w-full flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
        >
          <LogOut className="h-4 w-4 text-gray-400" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

