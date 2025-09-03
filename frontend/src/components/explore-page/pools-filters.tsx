import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROUTES } from '@/consts';

type ExplorePagePoolsFiltersProps = {
  poolNetworkFilter: string;
  setPoolNetworkFilter: (value: string) => void;
  poolVolumeFilter: string;
  setPoolVolumeFilter: (value: string) => void;
  showMyPools: boolean;
  setShowMyPools: (value: boolean) => void;
};

export function ExplorePagePoolsFilters({
  poolNetworkFilter,
  setPoolNetworkFilter,
  poolVolumeFilter,
  setPoolVolumeFilter,
  showMyPools,
  setShowMyPools,
}: ExplorePagePoolsFiltersProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Select value={poolNetworkFilter} onValueChange={setPoolNetworkFilter}>
        <SelectTrigger className="w-48 input-field">
          <SelectValue placeholder="All networks" />
        </SelectTrigger>
        <SelectContent className="card">
          <SelectItem value="all">All networks</SelectItem>
          {/* <SelectItem value="Ethereum">Ethereum</SelectItem> */}
          <SelectItem value="Vara Network">Vara Network</SelectItem>
        </SelectContent>
      </Select>

      <Select value={poolVolumeFilter} onValueChange={setPoolVolumeFilter}>
        <SelectTrigger className="w-32 input-field">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="card">
          <SelectItem value="1h">1H volume</SelectItem>
          <SelectItem value="1d">1D volume</SelectItem>
          <SelectItem value="1w">1W volume</SelectItem>
          <SelectItem value="1m">1M volume</SelectItem>
          <SelectItem value="1y">1Y volume</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center space-x-2">
        <button
          onClick={() => setShowMyPools(false)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            !showMyPools ? 'bg-[#00FF85] text-black' : 'bg-gray-500/20 theme-text hover:bg-gray-500/30'
          }`}>
          All pools
        </button>
        <button
          onClick={() => setShowMyPools(true)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            showMyPools ? 'bg-[#00FF85] text-black' : 'bg-gray-500/20 theme-text hover:bg-gray-500/30'
          }`}>
          My pools
        </button>
      </div>

      <Button className="btn-primary" onClick={() => navigate(ROUTES.POOL, { state: { tab: 'new-position' } })}>
        <Plus className="w-4 h-4 mr-2" />
        ADD LIQUIDITY
      </Button>
    </div>
  );
}
