import { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '@/src/types';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import AdminDashboard from './components/AdminDashboard';
import Onboarding from './components/Onboarding';
import AuthModal from './components/AuthModal';
import { Toaster } from '@/components/ui/sonner';
import RetailPortal from './components/retail/RetailPortal';
import NgoPortal from './components/ngo/NgoPortal';
import ManagerDashboard from './components/admin/ManagerDashboard';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Real-time profile updates instead of a slow blocking getDoc
        unsubscribeProfile = onSnapshot(doc(db, 'users', currentUser.uid), (docSnapshot) => {
          if (docSnapshot.exists()) {
            setProfile({ uid: docSnapshot.id, ...docSnapshot.data() } as any);
          } else {
            setProfile(null);
            // Wait slightly before opening modal to avoid flashy jumps
            setTimeout(() => setIsAuthModalOpen(true), 100);
          }
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
        if (unsubscribeProfile) unsubscribeProfile();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D9C75]"></div>
      </div>
    );
  }

  const renderContent = () => {
    if (!user || !profile) {
      return <Hero onGetStarted={() => setIsAuthModalOpen(true)} />;
    }
    
    
    if (profile.role === 'admin') {
      return <AdminDashboard profile={profile} />;
    }

    if (profile.role === 'ngo' && !profile.onboardingCompleted) {
      return <Onboarding profile={profile} onComplete={() => {}} />;
    }

    if (profile.role === 'donor') {
      return <RetailPortal profile={profile} />;
    }

    return <NgoPortal profile={profile} />;
  };

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-[#E9F5F1] selection:text-[#2D9C75]">
      <Navbar user={user} onAuthClick={() => setIsAuthModalOpen(true)} />
      
      <main>
        {renderContent()}
      </main>

      <footer className="bg-gray-50 border-t border-gray-100 py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} FoodBridge. Built to combat hunger and food waste.
          </p>
        </div>
      </footer>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
      <Toaster position="top-center" />
    </div>
  );
}
