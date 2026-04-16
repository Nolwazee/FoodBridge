import { useState } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { UserRole } from '@/src/types';
import { Leaf, Store, Building, User, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<UserRole>('donor');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLogin) {
      if (!email || !password) {
        toast.error('Please enter email and password');
        return;
      }
    } else {
      if (!fullName || !email || !password) {
        toast.error('Please fill in all fields');
        return;
      }
      if (password !== confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
    }

    setLoading(true);
    
    try {
      if (isLogin) {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, 'users', result.user.uid));
        
        if (!userDoc.exists()) {
           const profileData = {
              uid: result.user.uid,
              email: result.user.email,
              displayName: result.user.email?.split('@')[0] || '',
              role: 'donor',
              organizationName: '',
              isVerified: false,
              verificationStatus: 'pending',
              createdAt: serverTimestamp()
            };
            await setDoc(doc(db, 'users', result.user.uid), profileData);
        }
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const profileData = {
          uid: result.user.uid,
          email: result.user.email,
          displayName: fullName,
          role,
          organizationName: fullName, // Optional mapping
          isVerified: false,
          verificationStatus: 'pending',
          createdAt: serverTimestamp()
        };
        await setDoc(doc(db, 'users', result.user.uid), profileData);
      }

      onClose();
      resetForm();
    } catch (error: any) {
      console.error("Auth error:", error);
      toast.error(error.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTimeout(() => {
      setIsLogin(true);
      setFullName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setRole('donor');
    }, 300);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
        resetForm();
      }
    }}>
      <DialogContent className="sm:max-w-md rounded-[24px] p-0 overflow-hidden bg-[#FAFBFA] border-0 shadow-xl">
        <div className="p-8">
          <div className="flex items-center gap-2 mb-8">
            <div className="bg-[#2D9C75] p-2 rounded-xl">
              <Leaf className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl text-[#0B1B18]">FoodBridge</span>
          </div>

          <div className="mb-6">
            <h2 className="text-[28px] font-bold text-[#0B1B18] tracking-tight leading-tight mb-2">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-[#64748B] text-[15px]">
              {isLogin ? 'Sign in to access your dashboard' : 'Join the verified food redistribution network'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            {!isLogin && (
              <div className="space-y-3">
                <Label className="text-[15px] font-bold text-[#334155]">I am a...</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div 
                    onClick={() => setRole('donor')}
                    className={`border-2 rounded-2xl p-5 cursor-pointer transition-all flex flex-col items-center text-center gap-3 ${
                      role === 'donor' 
                        ? 'border-[#E2E8F0] bg-white shadow-sm ring-1 ring-[#83C5BE]/20 ring-offset-2 ring-offset-[#FAFBFA]' 
                        : 'border-[#E2E8F0] bg-[#FAFBFA] hover:bg-white'
                    }`}
                  >
                    <Store className={`h-7 w-7 ${role === 'donor' ? 'text-[#334155]' : 'text-[#94A3B8]'}`} />
                    <div>
                      <div className={`font-bold text-[15px] mb-1 ${role === 'donor' ? 'text-[#0B1B18]' : 'text-[#475569]'}`}>Retailer</div>
                      <div className="text-[12px] text-[#94A3B8] leading-tight">List surplus food for redistribution</div>
                    </div>
                  </div>
                  
                  <div 
                    onClick={() => setRole('ngo')}
                    className={`border-2 rounded-2xl p-5 cursor-pointer transition-all flex flex-col items-center text-center gap-3 ${
                      role === 'ngo' 
                        ? 'border-[#E2E8F0] bg-white shadow-sm ring-1 ring-[#83C5BE]/20 ring-offset-2 ring-offset-[#FAFBFA]' 
                        : 'border-[#E2E8F0] bg-[#FAFBFA] hover:bg-white'
                    }`}
                  >
                    <Building className={`h-7 w-7 ${role === 'ngo' ? 'text-[#334155]' : 'text-[#94A3B8]'}`} />
                    <div>
                      <div className={`font-bold text-[15px] mb-1 ${role === 'ngo' ? 'text-[#0B1B18]' : 'text-[#475569]'}`}>NGO</div>
                      <div className="text-[12px] text-[#94A3B8] leading-tight">Claim and distribute food to communities</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isLogin && (
              <div className="space-y-2">
                <Label className="text-[15px] font-medium text-[#334155]" htmlFor="fullName">Full Name</Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center border-r pr-2 border-gray-200">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input 
                    id="fullName"
                    placeholder="John Doe" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={!isLogin}
                    className="rounded-xl h-[52px] pl-14 border-[#2D9C75] bg-white focus-visible:ring-1 focus-visible:ring-[#2D9C75]"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-[15px] font-medium text-[#334155]" htmlFor="email">Email</Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center border-r pr-2 border-gray-200">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <Input 
                  id="email"
                  type="email" 
                  placeholder="nokbonga.friday@gmail.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="rounded-xl h-[52px] pl-14 border-transparent bg-[#EFF6FF] focus-visible:ring-1 focus-visible:ring-[#2D9C75]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[15px] font-medium text-[#334155]" htmlFor="password">Password</Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center border-r pr-2 border-gray-200">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <Input 
                  id="password"
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="rounded-xl h-[52px] pl-14 pr-12 border-transparent bg-[#EFF6FF] focus-visible:ring-1 focus-visible:ring-[#2D9C75]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                </button>
              </div>
            </div>
            
            {!isLogin && (
              <div className="space-y-2">
                <Label className="text-[15px] font-medium text-[#334155]" htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center border-r pr-2 border-gray-200">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input 
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required={!isLogin}
                    className="rounded-xl h-[52px] pl-14 pr-12 border-transparent bg-[#EFF6FF] focus-visible:ring-1 focus-visible:ring-[#2D9C75]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
              </div>
            )}

            <Button 
              type="submit"
              disabled={loading}
              className="w-full bg-[#83C5BE] hover:bg-[#2D9C75] text-white h-[52px] rounded-xl font-bold mt-2 transition-colors text-base"
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
            </Button>
            
            <div className="text-center mt-6 pt-2">
              <button 
                type="button" 
                onClick={() => setIsLogin(!isLogin)}
                className="text-[15px] text-[#64748B]"
              >
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <span className="text-[#2D9C75] font-medium hover:underline">
                  {isLogin ? "Sign up" : "Sign in"}
                </span>
              </button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
