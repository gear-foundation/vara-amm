import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ExplorePageTokensFiltersProps = {
  tokenNetworkFilter: string;
  setTokenNetworkFilter: (value: string) => void;
  tokenFilter: string;
  setTokenFilter: (value: string) => void;
  tokenVolumeFilter: string;
  setTokenVolumeFilter: (value: string) => void;
};

export function ExplorePageTokensFilters({
  // tokenNetworkFilter,
  // setTokenNetworkFilter,
  tokenFilter,
  setTokenFilter,
  tokenVolumeFilter,
  setTokenVolumeFilter,
}: ExplorePageTokensFiltersProps) {
  return (
    <div className="flex flex-wrap gap-4">
      {/* TODO: Disabled while we don't have another networks */}
      {/* <Select value={tokenNetworkFilter} onValueChange={setTokenNetworkFilter}>
        <SelectTrigger className="w-48 input-field">
          <SelectValue placeholder="All networks" />
        </SelectTrigger>
        <SelectContent className="card">
          <SelectItem value="all">All networks</SelectItem>
          <SelectItem value="Ethereum">Ethereum</SelectItem>
          <SelectItem value="Vara Network">Vara Network</SelectItem>
        </SelectContent>
      </Select> */}

      <Select value={tokenFilter} onValueChange={setTokenFilter}>
        <SelectTrigger className="w-48 input-field">
          <SelectValue placeholder="All tokens" />
        </SelectTrigger>
        <SelectContent className="card">
          <SelectItem value="all">All tokens</SelectItem>
          <SelectItem value="usdt">BTC</SelectItem>
          <SelectItem value="eth">ETH</SelectItem>
          <SelectItem value="vara">VARA</SelectItem>
          <SelectItem value="usdc">USDC</SelectItem>
          <SelectItem value="usdt">USDT</SelectItem>
        </SelectContent>
      </Select>

      <Select value={tokenVolumeFilter} onValueChange={setTokenVolumeFilter}>
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
    </div>
  );
}
