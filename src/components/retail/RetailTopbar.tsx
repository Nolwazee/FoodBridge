import { Bell, Search, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export type RetailTopTab = 'dashboard' | 'analytics' | 'logistics';

export default function RetailTopbar({
  activeTab,
  onTabChange,
  orgName,
}: {
  activeTab: RetailTopTab;
  onTabChange: (tab: RetailTopTab) => void;
  orgName?: string;
}) {
  const tabs: { id: RetailTopTab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'logistics', label: 'Logistics' },
  ];

  return (
    <div className="h-16 border-b bg-white sticky top-0 z-40">
      <div className="max-w-[1400px] mx-auto px-6 h-full flex items-center gap-6">
        <div className="flex-1">
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search analytics or inventory..."
              className="pl-10 rounded-full border-gray-100 bg-gray-50 focus-visible:ring-1 focus-visible:ring-[#2D9C75]"
            />
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={cn(
                'text-sm font-semibold pb-2 border-b-2 transition-colors',
                activeTab === t.id ? 'text-[#2D9C75] border-[#2D9C75]' : 'text-gray-500 border-transparent hover:text-gray-900'
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button className="h-9 w-9 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center hover:bg-gray-100">
            <Bell className="h-4 w-4 text-gray-500" />
          </button>
          <button className="h-9 w-9 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center hover:bg-gray-100">
            <Settings className="h-4 w-4 text-gray-500" />
          </button>
          <div className="flex items-center gap-3 pl-2 border-l border-gray-100">
            <Avatar className="h-8 w-8 border border-gray-200">
              <AvatarImage src="" />
              <AvatarFallback>{(orgName || 'R').slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="hidden lg:block leading-tight">
              <div className="text-xs font-bold text-gray-900">{orgName || 'Retailer'}</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Premium Retailer</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

