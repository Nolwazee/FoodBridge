export type UserRole = 'donor' | 'ngo' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  organizationName?: string;
  isVerified: boolean;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  onboardingCompleted?: boolean;
  createdAt: any;
  registrationNumber?: string;
  address?: string;
  contactPerson?: string;
  phoneNumber?: string;
  description?: string;
  contributionType?: string;
  contributionSummary?: string;
  // Optional location for distance sorting / directions
  location?: {
    address?: string;
    lat?: number;
    lng?: number;
  };
  // NGO-specific profile extensions
  beneficiaryStats?: {
    peopleServedPerWeek?: number;
    householdsServedPerWeek?: number;
  };
  transportCapacity?: {
    vehicleType?: string;
    maxLoadKg?: number;
    hasRefrigeration?: boolean;
  };
}

export interface FoodListing {
  id: string;
  donorId: string;
  donorName: string;
  title: string;
  description: string;
  category: 'produce' | 'bakery' | 'dairy' | 'meat' | 'pantry' | 'prepared';
  quantity: string; // legacy free-text
  qty?: number;
  unit?: 'kg' | 'g' | 'l' | 'ml' | 'unit' | 'box' | 'crate' | 'bag';
  photoUrl?: string;
  donorLocation?: {
    address?: string;
    lat?: number;
    lng?: number;
  };
  expiryDate: any;
  location: string;
  pickupWindowStart?: any;
  pickupWindowEnd?: any;
  status: 'available' | 'reserved' | 'claimed' | 'collected' | 'withdrawn' | 'expired';
  // legacy "claimed" fields (kept for backwards compatibility)
  claimedBy?: string;
  claimedAt?: any;
  createdAt: any;
}

export interface VerificationRequest {
  id: string;
  ngoId: string;
  ngoName: string;
  registrationNumber: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
}

export interface FlaggedActivity {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'Open' | 'Investigating' | 'Resolved';
  description: string;
  userId: string;
  listingId?: string;
  createdAt: any;
}

export type DonationRequestStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';

export interface DonationRequest {
  id: string;
  listingId: string;
  retailerId: string;
  ngoId: string;
  status: DonationRequestStatus;
  requestedQty?: number;
  requestedUnit?: FoodListing['unit'];
  preferredPickupTime?: any;
  note?: string;
  referenceNumber?: string;
  decision?: {
    decidedAt?: any;
    decidedBy?: string;
    reason?: string;
  };
  pickupConfirmation?: {
    pickedUpAt?: any;
    actualQty?: number;
    repName?: string;
  };
  ngoSnapshot?: {
    organizationName?: string;
    contactPerson?: string;
    phoneNumber?: string;
    address?: string;
    verificationStatus?: UserProfile['verificationStatus'];
  };
  createdAt: any;
  updatedAt?: any;
}

export type NgoDocumentType = 'npo_certificate' | 'cipc' | 'pbo' | 'board_resolution' | 'bank_confirmation' | 'other';
export type NgoDocumentStatus = 'missing' | 'submitted' | 'in_review' | 'approved' | 'rejected';

export interface NgoDocument {
  id: string;
  ngoId: string;
  type: NgoDocumentType;
  fileName: string;
  // Backward compatibility: older uploads stored as a URL (Firebase Storage)
  fileUrl?: string;
  // New approach (requested): store PDF content in Firestore
  fileBase64?: string; // base64 without data: prefix
  fileMime?: string; // e.g. application/pdf
  status: NgoDocumentStatus;
  rejectionReason?: string;
  uploadedAt: any;
  reviewedAt?: any;
  reviewedBy?: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorRole?: UserRole | 'system';
  action: string;
  entityType: 'user' | 'listing' | 'request' | 'document' | 'flag' | 'report' | 'auth' | 'system';
  entityId?: string;
  metadata?: Record<string, any>;
  createdAt: any;
}
