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
}

export interface FoodListing {
  id: string;
  donorId: string;
  donorName: string;
  title: string;
  description: string;
  category: 'produce' | 'bakery' | 'dairy' | 'meat' | 'pantry' | 'prepared';
  quantity: string;
  expiryDate: any;
  location: string;
  status: 'available' | 'claimed' | 'collected';
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
