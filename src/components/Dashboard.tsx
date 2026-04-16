import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, where, getDoc } from 'firebase/firestore';
import { FoodListing, UserProfile, DonationRequest, DonationRequestStatus, NgoDocument, NgoDocumentType } from '@/src/types';
import ListingCard from './ListingCard';
import Sidebar from './Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Filter, TrendingUp, CheckCircle2, Clock, MapPinned, FileUp, ExternalLink, History } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { logAudit } from '@/src/lib/audit';
import { storage } from '@/src/lib/firebase';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

interface DashboardProps {
  profile: UserProfile;
}

export default function Dashboard({ profile }: DashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [listings, setListings] = useState<FoodListing[]>([]);
  const [requests, setRequests] = useState<DonationRequest[]>([]);
  const [ngoDocuments, setNgoDocuments] = useState<NgoDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newListing, setNewListing] = useState({
    title: '',
    description: '',
    category: 'produce',
    qty: '',
    unit: 'kg' as FoodListing['unit'],
    expiryDate: '',
    pickupWindowStart: '',
    pickupWindowEnd: '',
    location: ''
  });

  const [browseCategory, setBrowseCategory] = useState<'all' | FoodListing['category']>('all');
  const [selectedListing, setSelectedListing] = useState<FoodListing | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [newRequest, setNewRequest] = useState({
    requestedQty: '',
    requestedUnit: 'kg' as FoodListing['unit'],
    preferredPickupTime: '',
    note: '',
  });

  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FoodListing));
      setListings(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'listings');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DonationRequest));
      setRequests(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'requests');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (profile.role !== 'ngo') return;
    const q = query(collection(db, 'ngoDocuments'), where('ngoId', '==', profile.uid), orderBy('uploadedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as NgoDocument));
      setNgoDocuments(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'ngoDocuments');
    });
    return () => unsubscribe();
  }, [profile.role, profile.uid]);

  const handleAddListing = async () => {
    try {
      const qty = newListing.qty ? Number(newListing.qty) : undefined;
      await addDoc(collection(db, 'listings'), {
        title: newListing.title,
        description: newListing.description,
        category: newListing.category as any,
        qty: Number.isFinite(qty) ? qty : undefined,
        unit: newListing.unit,
        quantity: newListing.qty ? `${newListing.qty} ${newListing.unit}` : '',
        donorId: profile.uid,
        donorName: profile.organizationName,
        status: 'available' as const,
        expiryDate: new Date(newListing.expiryDate),
        pickupWindowStart: newListing.pickupWindowStart ? new Date(newListing.pickupWindowStart) : undefined,
        pickupWindowEnd: newListing.pickupWindowEnd ? new Date(newListing.pickupWindowEnd) : undefined,
        createdAt: serverTimestamp()
      });
      await logAudit({
        action: 'listing_created',
        entityType: 'listing',
        metadata: { donorId: profile.uid, category: newListing.category },
      });
      setIsAddModalOpen(false);
      toast.success("Listing created successfully!");
      setNewListing({ title: '', description: '', category: 'produce', qty: '', unit: 'kg', expiryDate: '', pickupWindowStart: '', pickupWindowEnd: '', location: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'listings');
    }
  };

  const openRequestModal = (listingId: string) => {
    const listing = listings.find(l => l.id === listingId) || null;
    if (!listing) return;
    if (profile.role !== 'ngo') return;
    if (profile.verificationStatus !== 'verified') {
      toast.error("Your NGO must be verified to submit requests. Upload documents in Document Manager.");
      return;
    }
    setSelectedListing(listing);
    setNewRequest({
      requestedQty: listing.qty ? String(listing.qty) : '',
      requestedUnit: listing.unit || 'kg',
      preferredPickupTime: '',
      note: '',
    });
    setIsRequestModalOpen(true);
  };

  const submitRequest = async () => {
    if (!selectedListing) return;
    if (!newRequest.requestedQty) {
      toast.error('Please enter a requested quantity.');
      return;
    }
    const requestedQty = Number(newRequest.requestedQty);
    if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
      toast.error('Requested quantity must be a positive number.');
      return;
    }
    try {
      await addDoc(collection(db, 'requests'), {
        listingId: selectedListing.id,
        retailerId: selectedListing.donorId,
        ngoId: profile.uid,
        status: 'pending' as DonationRequestStatus,
        requestedQty,
        requestedUnit: newRequest.requestedUnit,
        preferredPickupTime: newRequest.preferredPickupTime ? new Date(newRequest.preferredPickupTime) : undefined,
        note: newRequest.note || '',
        ngoSnapshot: {
          organizationName: profile.organizationName,
          contactPerson: profile.contactPerson,
          phoneNumber: profile.phoneNumber,
          address: profile.address,
          verificationStatus: profile.verificationStatus,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logAudit({
        action: 'request_submitted',
        entityType: 'request',
        metadata: { listingId: selectedListing.id, retailerId: selectedListing.donorId, ngoId: profile.uid },
      });
      toast.success('Request submitted. The retailer will review it.');
      setIsRequestModalOpen(false);
      setSelectedListing(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'requests');
    }
  };

  const handleDeleteListing = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'listings', id));
      await logAudit({ action: 'listing_deleted', entityType: 'listing', entityId: id });
      toast.success("Listing removed successfully.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `listings/${id}`);
    }
  };

  const handleReportListing = async (id: string) => {
    try {
      await addDoc(collection(db, 'flags'), {
        type: 'Reported Listing',
        severity: 'MEDIUM',
        status: 'Open',
        description: 'An NGO reported this listing for review.',
        userId: profile.uid,
        listingId: id,
        createdAt: serverTimestamp()
      });
      await logAudit({ action: 'listing_reported', entityType: 'flag', metadata: { listingId: id, reporterId: profile.uid } });
      toast.success("Listing reported to administrators.");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'flags');
    }
  };

  const myListings = listings.filter(l => l.donorId === profile.uid);
  const availableListings = listings.filter(l => l.status === 'available');
  const browseListings = availableListings.filter(l => (browseCategory === 'all' ? true : l.category === browseCategory));

  const myRequests = requests.filter(r => r.ngoId === profile.uid);
  const retailerRequests = requests.filter(r => r.retailerId === profile.uid);
  const retailerPendingRequests = retailerRequests.filter(r => r.status === 'pending');
  const retailerApprovedRequests = retailerRequests.filter(r => r.status === 'approved');
  const retailerCompletedRequests = retailerRequests.filter(r => r.status === 'completed');

  const selectedRequest = (selectedRequestId ? requests.find(r => r.id === selectedRequestId) : null) || null;
  const selectedRequestListing = selectedRequest ? listings.find(l => l.id === selectedRequest.listingId) || null : null;

  const generateReferenceNumber = () => `FB-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;

  const approveRequest = async (request: DonationRequest) => {
    try {
      const ngoDoc = await getDoc(doc(db, 'users', request.ngoId));
      const ngoProfile = ngoDoc.exists() ? (ngoDoc.data() as UserProfile) : null;
      if (!ngoProfile || ngoProfile.verificationStatus !== 'verified') {
        toast.error('This NGO is not verified. Approval is blocked.');
        await logAudit({
          action: 'request_approval_blocked_unverified_ngo',
          entityType: 'request',
          entityId: request.id,
          metadata: { ngoId: request.ngoId },
        });
        return;
      }

      const referenceNumber = generateReferenceNumber();
      await updateDoc(doc(db, 'requests', request.id), {
        status: 'approved',
        referenceNumber,
        decision: {
          decidedAt: serverTimestamp(),
          decidedBy: profile.uid,
        },
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'listings', request.listingId), {
        status: 'claimed',
        claimedBy: request.ngoId,
        claimedAt: serverTimestamp(),
      });

      await logAudit({
        action: 'request_approved',
        entityType: 'request',
        entityId: request.id,
        metadata: { listingId: request.listingId, retailerId: profile.uid, ngoId: request.ngoId, referenceNumber },
      });
      toast.success('Request approved.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `requests/${request.id}`);
    }
  };

  const rejectRequest = async (request: DonationRequest) => {
    const reason = window.prompt('Rejection reason (required):')?.trim() || '';
    if (!reason) return;
    try {
      await updateDoc(doc(db, 'requests', request.id), {
        status: 'rejected',
        decision: {
          decidedAt: serverTimestamp(),
          decidedBy: profile.uid,
          reason,
        },
        updatedAt: serverTimestamp(),
      });
      await logAudit({
        action: 'request_rejected',
        entityType: 'request',
        entityId: request.id,
        metadata: { listingId: request.listingId, retailerId: profile.uid, ngoId: request.ngoId, reason },
      });
      toast.success('Request rejected.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `requests/${request.id}`);
    }
  };

  const markPickedUp = async (request: DonationRequest) => {
    const repName = window.prompt('Pickup representative name (required):')?.trim() || '';
    if (!repName) return;
    const actualQtyStr = window.prompt('Actual quantity picked up (number):')?.trim() || '';
    const actualQty = actualQtyStr ? Number(actualQtyStr) : undefined;
    if (actualQtyStr && (!Number.isFinite(actualQty) || (actualQty ?? 0) <= 0)) {
      toast.error('Actual quantity must be a positive number.');
      return;
    }
    try {
      await updateDoc(doc(db, 'requests', request.id), {
        status: 'completed',
        pickupConfirmation: {
          pickedUpAt: serverTimestamp(),
          actualQty: Number.isFinite(actualQty) ? actualQty : undefined,
          repName,
        },
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'listings', request.listingId), {
        status: 'collected',
      });
      await logAudit({
        action: 'pickup_marked_completed',
        entityType: 'request',
        entityId: request.id,
        metadata: { listingId: request.listingId, retailerId: profile.uid, ngoId: request.ngoId, repName, actualQty },
      });
      toast.success('Pickup marked as completed.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `requests/${request.id}`);
    }
  };

  const handleUploadNgoDocument = async (type: NgoDocumentType, file: File) => {
    try {
      const safeName = file.name.replace(/[^\w.\-() ]+/g, '_');
      const storageRef = ref(storage, `ngoDocs/${profile.uid}/${type}-${Date.now()}-${safeName}`);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'ngoDocuments'), {
        ngoId: profile.uid,
        type,
        fileName: file.name,
        fileUrl: url,
        status: 'submitted',
        uploadedAt: serverTimestamp(),
      });
      await logAudit({ action: 'ngo_document_uploaded', entityType: 'document', metadata: { ngoId: profile.uid, type } });
      toast.success('Document uploaded and submitted for review.');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'ngoDocuments');
    }
  };

  const renderOverview = () => {
    if (profile.role === 'donor') {
      return (
        <div className="space-y-8">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Retailer Overview</h1>
              <p className="text-sm text-gray-500 mt-1">Manage your surplus food listings and track donations</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Active Listings', value: myListings.filter(l => l.status === 'available').length, sub: 'Ready for NGO claims' },
              { label: 'Completed Donations', value: myListings.filter(l => l.status === 'collected').length, sub: 'Completed pickup cycles', icon: CheckCircle2 },
              { label: 'Total Claims', value: myListings.filter(l => l.status === 'claimed').length, sub: 'Across all listings', icon: History },
              { label: 'Total Listings', value: myListings.length, sub: 'All-time contributions' },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <div className="text-xs font-medium text-gray-400 mb-2">{stat.label}</div>
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-[10px] text-gray-400 mt-1">{stat.sub}</div>
              </div>
            ))}
          </div>

          <div className="bg-[#E9F5F1] p-6 rounded-xl border border-[#D1EBE1] flex items-center gap-4">
            <div className="bg-white p-2 rounded-lg">
              <TrendingUp className="h-5 w-5 text-[#2D9C75]" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#1A2B2B]">Your Impact</div>
              <div className="text-xs text-[#2D9C75]">Your listings are turning surplus stock into verified deliveries for local NGOs.</div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900">Recent Activity</h3>
            <div className="space-y-2">
              {myListings.slice(0, 5).map(listing => (
                <div key={listing.id} className="bg-white p-4 rounded-xl border border-gray-100 flex justify-between items-center">
                  <div>
                    <div className="text-sm font-bold text-gray-900">{listing.title}</div>
                    <div className="text-xs text-gray-500">
                      {listing.status === 'claimed' ? `Claimed by NGO at Saved business address` : `Available for collection`}
                    </div>
                  </div>
                  <Badge variant={listing.status === 'available' ? 'outline' : 'secondary'} className="rounded-full px-3 py-0.5 text-[10px] font-bold">
                    {listing.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <div className="flex justify-between items-end">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">NGO Overview</h1>
              <Badge variant="outline" className="text-[10px] font-bold text-[#2D9C75] border-[#2D9C75] bg-[#E9F5F1]">
                {profile.verificationStatus.toUpperCase()}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mt-1">Browse available food, manage claims, and track deliveries</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Active Requests', value: myRequests.filter(r => r.status === 'pending' || r.status === 'approved').length, sub: 'Pending and scheduled pickups', icon: Clock },
            { label: 'Completed Pickups', value: myRequests.filter(r => r.status === 'completed').length, sub: 'Delivered successfully', icon: CheckCircle2 },
            { label: 'Total Requests', value: myRequests.length, sub: 'All submitted requests' },
            { label: 'Available Food', value: availableListings.length, sub: 'Listings ready in network' },
          ].map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="text-xs font-medium text-gray-400 mb-2">{stat.label}</div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-[10px] text-gray-400 mt-1">{stat.sub}</div>
            </div>
          ))}
        </div>

        <div className="bg-[#E9F5F1] p-6 rounded-xl border border-[#D1EBE1] flex items-center gap-4">
          <div className="bg-white p-2 rounded-lg">
            <TrendingUp className="h-5 w-5 text-[#2D9C75]" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#1A2B2B]">Your Community Impact</div>
            <div className="text-xs text-[#2D9C75]">{profile.organizationName} can see live claim progress here as retailers accept and complete pickups.</div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-900">Active Claims</h3>
          <div className="space-y-2">
            {myRequests.filter(r => r.status === 'approved').length > 0 ? myRequests.filter(r => r.status === 'approved').slice(0, 5).map(r => {
              const listing = listings.find(l => l.id === r.listingId);
              return (
              <div key={r.id} className="bg-white p-4 rounded-xl border border-gray-100 flex justify-between items-center">
                <div>
                  <div className="text-sm font-bold text-gray-900">{listing?.title || 'Donation'}</div>
                  <div className="text-xs text-gray-500">From {listing?.donorName || 'Retailer'} | Ref {r.referenceNumber || '—'}</div>
                </div>
                <Badge className="bg-[#2D9C75] text-white rounded-full px-3 py-0.5 text-[10px] font-bold">
                  {r.status}
                </Badge>
              </div>
              );
            }) : (
              <div className="p-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <div className="text-sm font-bold text-gray-900 mb-2">Ready to Help More?</div>
                <div className="text-xs text-gray-500 mb-6">Browse available food listings and submit new claims</div>
                <Button 
                  onClick={() => setActiveTab('browse')}
                  className="bg-[#2D9C75] hover:bg-[#258563] text-white rounded-lg px-6"
                >
                  Browse Available Food
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-[calc(100vh-64px)] bg-[#F8FAFA]">
      <Sidebar role={profile.role as any} activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'overview' && renderOverview()}
        
        {activeTab === 'browse' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Available Food</h1>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input className="pl-10 rounded-xl border-gray-100 w-64" placeholder="Search for food..." />
                </div>
                <Select value={browseCategory} onValueChange={(v) => setBrowseCategory(v as any)}>
                  <SelectTrigger className="w-[180px] rounded-xl border-gray-100">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    <SelectItem value="produce">Produce</SelectItem>
                    <SelectItem value="bakery">Bakery</SelectItem>
                    <SelectItem value="dairy">Dairy</SelectItem>
                    <SelectItem value="meat">Meat</SelectItem>
                    <SelectItem value="pantry">Pantry</SelectItem>
                    <SelectItem value="prepared">Prepared</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" className="rounded-xl gap-2 border-gray-100" onClick={() => toast.message('Distance sorting and expiry indicators are enabled when locations are set.')}>
                  <Filter className="h-4 w-4" /> Filters
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {browseListings.map(listing => (
                <ListingCard 
                  key={listing.id} 
                  listing={listing} 
                  canClaim={profile.role === 'ngo'} 
                  onClaim={openRequestModal}
                  canReport={profile.role === 'ngo'}
                  onReport={handleReportListing}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'my-listings' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">My Listings</h1>
              <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-[#2D9C75] hover:bg-[#258563] text-white rounded-xl gap-2">
                    <Plus className="h-4 w-4" /> List Food
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] rounded-3xl">
                  <DialogHeader>
                    <DialogTitle>List Surplus Food</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Title</Label>
                      <Input placeholder="e.g. 50kg Fresh Tomatoes" value={newListing.title} onChange={e => setNewListing({...newListing, title: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Category</Label>
                        <Select value={newListing.category} onValueChange={v => setNewListing({...newListing, category: v as any})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="produce">Produce</SelectItem>
                            <SelectItem value="bakery">Bakery</SelectItem>
                            <SelectItem value="dairy">Dairy</SelectItem>
                            <SelectItem value="meat">Meat</SelectItem>
                            <SelectItem value="pantry">Pantry</SelectItem>
                            <SelectItem value="prepared">Prepared</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Quantity</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="e.g. 50" value={newListing.qty} onChange={e => setNewListing({...newListing, qty: e.target.value})} />
                          <Select value={newListing.unit} onValueChange={v => setNewListing({...newListing, unit: v as any})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="kg">kg</SelectItem>
                              <SelectItem value="g">g</SelectItem>
                              <SelectItem value="l">l</SelectItem>
                              <SelectItem value="ml">ml</SelectItem>
                              <SelectItem value="unit">unit</SelectItem>
                              <SelectItem value="box">box</SelectItem>
                              <SelectItem value="crate">crate</SelectItem>
                              <SelectItem value="bag">bag</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Expiry Date</Label>
                      <Input type="date" value={newListing.expiryDate} onChange={e => setNewListing({...newListing, expiryDate: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Pickup Window Start</Label>
                        <Input type="datetime-local" value={newListing.pickupWindowStart} onChange={e => setNewListing({...newListing, pickupWindowStart: e.target.value})} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Pickup Window End</Label>
                        <Input type="datetime-local" value={newListing.pickupWindowEnd} onChange={e => setNewListing({...newListing, pickupWindowEnd: e.target.value})} />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Location / Collection Point</Label>
                      <Input placeholder="Enter address" value={newListing.location} onChange={e => setNewListing({...newListing, location: e.target.value})} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Description</Label>
                      <Input placeholder="Any special handling instructions?" value={newListing.description} onChange={e => setNewListing({...newListing, description: e.target.value})} />
                    </div>
                    <Button onClick={handleAddListing} className="bg-[#2D9C75] hover:bg-[#258563] text-white mt-4 h-12 rounded-xl">
                      Post Listing
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myListings.map(listing => (
                <ListingCard 
                  key={listing.id} 
                  listing={listing} 
                  canDelete={listing.status === 'available'}
                  onDelete={handleDeleteListing}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'my-requests' && profile.role === 'ngo' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">My Requests</h1>
              <Button variant="outline" className="rounded-xl" onClick={() => setActiveTab('browse')}>
                Browse More <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </div>
            <div className="space-y-3">
              {myRequests.length === 0 ? (
                <div className="p-10 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-500">
                  No requests yet. Browse listings and submit a request.
                </div>
              ) : (
                myRequests.map(r => {
                  const listing = listings.find(l => l.id === r.listingId);
                  return (
                    <div key={r.id} className="bg-white p-5 rounded-xl border border-gray-100 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-bold text-gray-900 truncate">{listing?.title || 'Donation request'}</div>
                          <Badge variant="outline" className="text-[10px] font-bold">{r.status.toUpperCase()}</Badge>
                          {r.referenceNumber && <Badge className="text-[10px] font-bold bg-[#2D9C75] text-white">Ref {r.referenceNumber}</Badge>}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Retailer: {listing?.donorName || '—'} · Requested: {r.requestedQty ?? '—'} {r.requestedUnit ?? ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          disabled={r.status !== 'approved'}
                          onClick={() => { setSelectedRequestId(r.id); setActiveTab('directions'); }}
                        >
                          <MapPinned className="h-4 w-4 mr-2" /> Directions
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'directions' && profile.role === 'ngo' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pickup Directions</h1>
              <p className="text-sm text-gray-500 mt-1">Turn-by-turn instructions and pickup reference number</p>
            </div>
            {!selectedRequest || selectedRequest.status !== 'approved' || !selectedRequestListing ? (
              <div className="p-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-500">
                Select an approved request from “My Requests” to view directions.
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-bold text-gray-900">{selectedRequestListing.title}</div>
                    <div className="text-sm text-gray-500">Retailer: {selectedRequestListing.donorName}</div>
                    <div className="text-sm text-gray-500">Pickup Location: {selectedRequestListing.location}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">Reference</div>
                    <div className="text-lg font-bold text-[#2D9C75]">{selectedRequest.referenceNumber}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-dashed border-gray-200 p-4 bg-gray-50">
                    <div className="text-sm font-bold text-gray-900 mb-2">Map (stub)</div>
                    <div className="text-xs text-gray-500">Integrate your preferred map provider here (Google/Mapbox). For now we show the pickup address and a step list.</div>
                  </div>
                  <div className="rounded-xl border border-gray-100 p-4">
                    <div className="text-sm font-bold text-gray-900 mb-2">Turn-by-turn (stub)</div>
                    <ol className="text-sm text-gray-600 list-decimal pl-5 space-y-1">
                      <li>Start from your current location.</li>
                      <li>Head toward: {selectedRequestListing.location}</li>
                      <li>Arrive within the pickup window and present reference: <span className="font-bold">{selectedRequest.referenceNumber}</span></li>
                    </ol>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'requests' && profile.role === 'donor' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">NGO Requests</h1>
              <p className="text-sm text-gray-500 mt-1">Approve or reject requests for your donation listings</p>
            </div>
            <div className="space-y-3">
              {retailerPendingRequests.length === 0 ? (
                <div className="p-10 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-500">
                  No pending requests right now.
                </div>
              ) : (
                retailerPendingRequests.map(r => {
                  const listing = listings.find(l => l.id === r.listingId);
                  return (
                    <div key={r.id} className="bg-white p-5 rounded-xl border border-gray-100 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 truncate">{listing?.title || 'Donation listing'}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          NGO: {r.ngoSnapshot?.organizationName || r.ngoId} · Qty: {r.requestedQty ?? '—'} {r.requestedUnit ?? ''} · Preferred: {r.preferredPickupTime ? 'Provided' : '—'}
                        </div>
                        {r.note && <div className="text-xs text-gray-400 mt-2 italic">“{r.note}”</div>}
                        {r.ngoSnapshot?.verificationStatus && (
                          <div className="mt-2">
                            <Badge variant="outline" className="text-[10px] font-bold">
                              NGO Verification: {r.ngoSnapshot.verificationStatus.toUpperCase()}
                            </Badge>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" className="rounded-xl border-red-200 text-red-600 hover:bg-red-50" onClick={() => rejectRequest(r)}>
                          Reject
                        </Button>
                        <Button className="bg-[#2D9C75] hover:bg-[#258563] text-white rounded-xl" onClick={() => approveRequest(r)}>
                          Approve
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'pickup-schedule' && profile.role === 'donor' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pickup Schedule</h1>
              <p className="text-sm text-gray-500 mt-1">Approved pickups ready for confirmation</p>
            </div>
            <div className="space-y-3">
              {retailerApprovedRequests.length === 0 ? (
                <div className="p-10 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-500">
                  No approved pickups scheduled.
                </div>
              ) : (
                retailerApprovedRequests.map(r => {
                  const listing = listings.find(l => l.id === r.listingId);
                  return (
                    <div key={r.id} className="bg-white p-5 rounded-xl border border-gray-100 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-bold text-gray-900 truncate">{listing?.title || 'Donation'}</div>
                          {r.referenceNumber && <Badge className="text-[10px] font-bold bg-[#2D9C75] text-white">Ref {r.referenceNumber}</Badge>}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          NGO: {r.ngoSnapshot?.organizationName || r.ngoId} · Qty: {r.requestedQty ?? '—'} {r.requestedUnit ?? ''} · Location: {listing?.location || '—'}
                        </div>
                      </div>
                      <Button className="bg-[#2D9C75] hover:bg-[#258563] text-white rounded-xl" onClick={() => markPickedUp(r)}>
                        Mark as Picked Up
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && profile.role === 'donor' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Donation History</h1>
              <p className="text-sm text-gray-500 mt-1">Completed pickups and estimated waste-prevented value</p>
            </div>
            <div className="space-y-3">
              {retailerCompletedRequests.length === 0 ? (
                <div className="p-10 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-500">
                  No completed pickups yet.
                </div>
              ) : (
                retailerCompletedRequests.map(r => {
                  const listing = listings.find(l => l.id === r.listingId);
                  const qty = r.pickupConfirmation?.actualQty ?? r.requestedQty ?? 0;
                  const estValue = Math.round((Number(qty) || 0) * 10); // placeholder; replace with real valuation model
                  return (
                    <div key={r.id} className="bg-white p-5 rounded-xl border border-gray-100 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 truncate">{listing?.title || 'Donation'}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          NGO: {r.ngoSnapshot?.organizationName || r.ngoId} · Qty: {qty} {r.requestedUnit ?? ''} · Ref: {r.referenceNumber || '—'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-400">Waste prevented (est.)</div>
                        <div className="text-sm font-bold text-[#2D9C75]">R {estValue.toLocaleString()}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'documents' && profile.role === 'ngo' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Document Manager</h1>
              <p className="text-sm text-gray-500 mt-1">Upload PDFs for verification and track review status</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {([
                  { type: 'npo_certificate', label: 'NPO Certificate' },
                  { type: 'cipc', label: 'CIPC' },
                  { type: 'pbo', label: 'PBO' },
                  { type: 'board_resolution', label: 'Board Resolution' },
                  { type: 'bank_confirmation', label: 'Bank Confirmation' },
                ] as { type: NgoDocumentType; label: string }[]).map(item => (
                  <div key={item.type} className="rounded-xl border border-gray-100 p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{item.label}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Status: {(ngoDocuments.find(d => d.type === item.type)?.status || 'missing').toUpperCase()}
                      </div>
                      {ngoDocuments.find(d => d.type === item.type)?.rejectionReason && (
                        <div className="text-xs text-red-600 mt-1">
                          {ngoDocuments.find(d => d.type === item.type)?.rejectionReason}
                        </div>
                      )}
                    </div>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadNgoDocument(item.type, file);
                          e.currentTarget.value = '';
                        }}
                      />
                      <Button variant="outline" className="rounded-xl">
                        <FileUp className="h-4 w-4 mr-2" /> Upload PDF
                      </Button>
                    </label>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-400">
                After upload, an Admin reviews your documents in the verification queue.
              </div>
            </div>
          </div>
        )}

        <Dialog open={isRequestModalOpen} onOpenChange={setIsRequestModalOpen}>
          <DialogContent className="sm:max-w-[520px] rounded-3xl">
            <DialogHeader>
              <DialogTitle>Submit Request</DialogTitle>
            </DialogHeader>
            {selectedListing && (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <div className="text-sm font-bold text-gray-900">{selectedListing.title}</div>
                  <div className="text-xs text-gray-500 mt-1">Retailer: {selectedListing.donorName}</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Quantity</Label>
                    <Input value={newRequest.requestedQty} onChange={(e) => setNewRequest({ ...newRequest, requestedQty: e.target.value })} placeholder="e.g. 20" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Unit</Label>
                    <Select value={newRequest.requestedUnit} onValueChange={(v) => setNewRequest({ ...newRequest, requestedUnit: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="g">g</SelectItem>
                        <SelectItem value="l">l</SelectItem>
                        <SelectItem value="ml">ml</SelectItem>
                        <SelectItem value="unit">unit</SelectItem>
                        <SelectItem value="box">box</SelectItem>
                        <SelectItem value="crate">crate</SelectItem>
                        <SelectItem value="bag">bag</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Preferred pickup time</Label>
                  <Input type="datetime-local" value={newRequest.preferredPickupTime} onChange={(e) => setNewRequest({ ...newRequest, preferredPickupTime: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Note to retailer</Label>
                  <Input value={newRequest.note} onChange={(e) => setNewRequest({ ...newRequest, note: e.target.value })} placeholder="Optional note (e.g., vehicle size / ETA)" />
                </div>
                <Button className="bg-[#2D9C75] hover:bg-[#258563] text-white rounded-xl h-11" onClick={submitRequest}>
                  Submit request
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
