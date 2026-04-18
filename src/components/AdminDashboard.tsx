import { useState } from 'react';
import { UserProfile } from '@/src/types';
import Sidebar from './Sidebar';
import VerificationQueue from './admin/VerificationQueue';
import UserManagement from './admin/UserManagement';
import AdminReports from './admin/AdminReports';
import AuditLogViewer from './admin/AuditLogViewer';
import DonationsOverview from './admin/DonationsOverview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, Users, Package, BarChart3, FileText } from 'lucide-react';

export default function AdminDashboard({ profile }: { profile: UserProfile }) {
  const [activeTab, setActiveTab] = useState('verification');

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar role="admin" activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Portal</h1>
            <p className="text-gray-600 mt-1">Manage verifications, users, donations, and monitor platform activity</p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 bg-white border rounded-lg h-auto">
              <TabsTrigger value="verification" className="gap-2 flex flex-col sm:flex-row">
                <CheckCircle className="w-4 h-4" />
                <span className="hidden sm:inline text-xs sm:text-sm">Verification</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-2 flex flex-col sm:flex-row">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline text-xs sm:text-sm">Users</span>
              </TabsTrigger>
              <TabsTrigger value="donations" className="gap-2 flex flex-col sm:flex-row">
                <Package className="w-4 h-4" />
                <span className="hidden sm:inline text-xs sm:text-sm">Donations</span>
              </TabsTrigger>
              <TabsTrigger value="reports" className="gap-2 flex flex-col sm:flex-row">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline text-xs sm:text-sm">Reports</span>
              </TabsTrigger>
              <TabsTrigger value="audit" className="gap-2 flex flex-col sm:flex-row">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline text-xs sm:text-sm">Audit Log</span>
              </TabsTrigger>
            </TabsList>

            {/* Verification Queue Tab */}
            <TabsContent value="verification" className="mt-6">
              <VerificationQueue adminId={profile.uid} />
            </TabsContent>

            {/* User Management Tab */}
            <TabsContent value="users" className="mt-6">
              <UserManagement adminId={profile.uid} />
            </TabsContent>

            {/* Donations Overview Tab */}
            <TabsContent value="donations" className="mt-6">
              <DonationsOverview adminId={profile.uid} />
            </TabsContent>

            {/* Reports Tab */}
            <TabsContent value="reports" className="mt-6">
              <AdminReports />
            </TabsContent>

            {/* Audit Log Tab */}
            <TabsContent value="audit" className="mt-6">
              <AuditLogViewer />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
