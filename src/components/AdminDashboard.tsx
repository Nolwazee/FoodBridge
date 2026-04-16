import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, query, onSnapshot, updateDoc, doc, orderBy } from 'firebase/firestore';
import { UserProfile } from '@/src/types';
import Sidebar from './Sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminDashboard({ profile }: { profile: UserProfile }) {
  const [activeTab, setActiveTab] = useState('flagged');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, []);

  const handleVerify = async (userId: string, status: 'verified' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        verificationStatus: status,
        isVerified: status === 'verified'
      });
      toast.success(`NGO ${status} successfully`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const renderFlaggedActivity = () => (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Flagged Activity</h1>
        <p className="text-sm text-gray-500 mt-1">Review and handle flagged transactions and activities</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'High Severity', value: '1', color: 'text-red-600' },
          { label: 'Under Investigation', value: '1', color: 'text-amber-600' },
          { label: 'Resolved', value: '0', color: 'text-emerald-600' },
        ].map((stat, i) => (
          <Card key={i} className="border-gray-100 shadow-sm">
            <CardContent className="p-6">
              <div className="text-xs font-medium text-gray-400 mb-2">{stat.label}</div>
              <div className={stat.color + " text-2xl font-bold"}>{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        {[
          { 
            id: 1, 
            type: 'Expired Food Claim', 
            severity: 'HIGH', 
            status: 'Investigating', 
            desc: 'A user attempted to claim food after the safe handling window.',
            user: 'sarah@ngo.org',
            date: '4/12/2026',
            icon: XCircle,
            iconColor: 'text-red-500',
            borderColor: 'border-red-100',
            action: 'Resolve'
          },
          { 
            id: 2, 
            type: 'Duplicate Delivery Photos', 
            severity: 'MEDIUM', 
            status: 'Open', 
            desc: 'Two pickups were completed with identical photo evidence.',
            user: 'mike@store.com',
            date: '4/11/2026',
            icon: AlertTriangle,
            iconColor: 'text-amber-500',
            borderColor: 'border-amber-100',
            action: 'Investigate'
          }
        ].map(item => (
          <div key={item.id} className={`bg-white p-6 rounded-xl border ${item.borderColor} shadow-sm flex items-start gap-4`}>
            <div className={`p-2 rounded-lg bg-gray-50 ${item.iconColor}`}>
              <item.icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <span className="font-bold text-gray-900">{item.type}</span>
                <Badge variant="outline" className="text-[10px] font-bold text-red-600 border-red-100 bg-red-50">{item.severity}</Badge>
                <Badge variant="outline" className="text-[10px] font-bold text-amber-600 border-amber-100 bg-amber-50">{item.status}</Badge>
              </div>
              <p className="text-sm text-gray-500 mb-2">{item.desc}</p>
              <p className="text-xs text-gray-400">User: {item.user} | Flagged: {item.date}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-lg h-9 px-4 text-xs font-bold border-gray-100">
                More Info
              </Button>
              <Button className="bg-[#2D9C75] hover:bg-[#258563] text-white rounded-lg h-9 px-4 text-xs font-bold">
                {item.action}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const pendingNGOs = users.filter(u => u.role === 'ngo' && u.verificationStatus === 'pending');

  return (
    <div className="flex min-h-[calc(100vh-64px)] bg-[#F8FAFA]">
      <Sidebar role="admin" activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'flagged' && renderFlaggedActivity()}
        
        {activeTab === 'verification' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">NGO Verification</h1>
              <p className="text-sm text-gray-500 mt-1">Review and approve NGO applications</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {pendingNGOs.length > 0 ? pendingNGOs.map(ngo => (
                <Card key={ngo.uid} className="border-gray-100 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{ngo.organizationName}</CardTitle>
                    <div className="text-sm text-gray-500 space-y-1">
                      <p>Email: {ngo.email}</p>
                      <p>Reg No: {ngo.registrationNumber}</p>
                      <p>Address: {ngo.address}</p>
                    </div>
                  </CardHeader>
                  <CardContent className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => handleVerify(ngo.uid, 'rejected')}
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                    <Button 
                      size="sm" 
                      className="bg-[#2D9C75] hover:bg-[#258563] text-white"
                      onClick={() => handleVerify(ngo.uid, 'verified')}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" /> Approve
                    </Button>
                  </CardContent>
                </Card>
              )) : (
                <div className="p-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-400">
                  No pending verifications.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
