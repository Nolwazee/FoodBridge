import { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile } from '@/src/types';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import Onboarding from './components/Onboarding';
import AuthModal from './components/AuthModal';
import { Toaster } from '@/components/ui/sonner';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Initial fetch
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setProfile({ uid: userDoc.id, ...userDoc.data() } as any);
          } else {
            setProfile(null);
            setIsAuthModalOpen(true);
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        }

        // Real-time profile updates
        const unsubscribeProfile = onSnapshot(doc(db, 'users', currentUser.uid), (doc) => {
          if (doc.exists()) {
            setProfile({ uid: doc.id, ...doc.data() } as any);
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
        });

        setLoading(false);
        return () => unsubscribeProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
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

    return <Dashboard profile={profile} />;
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
