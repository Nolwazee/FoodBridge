import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile, UserRole } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { CheckCircle, XCircle, Plus, Mail, Phone, MapPin, Building2, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { logAudit } from '@/src/lib/audit';

type UserStatus = 'active' | 'suspended' | 'pending' | 'all';

export default function UserManagement({ adminId }: { adminId: string }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<UserStatus>('all');
  const [inviteDialog, setInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('ngo');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [suspendDialog, setSuspendDialog] = useState(false);

  useEffect(() => {
    const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(qUsers, (snapshot) => {
      const data = snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
      setUsers(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let filtered = users;

    if (searchTerm) {
      filtered = filtered.filter(
        u =>
          u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.organizationName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterRole !== 'all') {
      filtered = filtered.filter(u => u.role === filterRole);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(u => {
        if (filterStatus === 'suspended') return u.verificationStatus === 'rejected';
        if (filterStatus === 'pending') return u.verificationStatus === 'pending';
        return u.verificationStatus === 'verified';
      });
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, filterRole, filterStatus]);

  const handleSuspendUser = async () => {
    if (!selectedUser) return;
    try {
      await updateDoc(doc(db, 'users', selectedUser.uid), {
        verificationStatus: 'rejected',
      });
      await logAudit({
        action: 'user_suspended',
        entityType: 'user',
        entityId: selectedUser.uid,
        metadata: { adminId },
      });
      toast.success(`${selectedUser.displayName} suspended`);
      setSuspendDialog(false);
      setSelectedUser(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${selectedUser.uid}`);
    }
  };

  const handleRestoreUser = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        verificationStatus: 'pending',
      });
      await logAudit({
        action: 'user_restored',
        entityType: 'user',
        entityId: userId,
        metadata: { adminId },
      });
      toast.success('User restored');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Please enter an email');
      return;
    }

    try {
      await addDoc(collection(db, 'invitations'), {
        email: inviteEmail,
        role: inviteRole,
        createdAt: serverTimestamp(),
        sentAt: new Date(),
        sentBy: adminId,
        status: 'pending',
      });
      await logAudit({
        action: 'user_invited',
        entityType: 'user',
        metadata: { adminId, email: inviteEmail, role: inviteRole },
      });
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteDialog(false);
      setInviteEmail('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'invitations');
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'ngo':
        return 'bg-green-100 text-green-800';
      case 'donor':
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">User Management</h2>
        <Button onClick={() => setInviteDialog(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Invite User
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-xs">
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="px-3 py-2 border rounded-md"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as UserRole | 'all')}
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="ngo">NGO</option>
              <option value="donor">Donor</option>
            </select>
            <select
              className="px-3 py-2 border rounded-md"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as UserStatus)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <p className="text-sm text-gray-600">
            <Filter className="w-4 h-4 inline mr-1" />
            Showing {filteredUsers.length} of {users.length} users
          </p>
        </CardContent>
      </Card>

      {/* Users Grid */}
      <div className="grid gap-3">
        {filteredUsers.map((user) => (
          <Card key={user.uid} className="hover:shadow-md transition">
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-lg">{user.displayName}</h3>
                    <Badge className={getRoleColor(user.role)}>
                      {user.role.toUpperCase()}
                    </Badge>
                    <Badge className={getStatusColor(user.verificationStatus)}>
                      {user.verificationStatus === 'verified' ? 'Active' : 'Suspended'}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {user.email}
                    </div>
                    {user.organizationName && (
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        {user.organizationName}
                      </div>
                    )}
                    {user.phoneNumber && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        {user.phoneNumber}
                      </div>
                    )}
                    {user.location?.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {user.location.address}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  {user.verificationStatus === 'verified' ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user);
                        setSuspendDialog(true);
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Suspend
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleRestoreUser(user.uid)}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Restore
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center text-gray-500">
            No users found
          </CardContent>
        </Card>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteDialog} onOpenChange={setInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite New User</DialogTitle>
            <DialogDescription>
              Send an invitation to a new user to join FoodBridge
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                className="w-full px-3 py-2 border rounded-md"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as UserRole)}
              >
                <option value="ngo">NGO</option>
                <option value="donor">Donor / Retailer</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setInviteDialog(false);
                  setInviteEmail('');
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSendInvite}>Send Invite</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Suspend Dialog */}
      <Dialog open={suspendDialog} onOpenChange={setSuspendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend User</DialogTitle>
            <DialogDescription>
              Are you sure you want to suspend {selectedUser?.displayName}?
            </DialogDescription>
          </DialogHeader>

          <div className="bg-yellow-50 p-4 rounded border border-yellow-200 text-sm text-yellow-800 my-4">
            This user will be unable to access the platform. You can restore them later.
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setSuspendDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleSuspendUser}>
              Suspend User
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
