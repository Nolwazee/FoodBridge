import { useEffect, useMemo, useState } from 'react';
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
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
import { Plus } from 'lucide-react';

export default function RetailPortal({ profile }: { profile: UserProfile }) {
  const [topTab, setTopTab] = useState<RetailTopTab>('dashboard');
  const [section, setSection] = useState<RetailSectionId>('overview');

  const [listings, setListings] = useState<FoodListing[]>([]);
  const [requests, setRequests] = useState<DonationRequest[]>([]);

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

    const qReq = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const unsubReq = onSnapshot(
      qReq,
      (snap) => setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DonationRequest))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'requests')
    );

    return () => {
      unsubListings();
      unsubReq();
    };
  }, []);

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

      await addDoc(collection(db, 'listings'), {
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
        status: 'available',
        expiryDate: new Date(newListing.expiryDate),
        pickupWindowStart: newListing.pickupWindowStart ? new Date(newListing.pickupWindowStart) : undefined,
        pickupWindowEnd: newListing.pickupWindowEnd ? new Date(newListing.pickupWindowEnd) : undefined,
        location: newListing.location,
        createdAt: serverTimestamp(),
      });

      await logAudit({ action: 'listing_created', entityType: 'listing', metadata: { donorId: profile.uid } });
      toast.success('Listing created.');
      setIsAddModalOpen(false);
      setListingPhotoFile(null);
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

    return (
      <div className="space-y-6">
        <div>
          <div className="text-4xl font-bold text-gray-900">Retailer Overview</div>
          <div className="text-sm text-gray-500 mt-1">Manage your surplus food listings and track donations with professional precision.</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
            <Badge className="bg-[#E9F5F1] text-[#2D9C75] border border-[#D1EBE1] rounded-full text-[10px] font-bold">
              IMPACT HIGHLIGHT
            </Badge>
            <div className="mt-4 text-2xl font-bold text-gray-900">Your Community Impact</div>
            <div className="text-sm text-gray-500 mt-2 max-w-xl">
              Your contributions this month have helped local food banks and reduced waste through verified NGO pickups.
            </div>

            <div className="mt-8 flex items-end gap-3">
              <div className="text-6xl font-extrabold text-[#2D9C75]">{(completedRequests.length * 120 + 1000).toLocaleString()}</div>
              <div className="pb-2">
                <div className="text-sm font-bold text-gray-900">Meals Provided</div>
                <div className="text-xs text-[#2D9C75] font-semibold">↗ +12% from last month</div>
              </div>
            </div>
          </div>

          <div className="bg-[#0B8A63] rounded-2xl p-6 text-white flex flex-col justify-between">
            <div>
              <div className="h-14 w-14 rounded-2xl bg-white/15 flex items-center justify-center">
                <Plus className="h-6 w-6" />
              </div>
              <div className="mt-4 text-xl font-bold">Create New Listing</div>
              <div className="text-sm text-white/80 mt-1">Upload surplus inventory in seconds</div>
            </div>
            <Button onClick={() => setIsAddModalOpen(true)} className="bg-white text-[#0B8A63] hover:bg-white/90 rounded-xl h-11 font-bold mt-6">
              New Donation
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Active Listings', value: activeListings, hint: 'Active' },
            { label: 'Completed', value: completed, hint: 'Done' },
            { label: 'Total Claims', value: totalClaims, hint: 'Claims' },
            { label: 'Total Listings', value: total, hint: 'Total' },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">{s.hint}</div>
              <div className="mt-2 text-2xl font-extrabold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-gray-900">Recent Activity</div>
              <button className="text-xs font-bold text-[#2D9C75] hover:underline" onClick={() => setSection('donation-history')}>
                View History
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {completedRequests.slice(0, 3).map((r) => {
                const listing = listings.find((l) => l.id === r.listingId);
                return (
                  <div key={r.id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-gray-900 truncate">Donation Picked Up</div>
                      <div className="text-xs text-gray-500 truncate">{listing?.title || 'Donation'} · {r.ngoSnapshot?.organizationName || 'NGO'}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold">DONE</Badge>
                  </div>
                );
              })}
              {completedRequests.length === 0 && (
                <div className="p-8 text-center text-sm text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  No completed pickups yet. Once NGOs pick up, activity appears here.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="text-sm font-bold text-gray-900">Expiry Alerts</div>
            <div className="text-xs text-gray-500 mt-1">Active listings expiring in 24 hours</div>
            <div className="mt-5 text-4xl font-extrabold text-[#2D9C75]">{expiringSoonCount}</div>
            <div className="mt-4 text-xs text-gray-500">Tip: adjust pickup window or notify NGOs to reduce waste.</div>
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

            <Button onClick={handleAddListing} className="bg-[#2D9C75] hover:bg-[#258563] text-white rounded-xl h-11 font-bold">
              Create Listing
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

