import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ExplorePageTransactionsFiltersProps = {
  transactionTypeFilter: string;
  setTransactionTypeFilter: (value: string) => void;
  showMyTransactions: boolean;
  setShowMyTransactions: (value: boolean) => void;
};

export function ExplorePageTransactionsFilters({
  transactionTypeFilter,
  setTransactionTypeFilter,
  showMyTransactions,
  setShowMyTransactions,
}: ExplorePageTransactionsFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Select value={transactionTypeFilter} onValueChange={setTransactionTypeFilter}>
        <SelectTrigger className="w-48 input-field">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent className="card">
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="swap">Swap</SelectItem>
          <SelectItem value="add">Add Liquidity</SelectItem>
          <SelectItem value="remove">Remove Liquidity</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center space-x-2">
        <button
          onClick={() => setShowMyTransactions(false)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            !showMyTransactions ? 'bg-[#00FF85] text-black' : 'bg-gray-500/20 theme-text hover:bg-gray-500/30'
          }`}>
          All transactions
        </button>
        <button
          onClick={() => setShowMyTransactions(true)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            showMyTransactions ? 'bg-[#00FF85] text-black' : 'bg-gray-500/20 theme-text hover:bg-gray-500/30'
          }`}>
          My transactions
        </button>
      </div>
    </div>
  );
}
