import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, query, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { FoodListing, DonationRequest } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Package, Filter, MapPin, Calendar, User, CheckCircle, Clock, AlertCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { logAudit } from '@/src/lib/audit';

type DonationStatus = 'available' | 'reserved' | 'claimed' | 'collected' | 'withdrawn' | 'expired' | 'all';

interface DonationsOverviewProps {
  adminId?: string;
  allowActions?: boolean;
}

export default function DonationsOverview({ adminId, allowActions = true }: DonationsOverviewProps) {
  const [donations, setDonations] = useState<FoodListing[]>([]);
  const [filteredDonations, setFilteredDonations] = useState<FoodListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<DonationStatus>('all');
  const [selectedDonation, setSelectedDonation] = useState<FoodListing | null>(null);
  const [detailsDialog, setDetailsDialog] = useState(false);

  useEffect(() => {
    const qListings = query(
      collection(db, 'listings'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(qListings, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FoodListing));
      setDonations(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'listings');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let filtered = donations;

    if (searchTerm) {
      filtered = filtered.filter(
        d =>
          d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          d.donorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          d.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(d => d.status === filterStatus);
    }

    setFilteredDonations(filtered);
  }, [donations, searchTerm, filterStatus]);

  const handleDeleteDonation = async (donationId: string) => {
    try {
      await updateDoc(doc(db, 'listings', donationId), {
        status: 'withdrawn',
      });
      await logAudit({
        action: 'donation_deleted',
        entityType: 'listing',
        entityId: donationId,
        metadata: { adminId: adminId || 'unknown' },
      });
      toast.success('Donation withdrawn');
      setDetailsDialog(false);
      setSelectedDonation(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `listings/${donationId}`);
    }
  };

  const handleMarkCollected = async (donationId: string) => {
    try {
      await updateDoc(doc(db, 'listings', donationId), {
        status: 'collected',
      });
      await logAudit({
        action: 'donation_collected',
        entityType: 'listing',
        entityId: donationId,
        metadata: { adminId: adminId || 'unknown' },
      });
      toast.success('Donation marked as collected');
      setDetailsDialog(false);
      setSelectedDonation(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `listings/${donationId}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-blue-100 text-blue-800';
      case 'reserved':
        return 'bg-yellow-100 text-yellow-800';
      case 'claimed':
        return 'bg-purple-100 text-purple-800';
      case 'collected':
        return 'bg-green-100 text-green-800';
      case 'withdrawn':
        return 'bg-gray-100 text-gray-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return <Package className="w-4 h-4" />;
      case 'claimed':
        return <CheckCircle className="w-4 h-4" />;
      case 'expired':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusStats = () => {
    return {
      available: donations.filter(d => d.status === 'available').length,
      reserved: donations.filter(d => d.status === 'reserved').length,
      claimed: donations.filter(d => d.status === 'claimed').length,
      collected: donations.filter(d => d.status === 'collected').length,
      expired: donations.filter(d => d.status === 'expired').length,
    };
  };

  const stats = getStatusStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">Loading donations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Donations Overview</h2>
        <Badge variant="outline">Total: {donations.length}</Badge>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600">Available</p>
            <p className="text-2xl font-bold text-blue-600">{stats.available}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600">Reserved</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.reserved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600">Claimed</p>
            <p className="text-2xl font-bold text-purple-600">{stats.claimed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600">Collected</p>
            <p className="text-2xl font-bold text-green-600">{stats.collected}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600">Expired</p>
            <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-xs">
              <Input
                placeholder="Search by title, donor, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="px-3 py-2 border rounded-md"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as DonationStatus)}
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="reserved">Reserved</option>
              <option value="claimed">Claimed</option>
              <option value="collected">Collected</option>
              <option value="expired">Expired</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>
          <p className="text-sm text-gray-600">
            <Filter className="w-4 h-4 inline mr-1" />
            Showing {filteredDonations.length} donations
          </p>
        </CardContent>
      </Card>

      {/* Donations List */}
      <div className="grid gap-3">
        {filteredDonations.map((donation) => (
          <Card
            key={donation.id}
            className="cursor-pointer hover:shadow-md transition"
            onClick={() => {
              setSelectedDonation(donation);
              setDetailsDialog(true);
            }}
          >
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-lg">{donation.title}</h3>
                    <Badge className={getStatusColor(donation.status)}>
                      {getStatusIcon(donation.status)}
                      <span className="ml-1">{donation.status.toUpperCase()}</span>
                    </Badge>
                  </div>

                  <p className="text-sm text-gray-600 mb-2">{donation.description}</p>

                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      <span>{donation.donorName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Package className="w-4 h-4" />
                      <span>{donation.quantity || `${donation.qty} ${donation.unit}`}</span>
                    </div>
                    {donation.donorLocation?.address && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span>{donation.donorLocation.address}</span>
                      </div>
                    )}
                    {donation.expiryDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(donation.expiryDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredDonations.length === 0 && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center text-gray-500">
            No donations found
          </CardContent>
        </Card>
      )}

      {/* Details Dialog */}
      <Dialog open={detailsDialog} onOpenChange={setDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedDonation?.title}</DialogTitle>
            <DialogDescription>
              Donation ID: {selectedDonation?.id}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-600">Status</p>
                <Badge className={getStatusColor(selectedDonation?.status || '')}>
                  {selectedDonation?.status.toUpperCase()}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Category</p>
                <p>{selectedDonation?.category}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Quantity</p>
                <p>{selectedDonation?.quantity || `${selectedDonation?.qty} ${selectedDonation?.unit}`}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-600">Donor</p>
                <p>{selectedDonation?.donorName}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-600 mb-1">Description</p>
              <p className="text-sm">{selectedDonation?.description}</p>
            </div>

            {selectedDonation?.donorLocation?.address && (
              <div>
                <p className="text-sm font-semibold text-gray-600 mb-1">Location</p>
                <p className="text-sm">{selectedDonation.donorLocation.address}</p>
              </div>
            )}

            {selectedDonation?.expiryDate && (
              <div>
                <p className="text-sm font-semibold text-gray-600 mb-1">Expiry Date</p>
                <p className="text-sm">{new Date(selectedDonation.expiryDate).toLocaleString()}</p>
              </div>
            )}

            {selectedDonation?.claimedBy && (
              <div className="bg-purple-50 p-3 rounded border border-purple-200">
                <p className="text-sm font-semibold text-purple-900">Claimed By</p>
                <p className="text-sm text-purple-800">{selectedDonation.claimedBy}</p>
                {selectedDonation?.claimedAt && (
                  <p className="text-xs text-purple-700">
                    {new Date(selectedDonation.claimedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {selectedDonation?.photoUrl && (
              <div>
                <p className="text-sm font-semibold text-gray-600 mb-2">Photo</p>
                <img
                  src={selectedDonation.photoUrl}
                  alt={selectedDonation.title}
                  className="w-full max-h-48 object-cover rounded"
                />
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t justify-end">
              {allowActions && (selectedDonation?.status === 'available' || selectedDonation?.status === 'reserved' || selectedDonation?.status === 'claimed') && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (selectedDonation)
                        handleDeleteDonation(selectedDonation.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Withdraw
                  </Button>
                  {selectedDonation?.status !== 'collected' && (
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        if (selectedDonation)
                          handleMarkCollected(selectedDonation.id);
                      }}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Mark Collected
                    </Button>
                  )}
                </>
              )}
              <Button variant="outline" onClick={() => setDetailsDialog(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
