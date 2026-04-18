import { useEffect, useMemo, useState } from 'react';
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp, doc, updateDoc, getDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, storage } from '@/src/lib/firebase';
import type { DonationRequest, DonationRequestStatus, FoodListing, UserProfile } from '@/src/types';
import { toast } from 'sonner';
import { logAudit } from '@/src/lib/audit';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import RetailSidebar, { type RetailSectionId } from './RetailSidebar';
import RetailTopbar, { type RetailTopTab } from './RetailTopbar';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MoreVertical, Plus, LayoutDashboard } from 'lucide-react';
import ManagerDashboard from '@/src/components/admin/ManagerDashboard';

export default function RetailPortal({ profile }: { profile: UserProfile }) {
  const [openManagerDashboard, setOpenManagerDashboard] = useState(false);
  const [topTab, setTopTab] = useState<RetailTopTab>('dashboard');
  const [section, setSection] = useState<RetailSectionId>('overview');

  const [listings, setListings] = useState<FoodListing[]>([]);
  const [requests, setRequests] = useState<DonationRequest[]>([]);
  const [verifiedNgos, setVerifiedNgos] = useState<UserProfile[]>([]);
  const [selectedDirectNgoId, setSelectedDirectNgoId] = useState<string>('none');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [listingPhotoFile, setListingPhotoFile] = useState<File | null>(null);
  const [newListing, setNewListing] = useState({
    title: '',
    description: '',
    category: 'produce' as FoodListing['category'],
    qty: '',
    unit: 'kg' as FoodListing['unit'],
    expiryDate: '',
    pickupWindowStart: '',
    pickupWindowEnd: '',
    location: '',
  });

  useEffect(() => {
    const qListings = query(collection(db, 'listings'), orderBy('createdAt', 'desc'));
    const unsubListings = onSnapshot(
      qListings,
      (snap) => setListings(snap.docs.map((d) => ({ id: d.id, ...d.data() } as FoodListing))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'listings')
    );

    const qReq = query(
      collection(db, 'requests'),
      where('retailerId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubReq = onSnapshot(
      qReq,
      (snap) => setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DonationRequest))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'requests')
    );

    const qNgos = query(
      collection(db, 'users'),
      where('role', '==', 'ngo'),
      where('verificationStatus', '==', 'verified'),
      orderBy('createdAt', 'desc')
    );
    const unsubNgos = onSnapshot(
      qNgos,
      (snap) => setVerifiedNgos(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'users')
    );

    return () => {
      unsubListings();
      unsubReq();
      unsubNgos();
    };
  }, [profile.uid]);

  const myListings = useMemo(() => listings.filter((l) => l.donorId === profile.uid), [listings, profile.uid]);
  const myRequests = useMemo(() => requests.filter((r) => r.retailerId === profile.uid), [requests, profile.uid]);
  const pendingRequests = useMemo(() => myRequests.filter((r) => r.status === 'pending'), [myRequests]);
  const approvedRequests = useMemo(() => myRequests.filter((r) => r.status === 'approved'), [myRequests]);
  const completedRequests = useMemo(() => myRequests.filter((r) => r.status === 'completed'), [myRequests]);

  const expiringSoonCount = useMemo(() => {
    const now = Date.now();
    const soon = now + 1000 * 60 * 60 * 24; // 24h
    return myListings.filter((l) => {
      const d = l.expiryDate?.toDate ? l.expiryDate.toDate() : l.expiryDate instanceof Date ? l.expiryDate : null;
      if (!d) return false;
      return d.getTime() > now && d.getTime() <= soon && (l.status === 'available' || l.status === 'reserved');
    }).length;
  }, [myListings]);

  const fallbackThumb = (category: FoodListing['category']) => {
    switch (category) {
      case 'produce':
        return 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=60';
      case 'bakery':
        return 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=400&q=60';
      case 'dairy':
        return 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=60';
      case 'meat':
        return 'https://images.unsplash.com/photo-1603048297172-c92544798d30?auto=format&fit=crop&w=400&q=60';
      case 'pantry':
        return 'https://images.unsplash.com/photo-1604908554027-5b2a604e2e00?auto=format&fit=crop&w=400&q=60';
      case 'prepared':
      default:
        return 'https://images.unsplash.com/photo-1604908176997-125f25cc500f?auto=format&fit=crop&w=400&q=60';
    }
  };

  const uploadListingPhoto = async (file: File) => {
    const safeName = file.name.replace(/[^\w.\-() ]+/g, '_');
    const storageRef = ref(storage, `listingPhotos/${profile.uid}/${Date.now()}-${safeName}`);
    await uploadBytes(storageRef, file, { contentType: file.type });
    return await getDownloadURL(storageRef);
  };

  const handleAddListing = async () => {
    try {
      const qty = newListing.qty ? Number(newListing.qty) : undefined;
      if (!newListing.title || !newListing.expiryDate || !newListing.location) {
        toast.error('Please fill in title, expiry date, and location.');
        return;
      }

      const photoUrl = listingPhotoFile ? await uploadListingPhoto(listingPhotoFile) : undefined;
      const directNgoId = selectedDirectNgoId !== 'none' ? selectedDirectNgoId : null;
      const directNgo = directNgoId ? verifiedNgos.find((n) => n.uid === directNgoId) || null : null;
      const referenceNumber = `FB-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;

      const listingRef = await addDoc(collection(db, 'listings'), {
        title: newListing.title,
        description: newListing.description,
        category: newListing.category,
        qty: Number.isFinite(qty) ? qty : undefined,
        unit: newListing.unit,
        quantity: newListing.qty ? `${newListing.qty} ${newListing.unit}` : '',
        photoUrl,
        donorId: profile.uid,
        donorName: profile.organizationName || profile.displayName,
        donorLocation: profile.location || null,
        status: directNgoId ? 'claimed' : 'available',
        claimedBy: directNgoId || undefined,
        claimedAt: directNgoId ? serverTimestamp() : undefined,
        expiryDate: new Date(newListing.expiryDate),
        pickupWindowStart: newListing.pickupWindowStart ? new Date(newListing.pickupWindowStart) : undefined,
        pickupWindowEnd: newListing.pickupWindowEnd ? new Date(newListing.pickupWindowEnd) : undefined,
        location: newListing.location,
        createdAt: serverTimestamp(),
      });

      if (directNgoId && directNgo) {
        await addDoc(collection(db, 'requests'), {
          listingId: listingRef.id,
          retailerId: profile.uid,
          ngoId: directNgoId,
          status: 'approved' as DonationRequestStatus,
          requestedQty: Number.isFinite(qty) ? qty : undefined,
          requestedUnit: newListing.unit,
          preferredPickupTime: newListing.pickupWindowStart ? new Date(newListing.pickupWindowStart) : undefined,
          note: 'Direct donation initiated by retailer.',
          referenceNumber,
          decision: { decidedAt: serverTimestamp(), decidedBy: profile.uid, reason: 'direct_donation' },
          ngoSnapshot: {
            organizationName: directNgo.organizationName || directNgo.displayName,
            contactPerson: directNgo.contactPerson,
            phoneNumber: directNgo.phoneNumber,
            address: directNgo.address,
            verificationStatus: directNgo.verificationStatus,
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      await logAudit({ action: 'listing_created', entityType: 'listing', metadata: { donorId: profile.uid } });
      toast.success(directNgoId ? 'Direct donation created and approved for NGO.' : 'Listing created.');
      setIsAddModalOpen(false);
      setListingPhotoFile(null);
      setSelectedDirectNgoId('none');
      setNewListing({
        title: '',
        description: '',
        category: 'produce',
        qty: '',
        unit: 'kg',
        expiryDate: '',
        pickupWindowStart: '',
        pickupWindowEnd: '',
        location: '',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'listings');
    }
  };

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
        status: 'approved' as DonationRequestStatus,
        referenceNumber,
        decision: { decidedAt: serverTimestamp(), decidedBy: profile.uid },
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
        status: 'rejected' as DonationRequestStatus,
        decision: { decidedAt: serverTimestamp(), decidedBy: profile.uid, reason },
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
        status: 'completed' as DonationRequestStatus,
        pickupConfirmation: {
          pickedUpAt: serverTimestamp(),
          actualQty: Number.isFinite(actualQty) ? actualQty : undefined,
          repName,
        },
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'listings', request.listingId), { status: 'collected' });

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

  // Map top tabs to sidebar sections to match the screenshot mental model.
  const visibleSection: RetailSectionId = useMemo(() => {
    if (topTab === 'dashboard') return section === 'donation-history' || section === 'impact-reports' ? 'overview' : section;
    if (topTab === 'analytics') return section === 'donation-history' || section === 'impact-reports' ? section : 'donation-history';
    return section; // logistics uses sidebar as-is
  }, [topTab, section]);

  const renderOverview = () => {
    const activeListings = myListings.filter((l) => l.status === 'available').length;
    const completed = myListings.filter((l) => l.status === 'collected').length;
    const totalClaims = myListings.filter((l) => l.status === 'claimed').length;
    const total = myListings.length;
    const totalFoodSavedKg = Math.round(myListings.reduce((sum, l) => sum + (l.status === 'collected' ? (Number(l.qty) || 0) : 0), 0));
    const pendingPickups = approvedRequests.length;
    const impactMeals = Math.max(0, completedRequests.length * 120 + 1000);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Total Food Saved</div>
            <div className="mt-2 text-3xl font-extrabold text-gray-900">
              {totalFoodSavedKg.toLocaleString()} <span className="text-base font-bold text-gray-500">kg</span>
            </div>
            <div className="mt-2 text-xs font-bold text-[#2D9C75]">↗ +14% from last month</div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Active Listings</div>
            <div className="mt-2 text-3xl font-extrabold text-gray-900">{activeListings}</div>
            <div className="mt-2 text-xs font-bold text-amber-600">{expiringSoonCount} expiring soon</div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Pending Pickups</div>
            <div className="mt-2 text-3xl font-extrabold text-gray-900">{pendingPickups}</div>
            <div className="mt-2 text-xs font-bold text-emerald-600">{Math.min(pendingPickups, 9)} scheduled today</div>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-900 to-emerald-700 p-6 text-white overflow-hidden relative">
            <div className="text-[10px] uppercase tracking-wider font-bold text-white/80">Impact Milestone</div>
            <div className="mt-2 text-3xl font-extrabold">{Math.max(1.2, Math.round((impactMeals / 1000000) * 10) / 10)}M Meals</div>
            <div className="mt-2 text-xs text-white/80">Bridged since inception</div>
          </div>
        </div>

        <div className="rounded-3xl overflow-hidden border border-emerald-100 bg-gradient-to-r from-[#0B5D3B] to-[#0B8A63] text-white">
          <div className="p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-white/80">Impact Milestone</div>
              <div className="mt-3 text-3xl sm:text-4xl font-extrabold">1.2M Meals Bridged since inception</div>
              <div className="mt-2 text-sm text-white/80 max-w-2xl">
                Your contributions are reshaping the local food ecosystem. Every kilogram saved is a family supported.
              </div>
            </div>
            <Button
              className="rounded-xl bg-white text-[#0B5D3B] hover:bg-white/90 font-extrabold h-11 px-6"
              onClick={() => toast.success('Impact report download will be available soon.')}
            >
              Download Full Impact Report
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-extrabold text-gray-900">Live Inventory Feed</div>
                <div className="text-sm text-gray-500 mt-1">Recent listings and their claim status</div>
              </div>
              <button className="text-xs font-bold text-[#2D9C75] hover:underline" onClick={() => setSection('inventory')}>
                View All
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {myListings.slice(0, 6).map((l) => (
                <div key={l.id} className="p-4 rounded-2xl border border-gray-100 bg-white flex items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-12 w-12 rounded-2xl bg-gray-100 overflow-hidden shrink-0">
                      <img
                        src={l.photoUrl || fallbackThumb(l.category)}
                        alt={l.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-gray-900 truncate">{l.title}</div>
                      <div className="text-[11px] text-gray-500 mt-1 truncate">
                        {(l.qty ? `${l.qty} ${l.unit || ''}` : l.quantity) || '—'} · {l.location || '—'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-bold">{l.status.toUpperCase()}</Badge>
                    <Button variant="outline" className="rounded-xl" onClick={() => setSection('inventory')}>
                      Manage
                    </Button>
                    <button className="h-9 w-9 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center hover:bg-gray-100">
                      <MoreVertical className="h-4 w-4 text-gray-500" />
                    </button>
                  </div>
                </div>
              ))}
              {myListings.length === 0 && (
                <div className="p-10 text-center text-sm text-gray-500 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  No listings yet. Create your first donation listing.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-extrabold text-gray-900">Recent Activity</div>
                  <div className="text-xs text-gray-500 mt-1">Approvals, pickups, and alerts</div>
                </div>
                <button className="text-xs font-bold text-[#2D9C75] hover:underline" onClick={() => setTopTab('logistics')}>
                  View Logistics
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {pendingRequests.slice(0, 2).map((r) => (
                  <div key={r.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50">
                    <div className="text-xs font-bold text-gray-900">New claim request</div>
                    <div className="text-[11px] text-gray-500 mt-1 truncate">{r.ngoSnapshot?.organizationName || r.ngoId} requested pickup</div>
                  </div>
                ))}
                {approvedRequests.slice(0, 1).map((r) => (
                  <div key={r.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50">
                    <div className="text-xs font-bold text-gray-900">Pickup confirmed</div>
                    <div className="text-[11px] text-gray-500 mt-1 truncate">Reference: {r.referenceNumber || '—'}</div>
                  </div>
                ))}
                {expiringSoonCount > 0 && (
                  <div className="p-3 rounded-xl border border-gray-100 bg-gray-50">
                    <div className="text-xs font-bold text-gray-900">Inventory expiring</div>
                    <div className="text-[11px] text-gray-500 mt-1">{expiringSoonCount} listings expire in 24h</div>
                  </div>
                )}
                {pendingRequests.length === 0 && approvedRequests.length === 0 && expiringSoonCount === 0 && (
                  <div className="p-6 text-center text-sm text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    No recent activity yet.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#EAF2FF] rounded-2xl border border-blue-100 p-6">
              <div className="text-sm font-extrabold text-gray-900">Expand Your Impact Network</div>
              <div className="text-xs text-gray-600 mt-1">Connect with more food banks to reduce waste.</div>
              <Button variant="outline" className="mt-4 rounded-xl bg-white">
                Discover Partners
              </Button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="text-sm font-extrabold text-gray-900">Available NGO Partners</div>
              <div className="text-xs text-gray-500 mt-1">Create direct donations with verified NGOs</div>
              <div className="mt-4 space-y-3">
                {verifiedNgos.length === 0 ? (
                  <div className="p-5 text-center text-sm text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    No verified NGO partners found.
                  </div>
                ) : (
                  verifiedNgos.slice(0, 3).map((ngo) => (
                    <div key={ngo.uid} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="text-sm font-bold text-gray-900">{ngo.organizationName || ngo.displayName}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {ngo.contributionType || 'Community support'}
                      </div>
                      {ngo.contributionSummary && (
                        <div className="text-[11px] text-gray-400 mt-1 line-clamp-2">{ngo.contributionSummary}</div>
                      )}
                      <Button
                        variant="outline"
                        className="mt-3 rounded-xl"
                        onClick={() => {
                          setSelectedDirectNgoId(ngo.uid);
                          setIsAddModalOpen(true);
                        }}
                      >
                        Start Direct Donation
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="text-sm font-extrabold text-gray-900">NGO Claims</div>
              <div className="text-xs text-gray-500 mt-1">Approve or reject requests in real-time</div>
              <div className="mt-4 space-y-3">
                {pendingRequests.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    No pending claims right now.
                  </div>
                ) : (
                  pendingRequests.slice(0, 2).map((r) => {
                    const listing = listings.find((l) => l.id === r.listingId);
                    return (
                      <div key={r.id} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                        <div className="text-sm font-bold text-gray-900 truncate">{listing?.title || 'Donation request'}</div>
                        <div className="text-xs text-gray-500 mt-1 truncate">
                          NGO: {r.ngoSnapshot?.organizationName || r.ngoId} · Qty: {r.requestedQty ?? '—'} {r.requestedUnit ?? ''}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Button variant="outline" className="rounded-xl border-red-200 text-red-600 hover:bg-red-50" onClick={() => rejectRequest(r)}>
                            Reject
                          </Button>
                          <Button className="rounded-xl bg-[#2D9C75] hover:bg-[#258563] text-white" onClick={() => approveRequest(r)}>
                            Approve
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderInventory = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-gray-900">Inventory</div>
          <div className="text-sm text-gray-500 mt-1">Your active and historical donation listings</div>
        </div>
        <Button className="bg-[#2D9C75] hover:bg-[#258563] text-white rounded-xl gap-2" onClick={() => setIsAddModalOpen(true)}>
          <Plus className="h-4 w-4" /> Create Listing
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {myListings.map((l) => (
          <div key={l.id} className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold text-gray-900 truncate">{l.title}</div>
                <div className="text-xs text-gray-500 mt-1 truncate">{l.location}</div>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold">{l.status.toUpperCase()}</Badge>
            </div>
            <div className="mt-3 text-sm text-gray-600">{l.quantity || (l.qty ? `${l.qty} ${l.unit}` : '—')}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderDonationHistory = () => (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-bold text-gray-900">Donation History</div>
        <div className="text-sm text-gray-500 mt-1">Completed pickups and estimated waste-prevented value</div>
      </div>
      <div className="space-y-3">
        {completedRequests.length === 0 ? (
          <div className="p-10 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-500">No completed pickups yet.</div>
        ) : (
          completedRequests.map((r) => {
            const listing = listings.find((l) => l.id === r.listingId);
            const qty = r.pickupConfirmation?.actualQty ?? r.requestedQty ?? 0;
            const estValue = Math.round((Number(qty) || 0) * 10);
            return (
              <div key={r.id} className="bg-white p-5 rounded-2xl border border-gray-100 flex items-center justify-between gap-4">
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
  );

  const renderImpactReports = () => (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-bold text-gray-900">Impact Reports</div>
        <div className="text-sm text-gray-500 mt-1">Charts and summaries (stub)</div>
      </div>
      <div className="bg-white p-10 rounded-2xl border border-gray-100 text-gray-600">
        Next: monthly volume charts + waste-prevented trends + export.
      </div>
    </div>
  );

  const renderTeam = () => (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-bold text-gray-900">Team</div>
        <div className="text-sm text-gray-500 mt-1">Invite and manage retailer staff (stub)</div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-2xl border border-gray-100 text-gray-700 space-y-3">
          <div className="text-sm font-bold text-gray-900">Retailer Location (for distance sorting)</div>
          <div className="text-xs text-gray-500">Set your location so NGOs can sort by distance and get better directions.</div>
          <div className="text-sm">
            Current: <span className="font-semibold">{profile.location?.address || '—'}</span>
            {profile.location?.lat && profile.location?.lng && (
              <span className="text-xs text-gray-500"> ({profile.location.lat.toFixed(4)}, {profile.location.lng.toFixed(4)})</span>
            )}
          </div>
          <Button
            className="bg-[#2D9C75] hover:bg-[#258563] text-white rounded-xl"
            onClick={() => {
              if (!navigator.geolocation) {
                toast.error('Geolocation is not supported on this device/browser.');
                return;
              }
              navigator.geolocation.getCurrentPosition(async (pos) => {
                try {
                  const lat = pos.coords.latitude;
                  const lng = pos.coords.longitude;
                  const address = window.prompt('Enter your pickup address (recommended):', profile.location?.address || '')?.trim() || '';
                  await updateDoc(doc(db, 'users', profile.uid), { location: { lat, lng, address } });
                  await logAudit({ action: 'retailer_location_updated', entityType: 'user', entityId: profile.uid });
                  toast.success('Location saved.');
                } catch (e) {
                  handleFirestoreError(e, OperationType.UPDATE, `users/${profile.uid}`);
                }
              }, () => toast.error('Failed to get location permission.'));
            }}
          >
            Use my current location
          </Button>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-gray-100 text-gray-600">
          Next: multi-user roles for a retailer organization (manager/staff) + invite emails.
        </div>
      </div>
    </div>
  );

  // Logistics: show requests + pickup schedule in one place.
  const renderLogistics = () => (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-bold text-gray-900">Logistics</div>
        <div className="text-sm text-gray-500 mt-1">Review NGO requests and confirm pickups</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="text-sm font-bold text-gray-900">Pending NGO Requests</div>
          <div className="mt-4 space-y-3">
            {pendingRequests.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">No pending requests.</div>
            ) : (
              pendingRequests.map((r) => {
                const listing = listings.find((l) => l.id === r.listingId);
                return (
                  <div key={r.id} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="font-bold text-gray-900">{listing?.title || 'Donation listing'}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      NGO: {r.ngoSnapshot?.organizationName || r.ngoId} · Qty: {r.requestedQty ?? '—'} {r.requestedUnit ?? ''}{' '}
                      {r.ngoSnapshot?.verificationStatus ? `· Verification: ${r.ngoSnapshot.verificationStatus}` : ''}
                    </div>
                    {r.note && <div className="text-xs text-gray-400 mt-2 italic">“{r.note}”</div>}
                    <div className="mt-3 flex gap-2">
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

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="text-sm font-bold text-gray-900">Pickup Schedule</div>
          <div className="mt-4 space-y-3">
            {approvedRequests.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">No approved pickups.</div>
            ) : (
              approvedRequests.map((r) => {
                const listing = listings.find((l) => l.id === r.listingId);
                return (
                  <div key={r.id} className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-gray-900 truncate">{listing?.title || 'Donation'}</div>
                      <div className="text-xs text-gray-500 mt-1 truncate">NGO: {r.ngoSnapshot?.organizationName || r.ngoId} · Ref: {r.referenceNumber || '—'}</div>
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
      </div>
    </div>
  );

  if (openManagerDashboard) {
    return <ManagerDashboard profile={profile} />;
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F8FAFA]">
      <RetailTopbar activeTab={topTab} onTabChange={setTopTab} orgName={profile.organizationName || profile.displayName} />
      <div className="flex">
        <RetailSidebar
          active={visibleSection}
          onChange={(id) => {
            setSection(id);
            // keep top tab aligned with section
            if (id === 'donation-history' || id === 'impact-reports') setTopTab('analytics');
          }}
          onNewDonation={() => setIsAddModalOpen(true)}
        />

        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto">
            <div className="mb-4 flex justify-end">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setOpenManagerDashboard(true)}
              >
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Open Manager Dashboard
              </Button>
            </div>
            {topTab === 'logistics' ? (
              renderLogistics()
            ) : visibleSection === 'overview' ? (
              renderOverview()
            ) : visibleSection === 'inventory' ? (
              renderInventory()
            ) : visibleSection === 'donation-history' ? (
              renderDonationHistory()
            ) : visibleSection === 'impact-reports' ? (
              renderImpactReports()
            ) : (
              renderTeam()
            )}
          </div>
        </main>
      </div>

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[560px] rounded-3xl">
          <DialogHeader>
            <DialogTitle>Create Donation Listing</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input value={newListing.title} onChange={(e) => setNewListing({ ...newListing, title: e.target.value })} placeholder="e.g. 50kg Fresh Tomatoes" />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input value={newListing.description} onChange={(e) => setNewListing({ ...newListing, description: e.target.value })} placeholder="Handling instructions (optional)" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select value={newListing.category} onValueChange={(v) => setNewListing({ ...newListing, category: v as any })}>
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
                  <Input value={newListing.qty} onChange={(e) => setNewListing({ ...newListing, qty: e.target.value })} placeholder="e.g. 50" />
                  <Select value={newListing.unit} onValueChange={(v) => setNewListing({ ...newListing, unit: v as any })}>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Expiry</Label>
                <Input type="date" value={newListing.expiryDate} onChange={(e) => setNewListing({ ...newListing, expiryDate: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Photo</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setListingPhotoFile(e.target.files?.[0] || null)}
                />
                <div className="text-xs text-gray-500">Optional: add a product photo for better visibility.</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Pickup window start</Label>
                <Input type="datetime-local" value={newListing.pickupWindowStart} onChange={(e) => setNewListing({ ...newListing, pickupWindowStart: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Pickup window end</Label>
                <Input type="datetime-local" value={newListing.pickupWindowEnd} onChange={(e) => setNewListing({ ...newListing, pickupWindowEnd: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Pickup location</Label>
              <Input value={newListing.location} onChange={(e) => setNewListing({ ...newListing, location: e.target.value })} placeholder="Enter address" />
            </div>

            <div className="grid gap-2">
              <Label>Direct NGO (optional)</Label>
              <Select value={selectedDirectNgoId} onValueChange={setSelectedDirectNgoId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No direct NGO (public listing)</SelectItem>
                  {verifiedNgos.map((ngo) => (
                    <SelectItem key={ngo.uid} value={ngo.uid}>
                      {ngo.organizationName || ngo.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-gray-500">
                When selected, the listing is directly approved for this NGO and appears in their pickup directions.
              </div>
            </div>

            <Button onClick={handleAddListing} className="bg-[#2D9C75] hover:bg-[#258563] text-white rounded-xl h-11 font-bold">
              Create Listing
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

