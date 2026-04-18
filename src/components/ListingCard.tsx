import { useEffect, useState, type FC } from 'react';
import { FoodListing } from '@/src/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Package, Clock, Trash2, Flag } from 'lucide-react';

interface ListingCardProps {
  listing: FoodListing;
  onClaim?: (id: string) => void;
  onDelete?: (id: string) => void;
  onReport?: (id: string) => void;
  canClaim?: boolean;
  canDelete?: boolean;
  canReport?: boolean;
}

function fallbackImageForCategory(category: FoodListing['category']): string {
  // Unsplash images with fixed IDs for stable visuals.
  // Using `auto=format&fit=crop` keeps them lightweight and consistent.
  switch (category) {
    case 'produce':
      return 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=60';
    case 'bakery':
      return 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=1200&q=60';
    case 'dairy':
      return 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=1200&q=60';
    case 'meat':
      return 'https://images.unsplash.com/photo-1603048297172-c92544798d30?auto=format&fit=crop&w=1200&q=60';
    case 'pantry':
      return 'https://images.unsplash.com/photo-1604908554027-5b2a604e2e00?auto=format&fit=crop&w=1200&q=60';
    case 'prepared':
      return 'https://images.unsplash.com/photo-1604908176997-125f25cc500f?auto=format&fit=crop&w=1200&q=60';
    default:
      return 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=60';
  }
}

const ListingCard: FC<ListingCardProps> = ({ listing, onClaim, onDelete, onReport, canClaim, canDelete, canReport }) => {
  const [now, setNow] = useState(() => Date.now());
  const expiryDate: Date | null =
    listing.expiryDate?.toDate ? listing.expiryDate.toDate() :
    listing.expiryDate instanceof Date ? listing.expiryDate :
    typeof listing.expiryDate === 'string' ? new Date(listing.expiryDate) :
    null;
  const isExpired = expiryDate ? expiryDate.getTime() < now : false;
  const imageSrc = listing.photoUrl || fallbackImageForCategory(listing.category);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const expiryLabel = (() => {
    if (!expiryDate) return 'Expires: N/A';
    const ms = expiryDate.getTime() - now;
    if (ms <= 0) return 'Expired';
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return mins > 0 ? `Expires in ${hours}h ${mins}m` : `Expires in ${hours}h`;
  })();
  
  return (
    <Card className="overflow-hidden border-emerald-100 hover:shadow-lg transition-shadow duration-300">
      <div className="h-36 w-full bg-gray-100">
        <img
          src={imageSrc}
          alt={listing.title}
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const img = e.currentTarget;
            if (img.dataset.fallbackApplied) return;
            img.dataset.fallbackApplied = '1';
            img.src = fallbackImageForCategory('produce');
          }}
        />
      </div>
      <CardHeader className="bg-emerald-50/50 pb-4">
        <div className="flex justify-between items-start">
          <Badge variant={listing.status === 'available' ? 'default' : 'secondary'} className={listing.status === 'available' ? 'bg-emerald-600' : ''}>
            {listing.status.toUpperCase()}
          </Badge>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {listing.category}
            </Badge>
            {canDelete && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50 -mr-2" onClick={() => onDelete?.(listing.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            {canReport && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-amber-400 hover:text-amber-600 hover:bg-amber-50 -mr-2" onClick={() => onReport?.(listing.id)}>
                <Flag className="h-4 w-4" />
              </Button>
            )}
          </div>
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
          <span>{expiryLabel}</span>
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
            disabled={isExpired}
          >
            Claim
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default ListingCard;
