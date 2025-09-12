import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, Image as ImageIcon, Search } from 'lucide-react';
import { NFTInfo } from '@/lib/kiosk-discovery';

interface NFTGridProps {
  nfts: NFTInfo[];
  loading: boolean;
  selectable?: boolean;
  onSelectionChange?: (selectedNFTs: NFTInfo[]) => void;
}

export function NFTGrid({ nfts, loading, selectable = false, onSelectionChange }: NFTGridProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedNFTs, setSelectedNFTs] = useState<Set<string>>(new Set());

  // Get unique NFT types for filtering
  const nftTypes = Array.from(new Set(nfts.map(nft => nft.type)));

  // Filter NFTs based on search and type
  const filteredNFTs = nfts.filter(nft => {
    const matchesSearch = nft.display?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         nft.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         nft.type.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = selectedType === 'all' || nft.type === selectedType;
    
    return matchesSearch && matchesType;
  });

  const handleNFTSelection = (nft: NFTInfo, selected: boolean) => {
    const newSelection = new Set(selectedNFTs);
    if (selected) {
      newSelection.add(nft.id);
    } else {
      newSelection.delete(nft.id);
    }
    setSelectedNFTs(newSelection);
    
    if (onSelectionChange) {
      const selectedNFTObjects = nfts.filter(n => newSelection.has(n.id));
      onSelectionChange(selectedNFTObjects);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-32 w-full" />
              <CardContent className="p-3">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search NFTs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {nftTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type.split('::').pop() || type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* NFT Grid */}
      {filteredNFTs.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredNFTs.map((nft) => {
            const isSelected = selectedNFTs.has(nft.id);
            return (
              <Card 
                key={nft.id} 
                className={`overflow-hidden transition-all hover:shadow-lg cursor-pointer ${
                  selectable && isSelected ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => selectable && handleNFTSelection(nft, !isSelected)}
              >
                <div className="aspect-square bg-muted/20 relative overflow-hidden">
                  {nft.display?.image_url ? (
                    <img 
                      src={nft.display.image_url} 
                      alt={nft.display.name || 'NFT'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className="hidden absolute inset-0 flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  </div>
                  {selectable && (
                    <div className="absolute top-2 right-2">
                      <div className={`w-4 h-4 rounded border-2 ${
                        isSelected ? 'bg-primary border-primary' : 'bg-background border-muted-foreground'
                      }`}>
                        {isSelected && (
                          <svg className="w-full h-full text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <CardContent className="p-3">
                  <p className="font-medium text-sm truncate">
                    {nft.display?.name || `NFT ${nft.id.slice(0, 6)}...`}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <Badge variant="outline" className="text-xs">
                      {nft.type.split('::').pop()?.slice(0, 10) || 'Unknown'}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      {nft.kioskId.slice(0, 4)}...{nft.kioskId.slice(-2)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No NFTs found</p>
          <p className="text-sm text-muted-foreground">
            {searchTerm || selectedType !== 'all' ? 'Try adjusting your filters' : 'Your kiosks are empty'}
          </p>
        </div>
      )}
    </div>
  );
}