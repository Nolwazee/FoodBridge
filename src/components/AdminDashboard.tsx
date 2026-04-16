import { useMemo, useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, query, onSnapshot, updateDoc, deleteDoc, doc, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile, FlaggedActivity, NgoDocument, NgoDocumentStatus, NgoDocumentType, AuditLogEntry, FoodListing } from '@/src/types';
import Sidebar from './Sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertTriangle, Package, BarChart3, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { logAudit } from '@/src/lib/audit';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AdminDashboard({ profile }: { profile: UserProfile }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [flags, setFlags] = useState<FlaggedActivity[]>([]);
  const [documents, setDocuments] = useState<NgoDocument[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [donations, setDonations] = useState<FoodListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [donationStatusFilter, setDonationStatusFilter] = useState<'all' | FoodListing['status']>('all');

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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'flags');
    });

    const qDocs = query(collection(db, 'ngoDocuments'), orderBy('uploadedAt', 'desc'));
    const unsubscribeDocs = onSnapshot(qDocs, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as NgoDocument));
      setDocuments(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'ngoDocuments');
    });

    const qAudit = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'));
    const unsubscribeAudit = onSnapshot(qAudit, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuditLogEntry));
      setAuditLogs(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'auditLogs');
    });

    const qListings = query(collection(db, 'listings'), orderBy('createdAt', 'desc'));
    const unsubscribeListings = onSnapshot(qListings, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FoodListing));
      setDonations(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'listings');
    });

    return () => {
      unsubscribeUsers();
      unsubscribeFlags();
      unsubscribeDocs();
      unsubscribeAudit();
      unsubscribeListings();
    };
  }, []);

  const handleVerify = async (userId: string, status: 'verified' | 'rejected') => {
    try {
      if (status === 'verified') {
        const requiredTypes: NgoDocumentType[] = ['npo_certificate', 'cipc', 'pbo', 'board_resolution', 'bank_confirmation'];
        const docs = documents.filter(d => d.ngoId === userId);
        const approvedAll = requiredTypes.every(t => docs.some(d => d.type === t && d.status === 'approved'));
        if (!approvedAll) {
          toast.error('Cannot verify NGO until all required documents are approved.');
          return;
        }
      }

      await updateDoc(doc(db, 'users', userId), {
        verificationStatus: status,
        isVerified: status === 'verified'
      });
      await logAudit({
        action: status === 'verified' ? 'ngo_verified' : 'ngo_verification_rejected',
        entityType: 'user',
        entityId: userId,
        metadata: { adminId: profile.uid },
      });
      toast.success(`NGO ${status} successfully`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const updateDocumentStatus = async (docId: string, status: NgoDocumentStatus, rejectionReason?: string) => {
    try {
      await updateDoc(doc(db, 'ngoDocuments', docId), {
        status,
        rejectionReason: status === 'rejected' ? (rejectionReason || 'Rejected') : '',
        reviewedAt: serverTimestamp(),
        reviewedBy: profile.uid,
      });
      await logAudit({
        action: 'ngo_document_reviewed',
        entityType: 'document',
        entityId: docId,
        metadata: { status, rejectionReason: rejectionReason || null },
      });
      toast.success('Document updated.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `ngoDocuments/${docId}`);
    }
  };

  const handleResolveFlag = async (id: string) => {
    try {
      await updateDoc(doc(db, 'flags', id), { status: 'Resolved' });
      await logAudit({ action: 'flag_resolved', entityType: 'flag', entityId: id });
      toast.success('Flag marked as resolved.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `flags/${id}`);
    }
  };

  const handleDismissFlag = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'flags', id));
      await logAudit({ action: 'flag_deleted', entityType: 'flag', entityId: id });
      toast.success('Flag deleted from the system.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `flags/${id}`);
    }
  };

  const seedData = async () => {
    try {
      // Sample users
      const sampleUsers = [
        {
          uid: 'user1',
          email: 'donor1@example.com',
          displayName: 'John Donor',
          role: 'donor' as const,
          organizationName: '',
          isVerified: true,
          verificationStatus: 'verified' as const,
          createdAt: serverTimestamp()
        },
        {
          uid: 'user2',
          email: 'ngo1@example.com',
          displayName: 'NGO Helper',
          role: 'ngo' as const,
          organizationName: 'Community Food Bank',
          isVerified: false,
          verificationStatus: 'pending' as const,
          registrationNumber: 'NGO12345',
          address: '123 Main St, City',
          contactPerson: 'Jane Smith',
          phoneNumber: '+1234567890',
          description: 'Helping communities with food distribution',
          createdAt: serverTimestamp()
        },
        {
          uid: 'user3',
          email: 'donor2@example.com',
          displayName: 'Alice Retailer',
          role: 'donor' as const,
          organizationName: 'Fresh Foods Market',
          isVerified: true,
          verificationStatus: 'verified' as const,
          createdAt: serverTimestamp()
        }
      ];

      // Sample flags
      const sampleFlags = [
        {
          type: 'Suspicious Activity',
          severity: 'HIGH' as const,
          status: 'Open' as const,
          description: 'Multiple claims from same IP address',
          userId: 'user1',
          listingId: 'listing1',
          createdAt: serverTimestamp()
        },
        {
          type: 'Expired Food Listing',
          severity: 'MEDIUM' as const,
          status: 'Investigating' as const,
          description: 'Food listed past expiry date',
          userId: 'user3',
          listingId: 'listing2',
          createdAt: serverTimestamp()
        },
        {
          type: 'Inappropriate Content',
          severity: 'LOW' as const,
          status: 'Resolved' as const,
          description: 'Offensive language in listing description',
          userId: 'user2',
          listingId: 'listing3',
          createdAt: serverTimestamp()
        }
      ];

      // Add users
      for (const user of sampleUsers) {
        await addDoc(collection(db, 'users'), user);
      }

      // Add flags
      for (const flag of sampleFlags) {
        await addDoc(collection(db, 'flags'), flag);
      }

      toast.success('Sample data seeded successfully!');
    } catch (error) {
      console.error('Error seeding data:', error);
      toast.error('Failed to seed sample data');
    }
  };

  const renderFlaggedActivity = () => (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flagged Activity</h1>
          <p className="text-sm text-gray-500 mt-1">Review and handle flagged transactions and activities</p>
        </div>
        <Button onClick={seedData} className="bg-[#2D9C75] hover:bg-[#258563] text-white rounded-lg px-4 py-2 text-sm font-bold">
          Seed Sample Data
        </Button>
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

  const ngos = users.filter(u => u.role === 'ngo');
  const pendingNGOs = ngos.filter(u => u.verificationStatus === 'pending');

  const requiredTypes: { type: NgoDocumentType; label: string }[] = [
    { type: 'npo_certificate', label: 'NPO Certificate' },
    { type: 'cipc', label: 'CIPC' },
    { type: 'pbo', label: 'PBO' },
    { type: 'board_resolution', label: 'Board Resolution' },
    { type: 'bank_confirmation', label: 'Bank Confirmation' },
  ];

  const renderOverview = () => {
    const ngoCount = ngos.length;
    const verifiedNgoCount = ngos.filter(n => n.verificationStatus === 'verified').length;
    const activeDonations = donations.filter(d => d.status === 'available').length;
    const flaggedOpen = flags.filter(f => f.status !== 'Resolved').length;

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Operational visibility across users, donations, and compliance</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'NGOs', value: ngoCount, icon: FileText },
            { label: 'Verified NGOs', value: verifiedNgoCount, icon: CheckCircle },
            { label: 'Active Donations', value: activeDonations, icon: Package },
            { label: 'Open Flags', value: flaggedOpen, icon: AlertTriangle },
          ].map((stat, i) => (
            <Card key={i} className="border-gray-100 shadow-sm">
              <CardContent className="p-6">
                <div className="text-xs font-medium text-gray-400 mb-2">{stat.label}</div>
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const renderVerificationQueue = () => (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Verification Queue</h1>
        <p className="text-sm text-gray-500 mt-1">Review NGO documents and approve/reject verification</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {pendingNGOs.length > 0 ? pendingNGOs.map(ngo => {
          const ngoDocs = documents.filter(d => d.ngoId === ngo.uid);
          return (
            <Card key={ngo.uid} className="border-gray-100 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center justify-between gap-4">
                  <span>{ngo.organizationName || ngo.displayName}</span>
                  <Badge variant="outline" className="text-[10px] font-bold">
                    {ngo.verificationStatus.toUpperCase()}
                  </Badge>
                </CardTitle>
                <div className="text-sm text-gray-500 space-y-1">
                  <p>Email: {ngo.email}</p>
                  <p>Reg No: {ngo.registrationNumber || '—'}</p>
                  <p>Address: {ngo.address || '—'}</p>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {requiredTypes.map(req => {
                    const docItem = ngoDocs.find(d => d.type === req.type) || null;
                    const previewUrl =
                      docItem?.fileUrl ? docItem.fileUrl :
                      docItem?.fileBase64 ? `data:${docItem.fileMime || 'application/pdf'};base64,${docItem.fileBase64}` :
                      null;
                    return (
                      <div key={req.type} className="rounded-xl border border-gray-100 p-4 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-bold text-gray-900">{req.label}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Status: {(docItem?.status || 'missing').toUpperCase()}
                          </div>
                          {docItem?.rejectionReason && (
                            <div className="text-xs text-red-600 mt-1">{docItem.rejectionReason}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {previewUrl ? (
                            <a href={previewUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#2D9C75] hover:underline">
                              Preview
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">No file</span>
                          )}
                          {docItem && docItem.status !== 'approved' && (
                            <Button
                              size="sm"
                              className="bg-[#2D9C75] hover:bg-[#258563] text-white h-8 px-3 text-xs font-bold rounded-lg"
                              onClick={() => updateDocumentStatus(docItem.id, 'approved')}
                            >
                              Approve
                            </Button>
                          )}
                          {docItem && docItem.status !== 'rejected' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 text-xs font-bold rounded-lg border-red-200 text-red-600 hover:bg-red-50"
                              onClick={() => {
                                const reason = window.prompt('Rejection reason (required):')?.trim() || '';
                                if (!reason) return;
                                updateDocumentStatus(docItem.id, 'rejected', reason);
                              }}
                            >
                              Reject
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => handleVerify(ngo.uid, 'rejected')}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Reject NGO
                  </Button>
                  <Button
                    size="sm"
                    className="bg-[#2D9C75] hover:bg-[#258563] text-white"
                    onClick={() => handleVerify(ngo.uid, 'verified')}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" /> Verify NGO
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        }) : (
          <div className="p-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-400">
            No pending verifications.
          </div>
        )}
      </div>
    </div>
  );

  const renderAllDonations = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">All Donations</h1>
        <p className="text-sm text-gray-500 mt-1">Platform-wide donation listing overview</p>
      </div>
      <div className="flex items-center gap-3">
        <Select value={donationStatusFilter} onValueChange={(v) => setDonationStatusFilter(v as any)}>
          <SelectTrigger className="w-[220px] rounded-xl border-gray-100 bg-white">
            <SelectValue placeholder="Status filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="reserved">Reserved</SelectItem>
            <SelectItem value="claimed">Claimed</SelectItem>
            <SelectItem value="collected">Collected</SelectItem>
            <SelectItem value="withdrawn">Withdrawn</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          className="rounded-xl"
          onClick={() => {
            const rows = donations
              .filter(d => donationStatusFilter === 'all' ? true : d.status === donationStatusFilter)
              .map(d => ({
                id: d.id,
                title: d.title,
                category: d.category,
                status: d.status,
                donorName: d.donorName,
                location: d.location,
              }));
            const csv = [
              Object.keys(rows[0] || { id: '', title: '', category: '', status: '', donorName: '', location: '' }).join(','),
              ...rows.map(r => Object.values(r).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')),
            ].join('\n');
            navigator.clipboard.writeText(csv);
            toast.success('CSV copied to clipboard.');
          }}
        >
          Export CSV (copy)
        </Button>
      </div>
      <div className="space-y-2">
        {donations
          .filter(d => donationStatusFilter === 'all' ? true : d.status === donationStatusFilter)
          .slice(0, 80)
          .map(d => (
          <div key={d.id} className="bg-white p-4 rounded-xl border border-gray-100 flex justify-between items-center">
            <div className="min-w-0">
              <div className="font-bold text-gray-900 truncate">{d.title}</div>
              <div className="text-xs text-gray-500 mt-1">Retailer: {d.donorName} · Category: {d.category} · Location: {d.location}</div>
            </div>
            <Badge variant="outline" className="text-[10px] font-bold">{d.status.toUpperCase()}</Badge>
          </div>
        ))}
      </div>
    </div>
  );

  const renderReports = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Monthly volumes, leaderboards, and exports (stub)</p>
      </div>
      <div className="p-10 bg-white rounded-2xl border border-gray-100 text-gray-600">
        Reporting charts and exports are wired to the `auditLogs`, `listings`, and `requests` collections. Next step is adding chart components and CSV export.
      </div>
    </div>
  );

  const renderAuditLogs = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-sm text-gray-500 mt-1">Every platform action is recorded here</p>
      </div>
      <div className="space-y-2">
        {auditLogs.slice(0, 80).map(item => (
          <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-100 flex justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-bold text-gray-900 truncate">{item.action}</div>
              <div className="text-xs text-gray-500 mt-1">
                Actor: {item.actorId || 'system'} · Entity: {item.entityType}{item.entityId ? `/${item.entityId}` : ''}
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] font-bold">{(item.actorRole || 'system').toString().toUpperCase()}</Badge>
          </div>
        ))}
      </div>
    </div>
  );

  const renderUserManagement = () => {
    const filtered = users.filter(u => {
      if (!userSearch.trim()) return true;
      const q = userSearch.toLowerCase();
      return (
        (u.email || '').toLowerCase().includes(q) ||
        (u.displayName || '').toLowerCase().includes(q) ||
        (u.organizationName || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q)
      );
    });

    const suspendUser = async (uid: string) => {
      try {
        await updateDoc(doc(db, 'users', uid), { suspended: true });
        await logAudit({ action: 'user_suspended', entityType: 'user', entityId: uid, metadata: { adminId: profile.uid } });
        toast.success('User suspended.');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
      }
    };

    const unsuspendUser = async (uid: string) => {
      try {
        await updateDoc(doc(db, 'users', uid), { suspended: false });
        await logAudit({ action: 'user_unsuspended', entityType: 'user', entityId: uid, metadata: { adminId: profile.uid } });
        toast.success('User unsuspended.');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
      }
    };

    const makeRole = async (uid: string, role: UserProfile['role']) => {
      try {
        await updateDoc(doc(db, 'users', uid), { role });
        await logAudit({ action: 'user_role_updated', entityType: 'user', entityId: uid, metadata: { adminId: profile.uid, role } });
        toast.success('Role updated.');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">Search, suspend, and manage roles (invite flow next)</p>
        </div>

        <div className="flex items-center gap-3">
          <Input
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Search by email, name, org, or role..."
            className="max-w-lg rounded-xl border-gray-100 bg-white"
          />
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => toast.message('Invite flow: next iteration will email an invite link and create a user record.')}
          >
            Invite User (stub)
          </Button>
        </div>

        <div className="space-y-2">
          {filtered.slice(0, 80).map(u => (
            <div key={u.uid} className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-bold text-gray-900 truncate">{u.organizationName || u.displayName || u.email}</div>
                  <Badge variant="outline" className="text-[10px] font-bold">{u.role.toUpperCase()}</Badge>
                  <Badge variant="outline" className="text-[10px] font-bold">
                    {(u as any).suspended ? 'SUSPENDED' : 'ACTIVE'}
                  </Badge>
                </div>
                <div className="text-xs text-gray-500 mt-1 truncate">{u.email}</div>
              </div>

              <div className="flex items-center gap-2">
                <Select value={u.role} onValueChange={(v) => makeRole(u.uid, v as any)}>
                  <SelectTrigger className="w-[140px] rounded-xl h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ngo">NGO</SelectItem>
                    <SelectItem value="donor">Retailer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                {(u as any).suspended ? (
                  <Button className="bg-[#2D9C75] hover:bg-[#258563] text-white rounded-xl h-9" onClick={() => unsuspendUser(u.uid)}>
                    Unsuspend
                  </Button>
                ) : (
                  <Button variant="outline" className="rounded-xl h-9 border-red-200 text-red-600 hover:bg-red-50" onClick={() => suspendUser(u.uid)}>
                    Suspend
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-[calc(100vh-64px)] bg-[#F8FAFA]">
      <Sidebar role="admin" activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'flagged' && renderFlaggedActivity()}
        
        {activeTab === 'verification' && (
          renderVerificationQueue()
        )}

        {activeTab === 'users' && renderUserManagement()}
        {activeTab === 'donations' && renderAllDonations()}
        {activeTab === 'reports' && renderReports()}
        {activeTab === 'audit' && renderAuditLogs()}
      </main>
    </div>
  );
}
