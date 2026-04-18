import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, query, orderBy, onSnapshot, where, getDocs } from 'firebase/firestore';
import { FoodListing, UserProfile } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, Package, Users, Download, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface NgoStats {
  ngoId: string;
  ngoName: string;
  collectionsCount: number;
  totalQty: number;
  beneficiariesServed: number;
}

interface MonthlyData {
  month: string;
  donations: number;
  collections: number;
  quantity: number;
}

export default function AdminReports() {
  const [loading, setLoading] = useState(true);
  const [donations, setDonations] = useState<FoodListing[]>([]);
  const [ngos, setNgos] = useState<UserProfile[]>([]);
  const [ngoStats, setNgoStats] = useState<NgoStats[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  useEffect(() => {
    const qListings = query(collection(db, 'listings'), orderBy('createdAt', 'desc'));
    const qNgos = query(collection(db, 'users'), where('role', '==', 'ngo'));

    const unsubscribeDonations = onSnapshot(qListings, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FoodListing));
      setDonations(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'listings');
    });

    const unsubscribeNgos = onSnapshot(qNgos, (snapshot) => {
      const data = snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
      setNgos(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    return () => {
      unsubscribeDonations();
      unsubscribeNgos();
    };
  }, []);

  useEffect(() => {
    // Calculate NGO stats
    const stats: { [key: string]: NgoStats } = {};

    donations.forEach(donation => {
      if (donation.status === 'collected' && donation.claimedBy) {
        if (!stats[donation.claimedBy]) {
          const ngo = ngos.find(n => n.uid === donation.claimedBy);
          stats[donation.claimedBy] = {
            ngoId: donation.claimedBy,
            ngoName: ngo?.organizationName || 'Unknown NGO',
            collectionsCount: 0,
            totalQty: 0,
            beneficiariesServed: ngo?.beneficiaryStats?.peopleServedPerWeek || 0,
          };
        }
        stats[donation.claimedBy].collectionsCount += 1;
        stats[donation.claimedBy].totalQty += donation.qty || 0;
      }
    });

    setNgoStats(Object.values(stats).sort((a, b) => b.collectionsCount - a.collectionsCount));
  }, [donations, ngos]);

  useEffect(() => {
    // Calculate monthly data
    const months: { [key: string]: MonthlyData } = {};

    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = date.toLocaleString('default', { month: 'short', year: 'numeric' });
      months[key] = { month: key, donations: 0, collections: 0, quantity: 0 };
    }

    donations.forEach(donation => {
      const donatedDate = new Date(donation.createdAt?.toDate?.() || donation.createdAt);
      const key = donatedDate.toLocaleString('default', { month: 'short', year: 'numeric' });

      if (months[key]) {
        months[key].donations += 1;
        months[key].quantity += donation.qty || 0;

        if (donation.status === 'collected') {
          months[key].collections += 1;
        }
      }
    });

    setMonthlyData(Object.values(months));
  }, [donations]);

  const totalDonations = donations.length;
  const collectedDonations = donations.filter(d => d.status === 'collected').length;
  const totalQuantity = donations.reduce((sum, d) => sum + (d.qty || 0), 0);
  const activeNgos = ngos.filter(n => n.isVerified).length;

  const exportToCSV = () => {
    try {
      // Export NGO Leaderboard
      const headers = ['NGO Name', 'Collections', 'Total Quantity'];
      const rows = ngoStats.map(stat => [
        stat.ngoName,
        stat.collectionsCount,
        stat.totalQty,
      ]);

      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ngo-leaderboard-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('NGO Leaderboard exported to CSV');
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  const exportDonationReport = () => {
    try {
      const headers = ['Date', 'Title', 'Donor', 'Quantity', 'Status', 'Claimed By'];
      const rows = donations.map(d => [
        new Date(d.createdAt?.toDate?.() || d.createdAt).toLocaleDateString(),
        d.title,
        d.donorName,
        `${d.qty} ${d.unit}`,
        d.status,
        d.claimedBy || 'N/A',
      ]);

      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `all-donations-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Donation report exported to CSV');
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">Loading reports...</p>
      </div>
    );
  }

  const maxMonthlyDonations = Math.max(...monthlyData.map(m => m.donations), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Reports & Analytics</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportDonationReport}>
            <Download className="w-4 h-4 mr-1" />
            Export Donations
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-1" />
            Export Leaderboard
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600">Total Donations</p>
            <p className="text-3xl font-bold text-blue-600">{totalDonations}</p>
            <p className="text-xs text-gray-500 mt-1">food items listed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600">Collected</p>
            <p className="text-3xl font-bold text-green-600">{collectedDonations}</p>
            <p className="text-xs text-gray-500 mt-1">
              {totalDonations > 0 ? Math.round((collectedDonations / totalDonations) * 100) : 0}% success rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600">Total Quantity</p>
            <p className="text-3xl font-bold text-purple-600">{totalQuantity}</p>
            <p className="text-xs text-gray-500 mt-1">units distributed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600">Active NGOs</p>
            <p className="text-3xl font-bold text-green-600">{activeNgos}</p>
            <p className="text-xs text-gray-500 mt-1">verified organizations</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Volume Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Monthly Volume (Last 12 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {monthlyData.map((data) => (
              <div key={data.month}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{data.month}</span>
                  <span className="text-xs text-gray-600">
                    {data.donations} donations · {data.collections} collected
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all"
                    style={{
                      width: `${(data.donations / maxMonthlyDonations) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* NGO Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Top NGOs by Collections
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ngoStats.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No collections yet</p>
          ) : (
            <div className="space-y-3">
              {ngoStats.slice(0, 10).map((stat, index) => (
                <div key={stat.ngoId} className="flex items-center gap-4 pb-3 border-b last:border-b-0">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{stat.ngoName}</p>
                    <p className="text-sm text-gray-600">
                      <Package className="w-3 h-3 inline mr-1" />
                      {stat.collectionsCount} collections · {stat.totalQty} units
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">{stat.collectionsCount}</p>
                    <p className="text-xs text-gray-500">collections</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Donation Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Donation Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { status: 'available', count: donations.filter(d => d.status === 'available').length, color: 'text-blue-600' },
              { status: 'reserved', count: donations.filter(d => d.status === 'reserved').length, color: 'text-yellow-600' },
              { status: 'claimed', count: donations.filter(d => d.status === 'claimed').length, color: 'text-purple-600' },
              { status: 'collected', count: donations.filter(d => d.status === 'collected').length, color: 'text-green-600' },
              { status: 'expired', count: donations.filter(d => d.status === 'expired').length, color: 'text-red-600' },
              { status: 'withdrawn', count: donations.filter(d => d.status === 'withdrawn').length, color: 'text-gray-600' },
            ].map((item) => (
              <div key={item.status} className="text-center">
                <p className={`text-2xl font-bold ${item.color}`}>{item.count}</p>
                <p className="text-xs text-gray-600 mt-1 capitalize">{item.status}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
