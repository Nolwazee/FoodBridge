import { useState } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserRole } from '@/src/types';
import { Leaf, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [step, setStep] = useState<'login' | 'role-selection'>('login');
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<UserRole>('ngo');
  const [orgName, setOrgName] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    
    try {
      // Attempt sign in with popup
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user profile exists
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!userDoc.exists()) {
        setStep('role-selection');
      } else {
        onClose();
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      
      if (error.code === 'auth/popup-blocked') {
        toast.error("Sign-in popup was blocked. Please enable popups for this site or try again.", {
          duration: 5000,
          action: {
            label: "Try Redirect",
            onClick: () => {
              signInWithRedirect(auth, provider).catch(err => {
                toast.error("Redirect sign-in failed. Please check your browser settings.");
              });
            }
          }
        });
      } else {
        toast.error("Authentication failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteProfile = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const profileData = {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
        displayName: auth.currentUser.displayName,
        role,
        organizationName: orgName,
        isVerified: false,
        verificationStatus: 'pending',
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, 'users', auth.currentUser.uid), profileData);
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser.uid}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] rounded-3xl">
        <DialogHeader className="flex flex-col items-center text-center">
          <div className="bg-[#E9F5F1] p-3 rounded-2xl mb-4">
            <Leaf className="h-8 w-8 text-[#2D9C75]" />
          </div>
          <DialogTitle className="text-2xl font-bold text-[#1A2B2B]">
            {step === 'login' ? 'Welcome to FoodBridge' : 'Complete Your Profile'}
          </DialogTitle>
          <DialogDescription>
            {step === 'login' 
              ? 'Join our community of donors and NGOs making a difference.' 
              : 'Tell us a bit more about your organization.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'login' ? (
          <div className="py-6">
            <Button 
              onClick={handleGoogleSignIn} 
              disabled={loading}
              className="w-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 h-12 rounded-xl flex gap-3 shadow-sm font-medium"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="h-5 w-5" />
              Continue with Google
            </Button>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">I am a...</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger className="rounded-xl h-12 border-gray-100">
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="donor">Food Donor (Retailer/Farmer)</SelectItem>
                  <SelectItem value="ngo">NGO / Community Program</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Organization Name</Label>
              <Input 
                placeholder="Enter your organization name" 
                value={orgName} 
                onChange={(e) => setOrgName(e.target.value)}
                className="rounded-xl h-12 border-gray-100 focus:border-[#2D9C75] focus:ring-[#2D9C75]"
              />
            </div>
            <Button 
              onClick={handleCompleteProfile} 
              disabled={loading || !orgName}
              className="w-full bg-[#2D9C75] hover:bg-[#258563] text-white h-12 rounded-xl font-bold shadow-lg shadow-[#2D9C75]/20"
            >
              {loading ? 'Saving...' : 'Complete Setup'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
