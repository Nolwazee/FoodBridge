import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Package, 
  History, 
  Star, 
  Settings, 
  ShieldCheck, 
  Users, 
  AlertTriangle, 
  FileText,
  Search,
  CheckCircle2,
  Leaf,
  Calendar,
  MapPinned,
  BarChart3,
  ClipboardList
} from 'lucide-react';

interface SidebarProps {
  role: 'admin' | 'donor' | 'ngo';
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Sidebar({ role, activeTab, onTabChange }: SidebarProps) {
  const menuItems = {
    admin: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'verification', label: 'NGO Verification', icon: ShieldCheck },
      { id: 'users', label: 'User Management', icon: Users },
      { id: 'donations', label: 'All Donations', icon: Package },
      { id: 'reports', label: 'Reports', icon: BarChart3 },
      { id: 'flagged', label: 'Flagged Activity', icon: AlertTriangle },
      { id: 'audit', label: 'Audit Logs', icon: FileText },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
    donor: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'my-listings', label: 'My Listings', icon: Package },
      { id: 'requests', label: 'NGO Requests', icon: ClipboardList },
      { id: 'pickup-schedule', label: 'Pickup Schedule', icon: Calendar },
      { id: 'history', label: 'Donation History', icon: History },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
    ngo: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'browse', label: 'Browse Food', icon: Search },
      { id: 'my-requests', label: 'My Requests', icon: History },
      { id: 'directions', label: 'Pickup Directions', icon: MapPinned },
      { id: 'profile', label: 'NGO Profile', icon: Users },
      { id: 'documents', label: 'Document Manager', icon: FileText },
      { id: 'verification', label: 'Verification Status', icon: CheckCircle2 },
      { id: 'settings', label: 'Settings', icon: Settings },
    ]
  };

  const currentMenu = menuItems[role];

  return (
    <div className="w-64 bg-white border-r border-gray-100 flex flex-col h-[calc(100vh-64px)] sticky top-16">
      <div className="p-6">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">
          {role.toUpperCase()} DASHBOARD
        </div>
        <nav className="space-y-1">
          {currentMenu.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                activeTab === item.id
                  ? "bg-[#E9F5F1] text-[#2D9C75]"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className={cn("h-4 w-4", activeTab === item.id ? "text-[#2D9C75]" : "text-gray-400")} />
              {item.label}
            </button>
          ))}
        </nav>
      </div>
      
      <div className="mt-auto p-6 border-t border-gray-50">
        <div className="flex items-center gap-2 text-[#2D9C75]">
          <Leaf className="h-4 w-4" />
          <span className="text-xs font-bold tracking-tight">FoodBridge</span>
        </div>
      </div>
    </div>
  );
}
