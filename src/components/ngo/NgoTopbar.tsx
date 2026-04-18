import { Bell, HelpCircle, Search, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface NgoTopbarProps {
  orgName: string;
  roleLabel?: string;
  searchValue: string;
  onSearchChange: (v: string) => void;
}

export default function NgoTopbar({ orgName, roleLabel = 'Regional Admin', searchValue, onSearchChange }: NgoTopbarProps) {
  return (
    <div className="sticky top-16 z-10 bg-[#F7FAF9]/80 backdrop-blur border-b border-slate-100">
      <div className="max-w-[1400px] mx-auto px-8 py-4 flex items-center gap-4">
        <div className="flex-1" />

        <div className="hidden lg:flex items-center gap-2 bg-white border border-slate-100 rounded-full px-3 py-2 w-[520px] shadow-sm">
          <Search className="h-4 w-4 text-slate-400" />
          <Input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search donations or retailers..."
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-7 px-2"
          />
        </div>

        <button className="h-10 w-10 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 shadow-sm">
          <Bell className="h-4 w-4" />
        </button>
        <button className="h-10 w-10 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 shadow-sm">
          <HelpCircle className="h-4 w-4" />
        </button>
        <button className="h-10 w-10 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 shadow-sm">
          <Settings className="h-4 w-4" />
        </button>

        <div className="h-10 px-3 rounded-full bg-white border border-slate-100 flex items-center gap-2 shadow-sm">
          <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-extrabold">
            {(orgName || 'N')[0]?.toUpperCase()}
          </div>
          <div className="leading-tight">
            <div className="text-sm font-extrabold text-slate-900 max-w-[180px] truncate">{orgName}</div>
            <div className="text-[10px] font-bold text-slate-400 -mt-0.5">{roleLabel}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

