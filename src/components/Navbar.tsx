import { auth } from '@/src/lib/firebase';
import { signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, User, Leaf } from 'lucide-react';

interface NavbarProps {
  user: any;
  onAuthClick: () => void;
}

export default function Navbar({ user, onAuthClick }: NavbarProps) {
  return (
    <nav className="border-b bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-2">
            <div className="bg-[#2D9C75] p-1.5 rounded-lg">
              <Leaf className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-[#1A2B2B] tracking-tight">FoodBridge</span>
          </div>

          <div className="flex items-center gap-6">
            {!user && (
              <button 
                onClick={onAuthClick}
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Sign In
              </button>
            )}
            
            {user ? (
              <div className="flex items-center gap-4">
                <Avatar className="h-8 w-8 border border-gray-200">
                  <AvatarImage src={user.photoURL} />
                  <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                </Avatar>
                <Button variant="ghost" size="icon" onClick={() => signOut(auth)}>
                  <LogOut className="h-5 w-5 text-gray-400" />
                </Button>
              </div>
            ) : (
              <Button 
                onClick={onAuthClick} 
                className="bg-[#2D9C75] hover:bg-[#258563] text-white rounded-lg px-5 py-2 h-9 text-sm font-semibold"
              >
                Join Now
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
