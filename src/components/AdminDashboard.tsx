import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, query, onSnapshot, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { UserProfile, FlaggedActivity } from '@/src/types';
import Sidebar from './Sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminDashboard({ profile }: { profile: UserProfile }) {
  const [activeTab, setActiveTab] = useState('flagged');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [flags, setFlags] = useState<FlaggedActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const qFlags = query(collection(db, 'flags'), orderBy('createdAt', 'desc'));
    const unsubscribeFlags = onSnapshot(qFlags, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FlaggedActivity));
      setFlags(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'flags');
    });

    return () => {
      unsubscribeUsers();
      unsubscribeFlags();
    };
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

  const handleResolveFlag = async (id: string) => {
    try {
      await updateDoc(doc(db, 'flags', id), { status: 'Resolved' });
      toast.success('Flag marked as resolved.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `flags/${id}`);
    }
  };

  const handleDismissFlag = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'flags', id));
      toast.success('Flag deleted from the system.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `flags/${id}`);
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
          { label: 'High Severity', value: flags.filter(f => f.severity === 'HIGH' && f.status !== 'Resolved').length, color: 'text-red-600' },
          { label: 'Open Issues', value: flags.filter(f => f.status === 'Open').length, color: 'text-amber-600' },
          { label: 'Resolved', value: flags.filter(f => f.status === 'Resolved').length, color: 'text-emerald-600' },
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
        {flags.length > 0 ? flags.map(item => (
          <div key={item.id} className={`bg-white p-6 rounded-xl border ${item.severity === 'HIGH' ? 'border-red-100' : 'border-amber-100'} shadow-sm flex items-start gap-4`}>
            <div className={`p-2 rounded-lg bg-gray-50 ${item.severity === 'HIGH' ? 'text-red-500' : 'text-amber-500'}`}>
               {item.severity === 'HIGH' ? <XCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <span className="font-bold text-gray-900">{item.type}</span>
                <Badge variant="outline" className={`text-[10px] font-bold ${item.severity === 'HIGH' ? 'text-red-600 border-red-100 bg-red-50' : 'text-amber-600 border-amber-100 bg-amber-50'}`}>
                  {item.severity}
                </Badge>
                <Badge variant="outline" className={`text-[10px] font-bold ${item.status === 'Resolved' ? 'text-emerald-600 border-emerald-100 bg-emerald-50' : 'text-amber-600 border-amber-100 bg-amber-50'}`}>
                  {item.status}
                </Badge>
              </div>
              <p className="text-sm text-gray-500 mb-2">{item.description}</p>
              <p className="text-xs text-gray-400">Reporter User ID: {item.userId} | Target Listing ID: {item.listingId || 'N/A'}</p>
            </div>
            <div className="flex flex-col gap-2">
              {item.status !== 'Resolved' && (
                <Button onClick={() => handleResolveFlag(item.id)} className="bg-[#2D9C75] hover:bg-[#258563] text-white rounded-lg h-9 px-4 text-xs font-bold">
                  Resolve
                </Button>
              )}
              <Button onClick={() => handleDismissFlag(item.id)} variant="outline" size="sm" className="rounded-lg h-9 px-4 text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50">
                Dismiss Flag
              </Button>
            </div>
          </div>
        )) : (
          <div className="p-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-400">
            No flagged activities to review right now.
          </div>
        )}
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
