import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import type { DonationRequest, DonationRequestStatus, FoodListing, NgoDocument, NgoDocumentType, UserProfile } from '@/src/types';
import { logAudit } from '@/src/lib/audit';
import { toast } from 'sonner';

import Sidebar from '@/src/components/Sidebar';
import ListingCard from '@/src/components/ListingCard';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, FileUp, MapPinned, Search, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

type NgoTab =
  | 'overview'
  | 'browse'
  | 'my-requests'
  | 'directions'
  | 'profile'
  | 'documents'
  | 'verification'
  | 'settings';

function getExpiryDate(listing: FoodListing): Date | null {
  const d =
    listing.expiryDate?.toDate ? listing.expiryDate.toDate() :
    listing.expiryDate instanceof Date ? listing.expiryDate :
    typeof listing.expiryDate === 'string' ? new Date(listing.expiryDate) :
    null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return d;
}

function hoursUntil(date: Date) {
  return Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60));
}

function distanceKm(a?: { lat?: number; lng?: number }, b?: { lat?: number; lng?: number }) {
  if (!a?.lat || !a?.lng || !b?.lat || !b?.lng) return null;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

async function fileToBase64NoPrefix(file: File): Promise<{ base64: string; mime: string }> {
  const mime = file.type || 'application/pdf';
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.onload = () => {
      const result = String(reader.result || '');
      // result is like: data:application/pdf;base64,XXXX
      const commaIdx = result.indexOf(',');
      if (commaIdx === -1) return reject(new Error('Unexpected file encoding.'));
      resolve({ base64: result.slice(commaIdx + 1), mime });
    };
    reader.readAsDataURL(file);
  });
}

function getNgoDocPreviewUrl(d: NgoDocument): string | null {
  if (d.fileUrl) return d.fileUrl;
  if (d.fileBase64) return `data:${d.fileMime || 'application/pdf'};base64,${d.fileBase64}`;
  return null;
}

export default function NgoPortal({ profile }: { profile: UserProfile }) {
  const [activeTab, setActiveTab] = useState<NgoTab>('overview');

  const [listings, setListings] = useState<FoodListing[]>([]);
  const [requests, setRequests] = useState<DonationRequest[]>([]);
  const [docs, setDocs] = useState<NgoDocument[]>([]);

  const [browseCategory, setBrowseCategory] = useState<'all' | FoodListing['category']>('all');
  const [browseSort, setBrowseSort] = useState<'expiry' | 'distance'>('expiry');

  const [selectedListing, setSelectedListing] = useState<FoodListing | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [newRequest, setNewRequest] = useState({
    requestedQty: '',
    requestedUnit: 'kg' as FoodListing['unit'],
    preferredPickupTime: '',
    note: '',
  });

  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [profileEdit, setProfileEdit] = useState({
    address: profile.location?.address || profile.address || '',
    lat: profile.location?.lat ? String(profile.location.lat) : '',
    lng: profile.location?.lng ? String(profile.location.lng) : '',
  });

  const [previewDoc, setPreviewDoc] = useState<NgoDocument | null>(null);

  useEffect(() => {
    setProfileEdit({
      address: profile.location?.address || profile.address || '',
      lat: profile.location?.lat ? String(profile.location.lat) : '',
      lng: profile.location?.lng ? String(profile.location.lng) : '',
    });
  }, [profile.address, profile.location?.address, profile.location?.lat, profile.location?.lng]);

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
    const qDocs = query(collection(db, 'ngoDocuments'), where('ngoId', '==', profile.uid), orderBy('uploadedAt', 'desc'));
    const unsubDocs = onSnapshot(
      qDocs,
      (snap) => setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as NgoDocument))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'ngoDocuments')
    );
    return () => {
      unsubListings();
      unsubReq();
      unsubDocs();
    };
  }, [profile.uid]);

  const availableListings = useMemo(() => listings.filter((l) => l.status === 'available'), [listings]);
  const myRequests = useMemo(() => requests.filter((r) => r.ngoId === profile.uid), [requests, profile.uid]);
  const approvedRequests = useMemo(() => myRequests.filter((r) => r.status === 'approved'), [myRequests]);
  const completedRequests = useMemo(() => myRequests.filter((r) => r.status === 'completed'), [myRequests]);

  const selectedRequest = useMemo(() => (selectedRequestId ? myRequests.find((r) => r.id === selectedRequestId) || null : null), [myRequests, selectedRequestId]);
  const selectedRequestListing = useMemo(() => {
    if (!selectedRequest) return null;
    return listings.find((l) => l.id === selectedRequest.listingId) || null;
  }, [listings, selectedRequest]);

  const nextPickup = useMemo(() => {
    const withTime = approvedRequests
      .map((r) => {
        const t = r.preferredPickupTime?.toDate ? r.preferredPickupTime.toDate() : r.preferredPickupTime instanceof Date ? r.preferredPickupTime : null;
        return { r, t };
      })
      .filter((x) => !!x.t) as { r: DonationRequest; t: Date }[];
    withTime.sort((a, b) => a.t.getTime() - b.t.getTime());
    return withTime[0] || null;
  }, [approvedRequests]);

  const browseListings = useMemo(() => {
    const filtered = availableListings
      .filter((l) => (browseCategory === 'all' ? true : l.category === browseCategory))
      .filter((l) => {
        const d = getExpiryDate(l);
        return !d || d.getTime() > Date.now();
      });

    if (browseSort === 'distance') {
      const base = profile.location || undefined;
      return [...filtered].sort((a, b) => {
        const da = distanceKm(base, a.donorLocation);
        const dbb = distanceKm(base, b.donorLocation);
        if (da == null && dbb == null) return 0;
        if (da == null) return 1;
        if (dbb == null) return -1;
        return da - dbb;
      });
    }

    // expiry sort
    return [...filtered].sort((a, b) => {
      const da = getExpiryDate(a)?.getTime() ?? Number.POSITIVE_INFINITY;
      const dbb = getExpiryDate(b)?.getTime() ?? Number.POSITIVE_INFINITY;
      return da - dbb;
    });
  }, [availableListings, browseCategory, browseSort, profile.location]);

  const saveNgoLocation = async () => {
    const address = profileEdit.address.trim();
    const lat = profileEdit.lat ? Number(profileEdit.lat) : undefined;
    const lng = profileEdit.lng ? Number(profileEdit.lng) : undefined;
    if ((profileEdit.lat || profileEdit.lng) && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
      toast.error('Latitude and longitude must be valid numbers.');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        address,
        location: {
          address,
          lat: Number.isFinite(lat) ? lat : undefined,
          lng: Number.isFinite(lng) ? lng : undefined,
        },
      });
      await logAudit({ action: 'ngo_location_updated', entityType: 'user', entityId: profile.uid });
      toast.success('Profile location saved.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  const openRequestModal = (listingId: string) => {
    const listing = listings.find((l) => l.id === listingId) || null;
    if (!listing) return;
    if (profile.verificationStatus !== 'verified') {
      toast.error('Your NGO must be verified to submit requests. Upload documents in Document Manager.');
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

  const handleUploadDoc = async (type: NgoDocumentType, file: File) => {
    try {
      // Firestore document size limit is ~1MB. Base64 increases size by ~33%.
      // Keep a conservative limit to avoid failed writes.
      const maxBytes = 700 * 1024; // ~700KB
      if (file.size > maxBytes) {
        toast.error('PDF is too large to store in Firestore. Please upload a smaller PDF (under ~700KB).');
        return;
      }
      const { base64, mime } = await fileToBase64NoPrefix(file);

      await addDoc(collection(db, 'ngoDocuments'), {
        ngoId: profile.uid,
        type,
        fileName: file.name,
        fileBase64: base64,
        fileMime: mime,
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
    const pending = myRequests.filter((r) => r.status === 'pending').length;
    const approved = approvedRequests.length;
    const completed = completedRequests.length;
    const available = availableListings.length;

    const countdownHours = nextPickup?.t ? hoursUntil(nextPickup.t) : null;

    return (
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">NGO Dashboard</h1>
              <Badge variant="outline" className="text-[10px] font-bold text-[#2D9C75] border-[#2D9C75] bg-[#E9F5F1]">
                {profile.verificationStatus.toUpperCase()}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mt-1">Live stats, upcoming pickups, and activity</p>
          </div>

          <Button variant="outline" className="rounded-xl" onClick={() => setActiveTab('browse')}>
            Browse Donations <ExternalLink className="h-4 w-4 ml-2" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Pending Requests', value: pending },
            { label: 'Approved Pickups', value: approved },
            { label: 'Completed Pickups', value: completed },
            { label: 'Available Donations', value: available },
          ].map((s, i) => (
            <div key={i} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="text-xs font-medium text-gray-400 mb-2">{s.label}</div>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
            <div className="text-sm font-bold text-gray-900">Activity Feed</div>
            <div className="mt-4 space-y-3">
              {myRequests.slice(0, 5).map((r) => {
                const listing = listings.find((l) => l.id === r.listingId);
                return (
                  <div key={r.id} className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex justify-between items-center">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-gray-900 truncate">{listing?.title || 'Request'}</div>
                      <div className="text-xs text-gray-500 truncate">Retailer: {listing?.donorName || '—'}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold">{r.status.toUpperCase()}</Badge>
                  </div>
                );
              })}
              {myRequests.length === 0 && (
                <div className="p-8 text-center text-sm text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  No activity yet. Submit your first request from Browse.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="text-sm font-bold text-gray-900">Upcoming Pickup</div>
            <div className="text-xs text-gray-500 mt-1">Countdown to next approved pickup</div>
            <div className="mt-5 text-4xl font-extrabold text-[#2D9C75]">
              {countdownHours == null ? '—' : `${Math.max(0, countdownHours)}h`}
            </div>
            {nextPickup?.r?.referenceNumber && (
              <div className="mt-2 text-xs text-gray-500">
                Reference: <span className="font-bold text-gray-900">{nextPickup.r.referenceNumber}</span>
              </div>
            )}
            <div className="mt-4">
              <Button
                className="w-full bg-[#2D9C75] hover:bg-[#258563] text-white rounded-xl"
                disabled={!nextPickup}
                onClick={() => {
                  if (!nextPickup) return;
                  setSelectedRequestId(nextPickup.r.id);
                  setActiveTab('directions');
                }}
              >
                <MapPinned className="h-4 w-4 mr-2" /> Open Directions
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderBrowse = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Browse Donations</h1>
          <p className="text-sm text-gray-500 mt-1">Filter by category, sort, and check expiry indicators</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input className="pl-10 rounded-xl border-gray-100 w-64" placeholder="Search donations..." />
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
          <Select value={browseSort} onValueChange={(v) => setBrowseSort(v as any)}>
            <SelectTrigger className="w-[180px] rounded-xl border-gray-100">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expiry">Sort by expiry</SelectItem>
              <SelectItem value="distance">Sort by distance (requires locations)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {browseListings.map((listing) => {
          const expiry = getExpiryDate(listing);
          const hrs = expiry ? hoursUntil(expiry) : null;
          const indicator =
            hrs == null ? null :
            hrs <= 0 ? { label: 'Expired', cls: 'bg-red-50 text-red-700 border-red-100' } :
            hrs <= 24 ? { label: `Expires in ${hrs}h`, cls: 'bg-amber-50 text-amber-700 border-amber-100' } :
            { label: `Expires in ${hrs}h`, cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' };

          return (
            <div key={listing.id} className="relative">
              {indicator && (
                <div className={`absolute top-3 right-3 z-10 text-[10px] font-bold px-2 py-1 rounded-full border ${indicator.cls}`}>
                  {indicator.label}
                </div>
              )}
              {browseSort === 'distance' && profile.location?.lat && profile.location?.lng && listing.donorLocation?.lat && listing.donorLocation?.lng && (
                <div className="absolute top-3 left-3 z-10 text-[10px] font-bold px-2 py-1 rounded-full border bg-white/90 text-gray-700 border-gray-100">
                  {distanceKm(profile.location, listing.donorLocation)?.toFixed(1)} km
                </div>
              )}
              <ListingCard listing={listing} canClaim onClaim={openRequestModal} canReport={false} />
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderMyRequests = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Requests</h1>
          <p className="text-sm text-gray-500 mt-1">Track approval status and open directions for approved pickups</p>
        </div>
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
          myRequests.map((r) => {
            const listing = listings.find((l) => l.id === r.listingId);
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
                <Button
                  variant="outline"
                  className="rounded-xl"
                  disabled={r.status !== 'approved'}
                  onClick={() => {
                    setSelectedRequestId(r.id);
                    setActiveTab('directions');
                  }}
                >
                  <MapPinned className="h-4 w-4 mr-2" /> Directions
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const renderDirections = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pickup Directions</h1>
        <p className="text-sm text-gray-500 mt-1">Turn-by-turn instructions, map stub, retailer contact, and reference number</p>
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
              <div className="text-sm text-gray-500">Retailer contact: <span className="font-semibold">Available in next iteration</span></div>
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
  );

  const renderProfile = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">NGO Profile</h1>
        <p className="text-sm text-gray-500 mt-1">Organisational details, beneficiary stats, transport capacity, and location</p>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-400">Organisation</div>
            <div className="text-sm font-bold text-gray-900">{profile.organizationName || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Registration Number</div>
            <div className="text-sm font-bold text-gray-900">{profile.registrationNumber || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Contact Person</div>
            <div className="text-sm font-bold text-gray-900">{profile.contactPerson || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Phone</div>
            <div className="text-sm font-bold text-gray-900">{profile.phoneNumber || '—'}</div>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs text-gray-400">Address</div>
            <div className="text-sm font-bold text-gray-900">{profile.address || '—'}</div>
          </div>
        </div>
        <div className="rounded-xl border border-dashed border-gray-200 p-4 bg-gray-50">
          <div className="text-sm font-bold text-gray-900 mb-3">Location (enables distance sorting)</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-3 grid gap-2">
              <Label>Address</Label>
              <Input value={profileEdit.address} onChange={(e) => setProfileEdit({ ...profileEdit, address: e.target.value })} placeholder="Enter your address" />
            </div>
            <div className="grid gap-2">
              <Label>Latitude</Label>
              <Input value={profileEdit.lat} onChange={(e) => setProfileEdit({ ...profileEdit, lat: e.target.value })} placeholder="-26.2041" />
            </div>
            <div className="grid gap-2">
              <Label>Longitude</Label>
              <Input value={profileEdit.lng} onChange={(e) => setProfileEdit({ ...profileEdit, lng: e.target.value })} placeholder="28.0473" />
            </div>
            <div className="flex items-end gap-2">
              <Button className="bg-[#2D9C75] hover:bg-[#258563] text-white rounded-xl" onClick={saveNgoLocation}>
                Save Location
              </Button>
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  if (!navigator.geolocation) {
                    toast.error('Geolocation is not supported on this device/browser.');
                    return;
                  }
                  navigator.geolocation.getCurrentPosition((pos) => {
                    setProfileEdit({
                      ...profileEdit,
                      lat: String(pos.coords.latitude),
                      lng: String(pos.coords.longitude),
                    });
                    toast.success('Coordinates filled. Click Save Location.');
                  }, () => toast.error('Failed to get location permission.'));
                }}
              >
                <Navigation className="h-4 w-4 mr-2" /> Use my location
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDocuments = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Document Manager</h1>
        <p className="text-sm text-gray-500 mt-1">Upload PDFs and track review status</p>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {([
            { type: 'npo_certificate', label: 'NPO Certificate' },
            { type: 'cipc', label: 'CIPC' },
            { type: 'pbo', label: 'PBO' },
            { type: 'board_resolution', label: 'Board Resolution' },
            { type: 'bank_confirmation', label: 'Bank Confirmation' },
          ] as { type: NgoDocumentType; label: string }[]).map((item) => {
            const docItem = docs.find((d) => d.type === item.type) || null;
            const previewUrl = docItem ? getNgoDocPreviewUrl(docItem) : null;
            const inputId = `ngo-doc-upload-${item.type}`;
            return (
              <div key={item.type} className="rounded-xl border border-gray-100 p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-gray-900 text-sm">{item.label}</div>
                  <div className="text-xs text-gray-500 mt-1">Status: {(docItem?.status || 'missing').toUpperCase()}</div>
                  {docItem?.rejectionReason && <div className="text-xs text-red-600 mt-1">{docItem.rejectionReason}</div>}
                </div>
                <div className="flex items-center gap-2">
                  {previewUrl && (
                    <Button variant="outline" className="rounded-xl" onClick={() => setPreviewDoc(docItem)}>
                      Preview
                    </Button>
                  )}
                  <input
                    id={inputId}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadDoc(item.type, file);
                      e.currentTarget.value = '';
                    }}
                  />
                  <label
                    htmlFor={inputId}
                    className={cn(
                      buttonVariants({ variant: 'outline' }),
                      'rounded-xl cursor-pointer'
                    )}
                  >
                    <FileUp className="h-4 w-4 mr-2" /> Upload PDF
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderVerification = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Verification Status</h1>
        <p className="text-sm text-gray-500 mt-1">Track your verification progress</p>
      </div>
      <div className="bg-white p-6 rounded-2xl border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400">Current Status</div>
            <div className="text-xl font-extrabold text-gray-900">{profile.verificationStatus.toUpperCase()}</div>
          </div>
          <Badge className="bg-[#E9F5F1] text-[#2D9C75] border border-[#D1EBE1] rounded-full text-[10px] font-bold">
            {profile.isVerified ? 'VERIFIED' : 'PENDING'}
          </Badge>
        </div>
        <div className="mt-4 text-sm text-gray-600">
          Upload all required documents in the Document Manager. Admin will review and approve/reject with reasons if needed.
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[calc(100vh-64px)] bg-[#F8FAFA]">
      <Sidebar role="ngo" activeTab={activeTab} onTabChange={(t) => setActiveTab(t as NgoTab)} />
      <main className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'browse' && renderBrowse()}
        {activeTab === 'my-requests' && renderMyRequests()}
        {activeTab === 'directions' && renderDirections()}
        {activeTab === 'profile' && renderProfile()}
        {activeTab === 'documents' && renderDocuments()}
        {activeTab === 'verification' && renderVerification()}
        {activeTab === 'settings' && (
          <div className="bg-white p-10 rounded-2xl border border-gray-100 text-gray-600">Settings (stub)</div>
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

        <Dialog open={!!previewDoc} onOpenChange={(open) => { if (!open) setPreviewDoc(null); }}>
          <DialogContent className="sm:max-w-[900px] rounded-3xl">
            <DialogHeader>
              <DialogTitle>PDF Preview</DialogTitle>
            </DialogHeader>
            {previewDoc && (
              <div className="space-y-3">
                <div className="text-sm font-bold text-gray-900">{previewDoc.fileName}</div>
                <div className="h-[70vh] rounded-xl border border-gray-100 overflow-hidden bg-gray-50">
                  <iframe
                    title="PDF Preview"
                    src={getNgoDocPreviewUrl(previewDoc) || undefined}
                    className="w-full h-full"
                  />
                </div>
                <div className="text-xs text-gray-500">
                  If the preview doesn’t load in your browser, use a smaller PDF or download and open locally.
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

