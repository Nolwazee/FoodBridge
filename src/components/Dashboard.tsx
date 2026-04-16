import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { FoodListing, UserProfile } from '@/src/types';
import ListingCard from './ListingCard';
import Sidebar from './Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Filter, TrendingUp, Package, History, Star, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface DashboardProps {
  profile: UserProfile;
}

export default function Dashboard({ profile }: DashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [listings, setListings] = useState<FoodListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newListing, setNewListing] = useState({
    title: '',
    description: '',
    category: 'produce',
    quantity: '',
    expiryDate: '',
    location: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FoodListing));
      setListings(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'listings');
    });

    return () => unsubscribe();
  }, []);

  const handleAddListing = async () => {
    try {
      await addDoc(collection(db, 'listings'), {
        ...newListing,
        donorId: profile.uid,
        donorName: profile.organizationName,
        status: 'available',
        expiryDate: new Date(newListing.expiryDate),
        createdAt: serverTimestamp()
      });
      setIsAddModalOpen(false);
      toast.success("Listing created successfully!");
      setNewListing({ title: '', description: '', category: 'produce', quantity: '', expiryDate: '', location: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'listings');
    }
  };

  const handleClaim = async (id: string) => {
    if (!profile.isVerified) {
      toast.error("Your account must be verified to claim food.");
      return;
    }
    try {
      await updateDoc(doc(db, 'listings', id), {
        status: 'claimed',
        claimedBy: profile.uid,
        claimedAt: serverTimestamp()
      });
      toast.success("Food claimed! Please coordinate collection.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `listings/${id}`);
    }
  };

  const handleDeleteListing = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'listings', id));
      toast.success("Listing removed successfully.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `listings/${id}`);
    }
  };

  const handleReportListing = async (id: string) => {
    try {
      await addDoc(collection(db, 'flags'), {
        type: 'Reported Listing',
        severity: 'MEDIUM',
        status: 'Open',
        description: 'An NGO reported this listing for review.',
        userId: profile.uid,
        listingId: id,
        createdAt: serverTimestamp()
      });
      toast.success("Listing reported to administrators.");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'flags');
    }
  };

  const myListings = listings.filter(l => l.donorId === profile.uid);
  const availableListings = listings.filter(l => l.status === 'available');
  const myClaims = listings.filter(l => l.claimedBy === profile.uid);

  const renderOverview = () => {
    if (profile.role === 'donor') {
      return (
        <div className="space-y-8">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Retailer Overview</h1>
              <p className="text-sm text-gray-500 mt-1">Manage your surplus food listings and track donations</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Active Listings', value: myListings.filter(l => l.status === 'available').length, sub: 'Ready for NGO claims', icon: Package },
              { label: 'Completed Donations', value: myListings.filter(l => l.status === 'collected').length, sub: 'Completed pickup cycles', icon: CheckCircle2 },
              { label: 'Total Claims', value: myListings.filter(l => l.status === 'claimed').length, sub: 'Across all listings', icon: History },
              { label: 'Total Listings', value: myListings.length, sub: 'All-time contributions', icon: Star },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <div className="text-xs font-medium text-gray-400 mb-2">{stat.label}</div>
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-[10px] text-gray-400 mt-1">{stat.sub}</div>
              </div>
            ))}
          </div>

          <div className="bg-[#E9F5F1] p-6 rounded-xl border border-[#D1EBE1] flex items-center gap-4">
            <div className="bg-white p-2 rounded-lg">
              <TrendingUp className="h-5 w-5 text-[#2D9C75]" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#1A2B2B]">Your Impact</div>
              <div className="text-xs text-[#2D9C75]">Your listings are turning surplus stock into verified deliveries for local NGOs.</div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900">Recent Activity</h3>
            <div className="space-y-2">
              {myListings.slice(0, 5).map(listing => (
                <div key={listing.id} className="bg-white p-4 rounded-xl border border-gray-100 flex justify-between items-center">
                  <div>
                    <div className="text-sm font-bold text-gray-900">{listing.title}</div>
                    <div className="text-xs text-gray-500">
                      {listing.status === 'claimed' ? `Claimed by NGO at Saved business address` : `Available for collection`}
                    </div>
                  </div>
                  <Badge variant={listing.status === 'available' ? 'outline' : 'secondary'} className="rounded-full px-3 py-0.5 text-[10px] font-bold">
                    {listing.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <div className="flex justify-between items-end">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">NGO Overview</h1>
              <Badge variant="outline" className="text-[10px] font-bold text-[#2D9C75] border-[#2D9C75] bg-[#E9F5F1]">
                {profile.verificationStatus.toUpperCase()}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mt-1">Browse available food, manage claims, and track deliveries</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Active Claims', value: myClaims.filter(l => l.status === 'claimed').length, sub: 'Pending and in-transit pickups', icon: Clock },
            { label: 'Completed Pickups', value: myClaims.filter(l => l.status === 'collected').length, sub: 'Delivered successfully', icon: CheckCircle2 },
            { label: 'Total Requests', value: myClaims.length, sub: 'All attempted claims', icon: Package },
            { label: 'Available Food', value: availableListings.length, sub: 'Listings ready in network', icon: Star },
          ].map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="text-xs font-medium text-gray-400 mb-2">{stat.label}</div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-[10px] text-gray-400 mt-1">{stat.sub}</div>
            </div>
          ))}
        </div>

        <div className="bg-[#E9F5F1] p-6 rounded-xl border border-[#D1EBE1] flex items-center gap-4">
          <div className="bg-white p-2 rounded-lg">
            <TrendingUp className="h-5 w-5 text-[#2D9C75]" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#1A2B2B]">Your Community Impact</div>
            <div className="text-xs text-[#2D9C75]">{profile.organizationName} can see live claim progress here as retailers accept and complete pickups.</div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-900">Active Claims</h3>
          <div className="space-y-2">
            {myClaims.length > 0 ? myClaims.map(claim => (
              <div key={claim.id} className="bg-white p-4 rounded-xl border border-gray-100 flex justify-between items-center">
                <div>
                  <div className="text-sm font-bold text-gray-900">{claim.title}</div>
                  <div className="text-xs text-gray-500">From {claim.donorName} | Pickup 4/15/2026</div>
                </div>
                <Badge className="bg-[#2D9C75] text-white rounded-full px-3 py-0.5 text-[10px] font-bold">
                  {claim.status}
                </Badge>
              </div>
            )) : (
              <div className="p-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <div className="text-sm font-bold text-gray-900 mb-2">Ready to Help More?</div>
                <div className="text-xs text-gray-500 mb-6">Browse available food listings and submit new claims</div>
                <Button 
                  onClick={() => setActiveTab('browse')}
                  className="bg-[#2D9C75] hover:bg-[#258563] text-white rounded-lg px-6"
                >
                  Browse Available Food
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-[calc(100vh-64px)] bg-[#F8FAFA]">
      <Sidebar role={profile.role as any} activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'overview' && renderOverview()}
        
        {activeTab === 'browse' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Available Food</h1>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input className="pl-10 rounded-xl border-gray-100 w-64" placeholder="Search for food..." />
                </div>
                <Button variant="outline" className="rounded-xl gap-2 border-gray-100">
                  <Filter className="h-4 w-4" /> Filter
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableListings.map(listing => (
                <ListingCard 
                  key={listing.id} 
                  listing={listing} 
                  canClaim={profile.role === 'ngo'} 
                  onClaim={handleClaim}
                  canReport={profile.role === 'ngo'}
                  onReport={handleReportListing}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'my-listings' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">My Listings</h1>
              <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-[#2D9C75] hover:bg-[#258563] text-white rounded-xl gap-2">
                    <Plus className="h-4 w-4" /> List Food
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] rounded-3xl">
                  <DialogHeader>
                    <DialogTitle>List Surplus Food</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Title</Label>
                      <Input placeholder="e.g. 50kg Fresh Tomatoes" value={newListing.title} onChange={e => setNewListing({...newListing, title: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Category</Label>
                        <Select value={newListing.category} onValueChange={v => setNewListing({...newListing, category: v as any})}>
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
                        <Input placeholder="e.g. 5 boxes" value={newListing.quantity} onChange={e => setNewListing({...newListing, quantity: e.target.value})} />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Expiry Date</Label>
                      <Input type="date" value={newListing.expiryDate} onChange={e => setNewListing({...newListing, expiryDate: e.target.value})} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Location / Collection Point</Label>
                      <Input placeholder="Enter address" value={newListing.location} onChange={e => setNewListing({...newListing, location: e.target.value})} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Description</Label>
                      <Input placeholder="Any special handling instructions?" value={newListing.description} onChange={e => setNewListing({...newListing, description: e.target.value})} />
                    </div>
                    <Button onClick={handleAddListing} className="bg-[#2D9C75] hover:bg-[#258563] text-white mt-4 h-12 rounded-xl">
                      Post Listing
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myListings.map(listing => (
                <ListingCard 
                  key={listing.id} 
                  listing={listing} 
                  canDelete={listing.status === 'available'}
                  onDelete={handleDeleteListing}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'my-claims' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">My Claims</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myClaims.map(listing => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
