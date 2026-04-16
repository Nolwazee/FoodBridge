import { FoodListing } from '@/src/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Package, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface ListingCardProps {
  listing: FoodListing;
  onClaim?: (id: string) => void;
  canClaim?: boolean;
  key?: string;
}

export default function ListingCard({ listing, onClaim, canClaim }: ListingCardProps) {
  const isExpired = listing.expiryDate?.toDate ? listing.expiryDate.toDate() < new Date() : false;
  
  return (
    <Card className="overflow-hidden border-emerald-100 hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="bg-emerald-50/50 pb-4">
        <div className="flex justify-between items-start">
          <Badge variant={listing.status === 'available' ? 'default' : 'secondary'} className={listing.status === 'available' ? 'bg-emerald-600' : ''}>
            {listing.status.toUpperCase()}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {listing.category}
          </Badge>
        </div>
        <CardTitle className="text-xl font-bold text-emerald-900 mt-2">{listing.title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center text-sm text-gray-600 gap-2">
          <Package className="h-4 w-4 text-emerald-600" />
          <span>{listing.quantity}</span>
        </div>
        <div className="flex items-center text-sm text-gray-600 gap-2">
          <MapPin className="h-4 w-4 text-emerald-600" />
          <span>{listing.location}</span>
        </div>
        <div className="flex items-center text-sm text-gray-600 gap-2">
          <Clock className="h-4 w-4 text-emerald-600" />
          <span>Expires: {listing.expiryDate?.toDate ? format(listing.expiryDate.toDate(), 'PPP') : 'N/A'}</span>
        </div>
        <p className="text-sm text-gray-500 line-clamp-2 mt-2 italic">
          "{listing.description}"
        </p>
      </CardContent>
      <CardFooter className="bg-gray-50/50 border-t border-gray-100 flex justify-between items-center">
        <span className="text-xs text-gray-400">Listed by {listing.donorName}</span>
        {canClaim && listing.status === 'available' && (
          <Button 
            onClick={() => onClaim?.(listing.id)} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white size-sm"
          >
            Claim
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
