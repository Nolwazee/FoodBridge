import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
  getDoc,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { toast } from 'sonner';
import {
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  LogOut,
  ChevronRight,
  Search,
  Filter,
  ArrowUpDown,
  Eye,
  Navigation,
  FileText,
  Upload,
  X,
  RefreshCw,
  Truck,
  Package,
  Users,
  TrendingUp,
  Award,
  Bell,
  Settings,
  UserCircle,
  FileCheck,
  CreditCard,
  Home,
  ShoppingBag,
  ClipboardList,
  Map,
  Building,
  Shield,
  Download,
  ExternalLink,
  Phone,
  Mail,
  Star,
  ThumbsUp,
  AlertTriangle,
} from 'lucide-react';

// ==================== TYPES ====================
interface GeoPoint {
  lat: number;
  lng: number;
  address?: string;
}

interface FoodListing {
  id: string;
  title: string;
  description?: string;
  qty: number;
  unit: string;
  category: 'produce' | 'bakery' | 'dairy' | 'meat' | 'pantry' | 'prepared' | 'other';
  status: 'available' | 'claimed' | 'expired' | 'completed';
  expiryDate?: Date | Timestamp;
  donorName: string;
  donorId: string;
  donorEmail?: string;
  donorPhone?: string;
  donorLocation?: GeoPoint;
  location?: string;
  pickupWindowStart?: Timestamp;
  pickupWindowEnd?: Timestamp;
  images?: string[];
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

interface DonationRequest {
  id: string;
  listingId: string;
  ngoId: string;
  retailerId: string;
  requestedQty: number;
  requestedUnit: string;
  status: 'pending' | 'approved' | 'completed' | 'rejected' | 'cancelled' | 'pending_verification';
  preferredPickupTime?: Timestamp;
  actualPickupTime?: Timestamp;
  note?: string;
  rejectionReason?: string;
  referenceNumber?: string;
  ngoSnapshot: {
    organizationName?: string;
    contactPerson?: string;
    phoneNumber?: string;
    address?: string;
    verificationStatus?: string;
  };
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

interface NgoDocument {
  id: string;
  ngoId: string;
  type: 'npo_certificate' | 'cipc' | 'pbo' | 'board_resolution' | 'bank_confirmation';
  fileName: string;
  fileUrl?: string;
  fileBase64?: string;
  fileMime?: string;
  status: 'submitted' | 'approved' | 'rejected';
  rejectionReason?: string;
  uploadedAt: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
}

interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  organizationName?: string;
  registrationNumber?: string;
  contactPerson?: string;
  phoneNumber?: string;
  address?: string;
  location?: GeoPoint;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  isVerified: boolean;
  role: 'ngo' | 'retailer' | 'admin';
  contributionType?: string;
  contributionSummary?: string;
  beneficiaryCount?: number;
  transportCapacity?: string;
  operatingHours?: string;
  website?: string;
  logo?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

type NgoTab = 
  | 'overview' 
  | 'browse' 
  | 'my-requests' 
  | 'directions' 
  | 'profile' 
  | 'documents' 
  | 'verification' 
  | 'settings' 
  | 'analytics'
  | 'impact';

// ==================== UTILITIES ====================
const getExpiryDate = (expiry: any): Date | null => {
  if (!expiry) return null;
  if (expiry.toDate) return expiry.toDate();
  if (expiry instanceof Date) return expiry;
  if (typeof expiry === 'string') return new Date(expiry);
  return null;
};

const hoursUntil = (date: Date): number => {
  return Math.max(0, Math.round((date.getTime() - Date.now()) / 3600000));
};

const formatHoursRemaining = (hours: number): string => {
  if (hours <= 0) return 'Expired';
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''}`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours === 0) return `${days} day${days !== 1 ? 's' : ''}`;
  return `${days}d ${remainingHours}h`;
};

const distanceKm = (a?: GeoPoint, b?: GeoPoint): number | null => {
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
};

const getListingQty = (listing: FoodListing): number => {
  const directQty = Number((listing as any)?.qty);
  if (Number.isFinite(directQty) && directQty > 0) return directQty;

  const quantityText = typeof (listing as any)?.quantity === 'string' ? (listing as any).quantity.trim() : '';
  if (quantityText) {
    const match = quantityText.match(/^(\d+(?:\.\d+)?)/);
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  return 0;
};

const listingCreatedMs = (listing: FoodListing): number => {
  const c = (listing as any).createdAt as Timestamp | Date | undefined;
  if (c && typeof (c as Timestamp).toMillis === 'function') return (c as Timestamp).toMillis();
  if (c instanceof Date) return c.getTime();
  return 0;
};

const fallbackImageForCategory = (category: FoodListing['category']): string => {
  switch (category) {
    case 'produce':
      return 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=75';
    case 'bakery':
      return 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=1200&q=75';
    case 'dairy':
      return 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=1200&q=75';
    case 'meat':
      return 'https://images.unsplash.com/photo-1603048297172-c92544798d30?auto=format&fit=crop&w=1200&q=75';
    case 'pantry':
      return 'https://images.unsplash.com/photo-1604908554027-5b2a604e2e00?auto=format&fit=crop&w=1200&q=75';
    case 'prepared':
    default:
      return 'https://images.unsplash.com/photo-1604908176997-125f25cc500f?auto=format&fit=crop&w=1200&q=75';
  }
};

const generateReferenceNumber = (): string => {
  return `FB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
};

const formatDate = (date: Date | Timestamp | undefined): string => {
  if (!date) return 'N/A';
  const d = date instanceof Timestamp ? date.toDate() : date;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (date: Date | Timestamp | undefined): string => {
  if (!date) return 'N/A';
  const d = date instanceof Timestamp ? date.toDate() : date;
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

// ==================== COMPONENTS ====================

// Stat Card Component
const StatCard: React.FC<{ label: string; value: number; icon: React.ReactNode; color: string; subtitle?: string }> = 
  ({ label, value, icon, color, subtitle }) => (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 group">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-black text-slate-800 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`h-12 w-12 rounded-full bg-${color}-100 flex items-center justify-center group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
      </div>
    </div>
  );

// Status Badge Component
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    pending: { color: 'amber', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
    approved: { color: 'emerald', icon: <CheckCircle className="w-3 h-3" />, label: 'Approved' },
    completed: { color: 'blue', icon: <Truck className="w-3 h-3" />, label: 'Completed' },
    rejected: { color: 'red', icon: <AlertCircle className="w-3 h-3" />, label: 'Rejected' },
    cancelled: { color: 'gray', icon: <X className="w-3 h-3" />, label: 'Cancelled' },
    pending_verification: { color: 'purple', icon: <Shield className="w-3 h-3" />, label: 'Pending Verification' },
  };
  const c = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-${c.color}-50 text-${c.color}-700 border border-${c.color}-100`}>
      {c.icon}
      {c.label}
    </span>
  );
};

// Listing Card Component
const ListingCard: React.FC<{ listing: FoodListing; onRequest: (id: string) => void; userLocation?: GeoPoint }> = 
  ({ listing, onRequest, userLocation }) => {
    const expiryDate = getExpiryDate(listing.expiryDate);
    const hrsLeft = expiryDate ? hoursUntil(expiryDate) : null;
    const distance = userLocation ? distanceKm(userLocation, listing.donorLocation) : null;
    const isUrgent = hrsLeft !== null && hrsLeft <= 12 && hrsLeft > 0;
    const isExpiringSoon = hrsLeft !== null && hrsLeft <= 24 && hrsLeft > 0;
    const imgSrc = listing.photoUrl?.trim() || fallbackImageForCategory(listing.category);
    const donorEmail = listing.donorEmail;
    const donorPhone = listing.donorPhone;
    const descText = listing.description?.trim() || '';
    
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group flex flex-col">
        <div className="relative h-44 w-full shrink-0">
          <img
            src={imgSrc}
            alt={listing.title}
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const el = e.currentTarget;
              if (el.dataset.fallback === '1') return;
              el.dataset.fallback = '1';
              el.src = fallbackImageForCategory('produce');
            }}
          />
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 shadow-sm">
              {listing.category}
            </span>
          </div>
          {isUrgent && (
            <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
              URGENT
            </div>
          )}
          {isExpiringSoon && !isUrgent && (
            <div className="absolute top-3 right-3 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              Expiring Soon
            </div>
          )}
          {distance !== null && (
            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {distance.toFixed(1)} km
            </div>
          )}
        </div>
        <div className="p-4 flex flex-col flex-1 min-h-0">
          <h4 className="font-bold text-slate-800 text-lg leading-snug">{listing.title}</h4>
          
          <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3 space-y-2 text-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Retailer donating</p>
            <div className="flex items-start gap-2 text-slate-800">
              <Building className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold">{listing.donorName || 'Retailer'}</p>
                <p className="text-xs text-slate-500 mt-0.5">Donor account for this surplus listing</p>
              </div>
            </div>
            <div className="flex items-start gap-2 text-slate-700">
              <MapPin className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div className="min-w-0 text-xs">
                <p className="font-medium text-slate-800">Pickup location</p>
                <p className="mt-0.5">{listing.location || '—'}</p>
                {listing.donorLocation?.address && listing.donorLocation.address !== listing.location && (
                  <p className="mt-1 text-slate-500">Store / org address: {listing.donorLocation.address}</p>
                )}
              </div>
            </div>
            {(donorEmail || donorPhone) && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 pt-1 border-t border-slate-200/80">
                {donorEmail && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {donorEmail}
                  </span>
                )}
                {donorPhone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {donorPhone}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="mt-3 min-h-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Description</p>
            <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap break-words leading-relaxed">
              {descText || 'The retailer did not add a written description for this listing.'}
            </p>
          </div>

          {hrsLeft !== null && (
            <div className={`mt-3 text-xs font-medium ${hrsLeft <= 24 ? 'text-red-500' : 'text-slate-500'}`}>
              <Clock className="w-3.5 h-3.5 inline mr-1 align-text-bottom" />
              {hrsLeft <= 0 ? 'Expired' : `Expires in ${formatHoursRemaining(hrsLeft)}`}
            </div>
          )}
          <button
            type="button"
            onClick={() => onRequest(listing.id)}
            disabled={(hrsLeft !== null && hrsLeft <= 0) || listing.status !== 'available'}
            className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <HandHeart className="w-4 h-4" />
            {listing.status === 'reserved' ? 'Reserved by another party' : 'Request donation'}
          </button>
        </div>
      </div>
    );
  };

// Custom icon components
const HandHeart: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);

// ==================== MAIN COMPONENT ====================
export default function NgoPortal({ profile }: { profile: UserProfile }) {
  // State
  const [activeTab, setActiveTab] = useState<NgoTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [listings, setListings] = useState<FoodListing[]>([]);
  const [requests, setRequests] = useState<DonationRequest[]>([]);
  const [documents, setDocuments] = useState<NgoDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filter/Sort State
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'expiry' | 'distance' | 'newest'>('expiry');
  
  // Modal State
  const [selectedListing, setSelectedListing] = useState<FoodListing | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestForm, setRequestForm] = useState({
    preferredPickupTime: '',
    notes: '',
  });
  
  // Document Upload State
  const [uploadingDoc, setUploadingDoc] = useState<NgoDocument['type'] | null>(null);
  const [previewDoc, setPreviewDoc] = useState<NgoDocument | null>(null);
  
  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    organizationName: profile.organizationName || '',
    contactPerson: profile.contactPerson || '',
    phoneNumber: profile.phoneNumber || '',
    address: profile.address || '',
    contributionType: profile.contributionType || '',
    contributionSummary: profile.contributionSummary || '',
    beneficiaryCount: profile.beneficiaryCount || '',
    transportCapacity: profile.transportCapacity || '',
    operatingHours: profile.operatingHours || '',
    website: profile.website || '',
    lat: profile.location?.lat?.toString() || '',
    lng: profile.location?.lng?.toString() || '',
  });
  
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [notificationCount, setNotificationCount] = useState(3);
  const [showNotifications, setShowNotifications] = useState(false);

  // ==================== FIREBASE SUBSCRIPTIONS ====================
  
  // Fetch listings: full collection + client filter/sort avoids composite-index failures
  // (where('status', 'in', ...) + orderBy('createdAt') often needs a manual index and returns nothing on error).
  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, 'listings'),
      (snapshot) => {
        const data = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() } as FoodListing))
          .sort((a, b) => listingCreatedMs(b) - listingCreatedMs(a));
        setListings(data);
        setIsLoading(false);
      },
      (error) => {
        console.error('Listings listener error:', error);
        toast.error('Failed to load donations. Check Firestore rules and your connection.');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);
  
  // Fetch NGO's requests
  useEffect(() => {
    const q = query(
      collection(db, 'requests'),
      where('ngoId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DonationRequest));
      setRequests(data);
    });
    
    return () => unsubscribe();
  }, [profile.uid]);
  
  // Fetch documents
  useEffect(() => {
    const q = query(
      collection(db, 'ngoDocuments'),
      where('ngoId', '==', profile.uid),
      orderBy('uploadedAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NgoDocument));
      setDocuments(data);
    });
    
    return () => unsubscribe();
  }, [profile.uid]);

  // ==================== DERIVED DATA ====================
  
  const availableListings = useMemo(
    () => listings.filter((l) => l.status === 'available' || l.status === 'reserved'),
    [listings]
  );

  /** Listings a retailer marked as a direct donation to this NGO (already claimed on create). */
  const directDonationListings = useMemo(
    () =>
      listings.filter((l) => l.status === 'claimed' && l.claimedBy === profile.uid),
    [listings, profile.uid]
  );
  
  const myRequests = useMemo(() => 
    requests.filter(r => r.ngoId === profile.uid), 
    [requests, profile.uid]
  );
  
  const pendingRequests = useMemo(() => 
    myRequests.filter(r => r.status === 'pending').length, 
    [myRequests]
  );
  
  const approvedRequests = useMemo(() => 
    myRequests.filter(r => r.status === 'approved'), 
    [myRequests]
  );
  
  const completedRequests = useMemo(() => 
    myRequests.filter(r => r.status === 'completed').length, 
    [myRequests]
  );
  
  const rejectedRequests = useMemo(() => 
    myRequests.filter(r => r.status === 'rejected').length, 
    [myRequests]
  );
  
  // Next upcoming pickup
  const nextPickup = useMemo(() => {
    const approved = approvedRequests.filter(r => r.status === 'approved');
    if (approved.length === 0) return null;
    
    const withTime = approved
      .map(req => {
        const listing = listings.find(l => l.id === req.listingId);
        const pickupDate = req.preferredPickupTime?.toDate() || null;
        return { req, listing, pickupDate };
      })
      .filter(item => item.pickupDate !== null);
    
    if (withTime.length === 0) return null;
    withTime.sort((a, b) => a.pickupDate!.getTime() - b.pickupDate!.getTime());
    return withTime[0];
  }, [approvedRequests, listings]);
  
  const hoursUntilPickup = nextPickup?.pickupDate ? hoursUntil(nextPickup.pickupDate) : null;
  
  // Total food rescued (sum of completed request quantities)
  const totalFoodRescued = useMemo(() => {
    return myRequests
      .filter(r => r.status === 'completed')
      .reduce((sum, r) => sum + (r.requestedQty || 0), 0);
  }, [myRequests]);
  
  // Filtered and sorted listings for browse
  const filteredListings = useMemo(() => {
    let filtered = availableListings;
    
    // Apply search
    if (searchQuery) {
      const queryLower = searchQuery.toLowerCase();
      filtered = filtered.filter((l) =>
        l.title.toLowerCase().includes(queryLower) ||
        (l.donorName || '').toLowerCase().includes(queryLower) ||
        (l.category || '').toLowerCase().includes(queryLower)
      );
    }
    
    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(l => l.category === categoryFilter);
    }
    
    // Remove expired
    filtered = filtered.filter(l => {
      const expiry = getExpiryDate(l.expiryDate);
      return !expiry || expiry.getTime() > Date.now();
    });
    
    // Apply sorting
    if (sortBy === 'distance') {
      return [...filtered].sort((a, b) => {
        const distA = distanceKm(profile.location, a.donorLocation) ?? 999;
        const distB = distanceKm(profile.location, b.donorLocation) ?? 999;
        return distA - distB;
      });
    } else if (sortBy === 'expiry') {
      return [...filtered].sort((a, b) => {
        const expiryA = getExpiryDate(a.expiryDate)?.getTime() ?? Infinity;
        const expiryB = getExpiryDate(b.expiryDate)?.getTime() ?? Infinity;
        return expiryA - expiryB;
      });
    } else if (sortBy === 'newest') {
      return [...filtered].sort((a, b) => listingCreatedMs(b) - listingCreatedMs(a));
    } else {
      return filtered;
    }
  }, [availableListings, searchQuery, categoryFilter, sortBy, profile.location]);
  
  const selectedRequest = useMemo(() => {
    if (!selectedRequestId) return null;
    return myRequests.find(r => r.id === selectedRequestId) || null;
  }, [myRequests, selectedRequestId]);
  
  const selectedRequestListing = useMemo(() => {
    if (!selectedRequest) return null;
    return listings.find(l => l.id === selectedRequest.listingId) || null;
  }, [listings, selectedRequest]);

  // ==================== ACTIONS ====================
  
  const openRequestModal = (listingId: string) => {
    const listing = listings.find(l => l.id === listingId);
    if (!listing) return;
    
    if (profile.verificationStatus !== 'verified') {
      toast.error('Your NGO must be verified to submit requests. Please upload required documents.');
      setActiveTab('documents');
      return;
    }
    
    setSelectedListing(listing);
    setRequestForm({
      preferredPickupTime: '',
      notes: '',
    });
    setIsRequestModalOpen(true);
  };
  
  const submitRequest = async () => {
    if (!selectedListing || isSubmittingRequest) return;

    const availableQty = getListingQty(selectedListing);
    if (!availableQty || availableQty <= 0) {
      toast.error('This listing has no quantity set. Contact the retailer.');
      return;
    }
    const requestedQty = availableQty;
    
    try {
      setIsSubmittingRequest(true);
      const referenceNumber = generateReferenceNumber();
      
      await addDoc(collection(db, 'requests'), {
        listingId: selectedListing.id,
        ngoId: profile.uid,
        retailerId: selectedListing.donorId,
        requestedQty,
        requestedUnit: selectedListing.unit || 'unit',
        status: 'pending',
        preferredPickupTime: requestForm.preferredPickupTime ? new Date(requestForm.preferredPickupTime) : null,
        note: requestForm.notes,
        referenceNumber,
        ngoSnapshot: {
          organizationName: profile.organizationName || profile.displayName,
          contactPerson: profile.contactPerson || null,
          phoneNumber: profile.phoneNumber || null,
          address: profile.address || null,
          verificationStatus: profile.verificationStatus || 'pending',
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      toast.success(`Request submitted! Reference: ${referenceNumber}`);
      setIsRequestModalOpen(false);
      setSelectedListing(null);
      setRequestForm({ preferredPickupTime: '', notes: '' });
      
      // Send notification (simulate)
      setNotificationCount(prev => prev + 1);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'requests');
    } finally {
      setIsSubmittingRequest(false);
    }
  };
  
  const cancelRequest = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'requests', requestId), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
      toast.success('Request cancelled');
    } catch (error) {
      console.error('Error cancelling request:', error);
      toast.error('Failed to cancel request');
    }
  };
  
  const updateProfile = async () => {
    try {
      const updates: any = {
        organizationName: profileForm.organizationName,
        contactPerson: profileForm.contactPerson,
        phoneNumber: profileForm.phoneNumber,
        address: profileForm.address,
        contributionType: profileForm.contributionType,
        contributionSummary: profileForm.contributionSummary,
        beneficiaryCount: profileForm.beneficiaryCount ? Number(profileForm.beneficiaryCount) : null,
        transportCapacity: profileForm.transportCapacity,
        operatingHours: profileForm.operatingHours,
        website: profileForm.website,
        updatedAt: serverTimestamp(),
      };
      
      if (profileForm.lat && profileForm.lng) {
        updates.location = {
          lat: Number(profileForm.lat),
          lng: Number(profileForm.lng),
          address: profileForm.address,
        };
      }
      
      await updateDoc(doc(db, 'users', profile.uid), updates);
      toast.success('Profile updated successfully');
      setIsEditingProfile(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    }
  };
  
  const handleFileUpload = async (type: NgoDocument['type'], file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are allowed');
      return;
    }
    
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error('File size must be less than 5MB');
      return;
    }
    
    setUploadingDoc(type);
    
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
      });
      
      const docId = `${profile.uid}_${type}`;
      await setDoc(doc(db, 'ngoDocuments', docId), {
        ngoId: profile.uid,
        type,
        fileName: file.name,
        fileBase64: base64,
        fileMime: file.type,
        status: 'submitted',
        uploadedAt: serverTimestamp(),
      }, { merge: true });
      
      toast.success(`${type.replace('_', ' ').toUpperCase()} uploaded successfully`);
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Failed to upload document');
    } finally {
      setUploadingDoc(null);
    }
  };
  
  const confirmPickup = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'requests', requestId), {
        status: 'completed',
        actualPickupTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      // Also update the listing status
      const request = myRequests.find(r => r.id === requestId);
      if (request) {
        await updateDoc(doc(db, 'listings', request.listingId), {
          status: 'completed',
          updatedAt: serverTimestamp(),
        });
      }
      
      toast.success('Pickup confirmed! Thank you for reducing food waste.');
    } catch (error) {
      console.error('Error confirming pickup:', error);
      toast.error('Failed to confirm pickup');
    }
  };
  
  const getDocumentStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle className="w-3 h-3" /> Approved</span>;
      case 'rejected':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><AlertCircle className="w-3 h-3" /> Rejected</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3" /> Pending</span>;
    }
  };

  // ==================== RENDER FUNCTIONS ====================
  
  const renderOverview = () => (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold">Welcome back, {profile.organizationName || profile.displayName || 'NGO'}!</h2>
            <p className="text-emerald-100 mt-1">Track your impact and manage donations</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2">
            <span className="text-sm font-semibold">{profile.verificationStatus.toUpperCase()}</span>
          </div>
        </div>
        <div className="mt-4 flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4" />
            <span>{approvedRequests.length} Active Pickups</span>
          </div>
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            <span>{totalFoodRescued} kg Rescued</span>
          </div>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          label="Pending Requests" 
          value={pendingRequests} 
          icon={<Clock className="w-6 h-6 text-amber-600" />}
          color="amber"
          subtitle="Awaiting approval"
        />
        <StatCard 
          label="Approved Pickups" 
          value={approvedRequests.length} 
          icon={<CheckCircle className="w-6 h-6 text-emerald-600" />}
          color="emerald"
          subtitle="Ready for pickup"
        />
        <StatCard 
          label="Completed Pickups" 
          value={completedRequests} 
          icon={<Truck className="w-6 h-6 text-blue-600" />}
          color="blue"
          subtitle="This week"
        />
        <StatCard 
          label="Available Donations" 
          value={availableListings.length} 
          icon={<Package className="w-6 h-6 text-purple-600" />}
          color="purple"
          subtitle="Nearby"
        />
      </div>
      
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/30">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-500" />
                Recent Activity
              </h3>
              <button className="text-xs text-emerald-600 hover:text-emerald-700">View All</button>
            </div>
          </div>
          <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
            {myRequests.slice(0, 5).map((req) => {
              const listing = listings.find(l => l.id === req.listingId);
              return (
                <div key={req.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800">{listing?.title || 'Donation Request'}</span>
                        <StatusBadge status={req.status} />
                      </div>
                      <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                        <Building className="w-3 h-3" />
                        {listing?.donorName || 'Retailer'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {req.requestedQty} {req.requestedUnit} requested • {formatDate(req.createdAt)}
                      </p>
                      {req.referenceNumber && (
                        <p className="text-xs font-mono text-emerald-600 mt-1">Ref: {req.referenceNumber}</p>
                      )}
                    </div>
                    {req.status === 'approved' && (
                      <button
                        onClick={() => confirmPickup(req.id)}
                        className="ml-4 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        Confirm Pickup
                      </button>
                    )}
                    {req.status === 'pending' && (
                      <button
                        onClick={() => cancelRequest(req.id)}
                        className="ml-4 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {myRequests.length === 0 && (
              <div className="p-12 text-center">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No requests yet</p>
                <button 
                  onClick={() => setActiveTab('browse')}
                  className="mt-3 text-emerald-600 text-sm font-medium hover:underline"
                >
                  Browse Donations →
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Next Pickup Card */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700/50">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-400" />
              Next Scheduled Pickup
            </h3>
          </div>
          <div className="p-6">
            {nextPickup ? (
              <>
                <div className="text-center">
                  <div className="text-6xl font-black text-white mb-2">
                    {hoursUntilPickup !== null ? hoursUntilPickup : '—'}
                  </div>
                  <p className="text-emerald-300 text-sm font-medium tracking-wide">Hours Remaining</p>
                  
                  <div className="mt-6 space-y-3 text-left">
                    <div className="bg-white/10 rounded-lg p-3">
                      <p className="text-sm text-gray-300">Donation</p>
                      <p className="font-semibold text-white">{nextPickup.listing?.title}</p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3">
                      <p className="text-sm text-gray-300">Retailer</p>
                      <p className="font-semibold text-white flex items-center gap-2">
                        <Building className="w-4 h-4" />
                        {nextPickup.listing?.donorName}
                      </p>
                    </div>
                    {nextPickup.req.referenceNumber && (
                      <div className="bg-white/10 rounded-lg p-3">
                        <p className="text-sm text-gray-300">Reference Number</p>
                        <p className="font-mono text-emerald-400 text-sm">{nextPickup.req.referenceNumber}</p>
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => {
                      setSelectedRequestId(nextPickup.req.id);
                      setActiveTab('directions');
                    }}
                    className="mt-6 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <Navigation className="w-4 h-4" />
                    Get Directions
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-300">No upcoming pickups</p>
                <p className="text-slate-400 text-sm mt-1">Browse donations to schedule your first pickup</p>
                <button
                  onClick={() => setActiveTab('browse')}
                  className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Browse Donations
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Impact Summary */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-emerald-500" />
          Your Impact
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-emerald-50 rounded-xl">
            <div className="text-3xl font-black text-emerald-600">{totalFoodRescued}</div>
            <div className="text-sm text-slate-600">kg of food rescued</div>
            <div className="text-xs text-slate-400 mt-1">≈ {Math.round(totalFoodRescued * 2.5)} meals</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-xl">
            <div className="text-3xl font-black text-blue-600">{completedRequests}</div>
            <div className="text-sm text-slate-600">completed pickups</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-xl">
            <div className="text-3xl font-black text-purple-600">{profile.beneficiaryCount || 0}</div>
            <div className="text-sm text-slate-600">beneficiaries served</div>
          </div>
        </div>
      </div>
    </div>
  );
  
  const renderBrowse = () => (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Browse Donations</h1>
          <p className="text-sm text-gray-500 mt-1">Find and request surplus food from local retailers</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search donations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl w-64 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
          >
            <option value="all">All Categories</option>
            <option value="produce">Produce</option>
            <option value="bakery">Bakery</option>
            <option value="dairy">Dairy</option>
            <option value="meat">Meat</option>
            <option value="pantry">Pantry</option>
            <option value="prepared">Prepared Meals</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
          >
            <option value="expiry">Sort by Expiry (Soonest first)</option>
            <option value="distance">Sort by Distance (Nearest first)</option>
            <option value="newest">Sort by Newest</option>
          </select>
        </div>
      </div>

      {directDonationListings.length > 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-white/90 p-5 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Directed to your organization</h2>
            <p className="text-sm text-gray-500 mt-1">
              Retailers created these as direct donations for you. They do not appear under open listings. Use My Requests and Directions for pickup.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {directDonationListings.map((listing) => {
              const matchReq = myRequests.find((r) => r.listingId === listing.id);
              return (
                <div key={listing.id} className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 flex flex-col gap-2">
                  <div className="font-bold text-gray-900 truncate">{listing.title}</div>
                  <div className="text-xs text-gray-500 truncate">{listing.location || '—'}</div>
                  <div className="text-sm text-emerald-800 font-semibold">
                    {getListingQty(listing) || '—'} {listing.unit || ''}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (matchReq) setSelectedRequestId(matchReq.id);
                      setActiveTab(matchReq?.status === 'approved' ? 'directions' : 'my-requests');
                    }}
                    className="mt-1 w-full py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors"
                  >
                    {matchReq
                      ? matchReq.status === 'approved'
                        ? 'Open directions'
                        : 'View in My Requests'
                      : 'Open My Requests'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Listings Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No donations found</h3>
          <p className="text-gray-500 mt-1">Try adjusting your filters or check back later</p>
          <button
            onClick={() => { setSearchQuery(''); setCategoryFilter('all'); }}
            className="mt-4 text-emerald-600 text-sm font-medium hover:underline"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onRequest={openRequestModal}
              userLocation={profile.location}
            />
          ))}
        </div>
      )}
    </div>
  );
  
  const renderMyRequests = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Requests</h1>
          <p className="text-sm text-gray-500 mt-1">Track all your donation requests and pickups</p>
        </div>
        <button
          onClick={() => setActiveTab('browse')}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
        >
          <ShoppingBag className="w-4 h-4" />
          New Request
        </button>
      </div>
      
      {/* Request Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-amber-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{pendingRequests}</div>
          <div className="text-xs text-amber-700">Pending</div>
        </div>
        <div className="bg-emerald-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{approvedRequests.length}</div>
          <div className="text-xs text-emerald-700">Approved</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{completedRequests}</div>
          <div className="text-xs text-blue-700">Completed</div>
        </div>
        <div className="bg-red-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{rejectedRequests}</div>
          <div className="text-xs text-red-700">Rejected</div>
        </div>
      </div>
      
      {/* Requests List */}
      <div className="space-y-3">
        {myRequests.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
            <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No requests yet</p>
            <button
              onClick={() => setActiveTab('browse')}
              className="mt-3 text-emerald-600 text-sm font-medium hover:underline"
            >
              Browse donations to get started →
            </button>
          </div>
        ) : (
          myRequests.map((req) => {
            const listing = listings.find(l => l.id === req.listingId);
            return (
              <div key={req.id} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-bold text-gray-900">{listing?.title || 'Donation Request'}</h3>
                      <StatusBadge status={req.status} />
                    </div>
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-400">Quantity</p>
                        <p className="font-medium">{req.requestedQty} {req.requestedUnit}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Retailer</p>
                        <p className="font-medium flex items-center gap-1">
                          <Building className="w-3 h-3" />
                          {listing?.donorName || '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Requested</p>
                        <p className="font-medium">{formatDate(req.createdAt)}</p>
                      </div>
                      {req.preferredPickupTime && (
                        <div>
                          <p className="text-xs text-gray-400">Pickup Time</p>
                          <p className="font-medium">{formatDate(req.preferredPickupTime)} at {formatTime(req.preferredPickupTime)}</p>
                        </div>
                      )}
                    </div>
                    {req.referenceNumber && (
                      <p className="text-xs font-mono text-emerald-600 mt-2">Reference: {req.referenceNumber}</p>
                    )}
                    {req.rejectionReason && (
                      <div className="mt-2 p-2 bg-red-50 rounded-lg text-xs text-red-600">
                        <AlertTriangle className="w-3 h-3 inline mr-1" />
                        Rejection reason: {req.rejectionReason}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {req.status === 'approved' && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedRequestId(req.id);
                            setActiveTab('directions');
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                        >
                          <Navigation className="w-4 h-4" />
                          Directions
                        </button>
                        <button
                          onClick={() => confirmPickup(req.id)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Confirm Pickup
                        </button>
                      </>
                    )}
                    {req.status === 'pending' && (
                      <button
                        onClick={() => cancelRequest(req.id)}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-medium transition-colors"
                      >
                        Cancel Request
                      </button>
                    )}
                  </div>
                </div>
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
        <p className="text-sm text-gray-500 mt-1">Get directions to your approved pickup location</p>
      </div>
      
      {!selectedRequest || selectedRequest.status !== 'approved' || !selectedRequestListing ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Select an approved request from "My Requests" to view directions</p>
          <button
            onClick={() => setActiveTab('my-requests')}
            className="mt-3 text-emerald-600 text-sm font-medium hover:underline"
          >
            Go to My Requests →
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedRequestListing.title}</h2>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="flex items-center gap-1 text-gray-600">
                    <Building className="w-4 h-4" />
                    {selectedRequestListing.donorName}
                  </span>
                  <span className="flex items-center gap-1 text-gray-600">
                    <Package className="w-4 h-4" />
                    {selectedRequest.requestedQty} {selectedRequest.requestedUnit}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Reference Number</p>
                <p className="text-lg font-mono font-bold text-emerald-600">{selectedRequest.referenceNumber}</p>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Map Section */}
              <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                <div className="relative h-64">
                  <iframe
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(
                      selectedRequestListing.donorLocation?.lat && selectedRequestListing.donorLocation?.lng
                        ? `${selectedRequestListing.donorLocation.lat},${selectedRequestListing.donorLocation.lng}`
                        : selectedRequestListing.location || selectedRequestListing.donorName
                    )}&z=15&output=embed`}
                    className="h-full w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Pickup location map"
                  />
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      selectedRequestListing.donorLocation?.lat && selectedRequestListing.donorLocation?.lng
                        ? `${selectedRequestListing.donorLocation.lat},${selectedRequestListing.donorLocation.lng}`
                        : selectedRequestListing.location || selectedRequestListing.donorName
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-4 right-4 bg-emerald-600 text-white text-xs px-3 py-2 rounded-lg flex items-center gap-1 hover:bg-emerald-700 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open in Google Maps
                  </a>
                </div>
              </div>
              
              {/* Instructions Section */}
              <div className="space-y-4">
                <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
                  <img
                    src="https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=70"
                    alt="NGO pickup guide"
                    className="w-full h-36 object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="p-3 text-xs text-gray-600">
                    Pickup tip: arrive within your assigned window and confirm reference details before loading.
                  </div>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                    <AlertCircle className="w-4 h-4 text-blue-600" />
                    Important Information
                  </h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold">1.</span>
                      <span>Bring your reference number: <strong className="font-mono">{selectedRequest.referenceNumber}</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold">2.</span>
                      <span>Arrive within the scheduled pickup window</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold">3.</span>
                      <span>Have your NGO ID ready for verification</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold">4.</span>
                      <span>Confirm pickup in the app after receiving the donation</span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                    <Phone className="w-4 h-4 text-gray-600" />
                    Retailer Contact
                  </h3>
                  <p className="text-sm text-gray-600">
                    Contact the retailer if you need to coordinate pickup details.
                  </p>
                  <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                    <p className="text-sm font-medium text-gray-900">{selectedRequestListing.donorName}</p>
                    {selectedRequestListing.donorEmail && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <Mail className="w-3 h-3" />
                        {selectedRequestListing.donorEmail}
                      </p>
                    )}
                    {selectedRequestListing.donorPhone && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <Phone className="w-3 h-3" />
                        {selectedRequestListing.donorPhone}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => confirmPickup(selectedRequest.id)}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Confirm Pickup Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  
  const renderProfile = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">NGO Profile</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your organization's information</p>
        </div>
        <button
          onClick={() => setIsEditingProfile(!isEditingProfile)}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
        >
          {isEditingProfile ? <X className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
          {isEditingProfile ? 'Cancel' : 'Edit Profile'}
        </button>
      </div>
      
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-6">
          {isEditingProfile ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
                  <input
                    type="text"
                    value={profileForm.organizationName}
                    onChange={(e) => setProfileForm({ ...profileForm, organizationName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={profileForm.contactPerson}
                    onChange={(e) => setProfileForm({ ...profileForm, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={profileForm.phoneNumber}
                    onChange={(e) => setProfileForm({ ...profileForm, phoneNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                  <input
                    type="url"
                    value={profileForm.website}
                    onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                  <input
                    type="text"
                    value={profileForm.lat}
                    onChange={(e) => setProfileForm({ ...profileForm, lat: e.target.value })}
                    placeholder="-26.2041"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                  <input
                    type="text"
                    value={profileForm.lng}
                    onChange={(e) => setProfileForm({ ...profileForm, lng: e.target.value })}
                    placeholder="28.0473"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contribution Type</label>
                  <input
                    type="text"
                    value={profileForm.contributionType}
                    onChange={(e) => setProfileForm({ ...profileForm, contributionType: e.target.value })}
                    placeholder="e.g., Child Nutrition, Elderly Meals"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Beneficiary Count</label>
                  <input
                    type="number"
                    value={profileForm.beneficiaryCount}
                    onChange={(e) => setProfileForm({ ...profileForm, beneficiaryCount: e.target.value })}
                    placeholder="Number of people served"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contribution Summary</label>
                  <textarea
                    value={profileForm.contributionSummary}
                    onChange={(e) => setProfileForm({ ...profileForm, contributionSummary: e.target.value })}
                    rows={3}
                    placeholder="Describe how your NGO serves the community..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <button
                  onClick={updateProfile}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400">Organization Name</p>
                  <p className="font-medium text-gray-900">{profile.organizationName || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Contact Person</p>
                  <p className="font-medium text-gray-900">{profile.contactPerson || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Phone Number</p>
                  <p className="font-medium text-gray-900">{profile.phoneNumber || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Email</p>
                  <p className="font-medium text-gray-900">{profile.email}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs text-gray-400">Address</p>
                  <p className="font-medium text-gray-900">{profile.address || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Contribution Type</p>
                  <p className="font-medium text-gray-900">{profile.contributionType || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Beneficiary Count</p>
                  <p className="font-medium text-gray-900">{profile.beneficiaryCount || '—'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs text-gray-400">Contribution Summary</p>
                  <p className="text-sm text-gray-600">{profile.contributionSummary || '—'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
  
  const renderDocuments = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Document Manager</h1>
        <p className="text-sm text-gray-500 mt-1">Upload required documents for verification</p>
      </div>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Verification Required</p>
            <p className="text-xs text-yellow-700 mt-1">
              Upload all required documents to get verified. Verification allows you to request donations.
              {profile.verificationStatus === 'verified' && ' Your account is already verified!'}
            </p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { type: 'npo_certificate' as const, label: 'NPO Certificate', description: 'Registration certificate from DSD' },
          { type: 'cipc' as const, label: 'CIPC Document', description: 'Company registration document' },
          { type: 'pbo' as const, label: 'PBO Certificate', description: 'Public Benefit Organization status' },
          { type: 'board_resolution' as const, label: 'Board Resolution', description: 'Authorizing representative' },
          { type: 'bank_confirmation' as const, label: 'Bank Confirmation', description: 'Bank account verification letter' },
        ].map((doc) => {
          const existingDoc = documents.find(d => d.type === doc.type);
          const isUploading = uploadingDoc === doc.type;
          
          return (
            <div key={doc.type} className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{doc.label}</h3>
                  <p className="text-xs text-gray-500 mt-1">{doc.description}</p>
                  {existingDoc && (
                    <div className="mt-2">
                      {getDocumentStatusBadge(existingDoc.status)}
                      {existingDoc.rejectionReason && (
                        <p className="text-xs text-red-600 mt-1">Reason: {existingDoc.rejectionReason}</p>
                      )}
                    </div>
                  )}
                </div>
                {existingDoc?.status === 'approved' ? (
                  <div className="text-emerald-500">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(doc.type, file);
                      }}
                      disabled={isUploading}
                    />
                    <div className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${isUploading ? 'bg-gray-100 text-gray-400' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>
                      {isUploading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {isUploading ? 'Uploading...' : (existingDoc ? 'Re-upload' : 'Upload')}
                    </div>
                  </label>
                )}
              </div>
              {existingDoc?.fileBase64 && (
                <button
                  onClick={() => setPreviewDoc(existingDoc)}
                  className="mt-3 text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  Preview Document
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
  
  const renderVerification = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Verification Status</h1>
        <p className="text-sm text-gray-500 mt-1">Track your verification progress</p>
      </div>
      
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-gray-500">Current Status</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-2xl font-bold ${profile.verificationStatus === 'verified' ? 'text-emerald-600' : profile.verificationStatus === 'rejected' ? 'text-red-600' : 'text-amber-600'}`}>
                {profile.verificationStatus.toUpperCase()}
              </span>
              {profile.verificationStatus === 'verified' && <CheckCircle className="w-6 h-6 text-emerald-500" />}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Member since</p>
            <p className="font-medium">{formatDate(profile.createdAt)}</p>
          </div>
        </div>
        
        {/* Progress Steps */}
        <div className="relative">
          <div className="overflow-hidden">
            <div className="flex justify-between">
              {[
                { label: 'Profile Setup', completed: true },
                { label: 'Documents Submitted', completed: documents.length >= 3 },
                { label: 'Verification Review', completed: profile.verificationStatus === 'verified' || profile.verificationStatus === 'rejected' },
                { label: 'Verified', completed: profile.verificationStatus === 'verified' },
              ].map((step, idx) => (
                <div key={idx} className="flex-1 text-center">
                  <div className={`w-8 h-8 rounded-full mx-auto flex items-center justify-center ${step.completed ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                    {step.completed ? <CheckCircle className="w-5 h-5" /> : idx + 1}
                  </div>
                  <p className="text-xs mt-2 font-medium">{step.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="mt-8 p-4 bg-gray-50 rounded-xl">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-blue-600" />
            Next Steps
          </h3>
          <div className="mb-3 rounded-lg overflow-hidden border border-gray-200">
            <img
              src="https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1200&q=70"
              alt="Verification process guide"
              className="w-full h-28 object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          {profile.verificationStatus === 'pending' ? (
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>Upload all required documents in the Document Manager</li>
              <li>Our team will review your documents within 2-3 business days</li>
              <li>You'll receive an email notification once verified</li>
            </ul>
          ) : profile.verificationStatus === 'verified' ? (
            <p className="text-sm text-emerald-600">✓ Your account is verified! You can now request donations.</p>
          ) : profile.verificationStatus === 'rejected' ? (
            <p className="text-sm text-red-600">Please review and resubmit your documents. Contact support if you need assistance.</p>
          ) : (
            <p className="text-sm text-gray-600">Complete your profile setup to begin verification.</p>
          )}
        </div>
      </div>
    </div>
  );

  // Sidebar navigation items
  const navItems: { id: NgoTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Dashboard', icon: <Home className="w-5 h-5" /> },
    { id: 'browse', label: 'Browse Donations', icon: <ShoppingBag className="w-5 h-5" /> },
    { id: 'my-requests', label: 'My Requests', icon: <ClipboardList className="w-5 h-5" /> },
    { id: 'directions', label: 'Directions', icon: <Map className="w-5 h-5" /> },
    { id: 'profile', label: 'Profile', icon: <UserCircle className="w-5 h-5" /> },
    { id: 'documents', label: 'Documents', icon: <FileText className="w-5 h-5" /> },
    { id: 'verification', label: 'Verification', icon: <Shield className="w-5 h-5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-gray-50">
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1488521787991-ed7bbaae773f?auto=format&fit=crop&w=1920&q=75')",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-br from-white/92 via-emerald-50/88 to-teal-100/75"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-screen">
      <div className="flex w-full">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-100 min-h-screen sticky top-0">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-8">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">FB</span>
              </div>
              <span className="font-bold text-xl text-gray-800">FoodBridge</span>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    activeTab === item.id
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {item.icon}
                  {item.label}
                  {item.id === 'documents' && documents.filter(d => d.status === 'submitted').length > 0 && (
                    <span className="ml-auto bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                      {documents.filter(d => d.status === 'submitted').length}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                <span className="text-emerald-600 font-bold text-sm">
                  {profile.organizationName?.charAt(0) || profile.displayName?.charAt(0) || 'N'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {profile.organizationName || profile.displayName || 'NGO User'}
                </p>
                <p className="text-xs text-gray-500 truncate">{profile.email}</p>
              </div>
              <button className="text-gray-400 hover:text-gray-600">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
        
        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {/* Top Bar */}
          <div className="bg-white border-b border-gray-100 px-8 py-4 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-800">
                  {navItems.find(i => i.id === activeTab)?.label || 'Dashboard'}
                </h1>
              </div>
              <div className="flex items-center gap-4">
                <button className="relative p-2 text-gray-400 hover:text-gray-600">
                  <Bell className="w-5 h-5" />
                  {notificationCount > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                  )}
                </button>
                <div className="flex items-center gap-2">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-gray-900">{profile.organizationName || 'NGO'}</p>
                    <p className="text-xs text-gray-500">{profile.verificationStatus}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Page Content */}
          <div className="p-8">
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'browse' && renderBrowse()}
            {activeTab === 'my-requests' && renderMyRequests()}
            {activeTab === 'directions' && renderDirections()}
            {activeTab === 'profile' && renderProfile()}
            {activeTab === 'documents' && renderDocuments()}
            {activeTab === 'verification' && renderVerification()}
            {activeTab === 'settings' && (
              <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
                <Settings className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Settings panel coming soon</p>
              </div>
            )}
          </div>
        </main>
      </div>
      </div>
      
      {/* Request Modal */}
      {isRequestModalOpen && selectedListing && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Request Donation</h3>
              <button onClick={() => setIsRequestModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="font-semibold text-gray-900">{selectedListing.title}</p>
                <p className="text-sm text-gray-500 mt-1">from {selectedListing.donorName}</p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-emerald-600">{getListingQty(selectedListing) || '—'}</span>
                  <span className="text-sm text-gray-500">{selectedListing.unit || 'units'} listed</span>
                </div>
                <p className="text-xs text-emerald-700 mt-2 font-medium">
                  Your claim will be for the full listed quantity.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Pickup Time</label>
                <input
                  type="datetime-local"
                  value={requestForm.preferredPickupTime}
                  onChange={(e) => setRequestForm({ ...requestForm, preferredPickupTime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={requestForm.notes}
                  onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })}
                  rows={3}
                  placeholder="Add any special instructions or requirements..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={submitRequest}
                  disabled={isSubmittingRequest}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2 rounded-lg transition-colors"
                >
                  {isSubmittingRequest ? 'Submitting...' : 'Submit Request'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Document Preview Modal */}
      {previewDoc && previewDoc.fileBase64 && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">{previewDoc.fileName}</h3>
              <button onClick={() => setPreviewDoc(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-0 h-[70vh]">
              <iframe
                src={`data:${previewDoc.fileMime || 'application/pdf'};base64,${previewDoc.fileBase64}`}
                className="w-full h-full"
                title="Document Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Missing icon components
const Activity: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);