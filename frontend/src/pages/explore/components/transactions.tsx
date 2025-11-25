import type { HexString } from '@gear-js/api';
import { useAccount } from '@gear-js/react-hooks';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useState } from 'react';

import { GetTransactionsQuery, type Transaction, TransactionsOrderBy } from '@/features/pair';
import type { PairsTokens } from '@/features/pair/types';
import { formatUnits } from '@/features/pair/utils';
import { useGraphQLQuery } from '@/hooks/useGraphQLQuery';

type DisplayTransaction = {
  type: string;
  amount: string;
  wallet: string;
  time: string;
  timeSort: number;
  isMyTx: boolean;
};

const formatWallet = (address: string) => {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatTime = (timestamp: string) => {
  const now = new Date().getTime();
  const txTime = new Date(timestamp).getTime();
  const diffMs = now - txTime;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

const formatAmount = (tx: Transaction, pairsTokens: PairsTokens) => {
  const pairInfo = pairsTokens.pairsByAddress.get(tx.pairId);
  if (!pairInfo) throw new Error(`unknown pair: ${tx.pairId}`);

  const token0 = pairsTokens.tokens.get(pairInfo.token0Address);
  const token1 = pairsTokens.tokens.get(pairInfo.token1Address);

  if (!token0 || !token1) throw new Error(`unknown tokens: ${pairInfo.token0Address} or ${pairInfo.token1Address}`);

  switch (tx.type) {
    case 'SWAP': {
      const isToken0ToToken1 = tx.tokenIn === token0.address;
      const tokenIn = isToken0ToToken1 ? token0 : token1;
      const tokenOut = isToken0ToToken1 ? token1 : token0;
      return `${formatUnits(BigInt(tx.amountIn), tokenIn.decimals)} ${tokenIn.displaySymbol} → ${formatUnits(BigInt(tx.amountOut), tokenOut.decimals)} ${tokenOut.displaySymbol}`;
    }
    case 'ADD_LIQUIDITY':
      return `${formatUnits(BigInt(tx.amountA), token0.decimals)} ${token0.displaySymbol} + ${formatUnits(BigInt(tx.amountB), token1.decimals)} ${token1.displaySymbol}`;
    case 'REMOVE_LIQUIDITY':
      return `${formatUnits(BigInt(tx.amountA), token0.decimals)} ${token0.displaySymbol} + ${formatUnits(BigInt(tx.amountB), token1.decimals)} ${token1.displaySymbol}`;
    default:
      return `unknown type: ${tx.type}`;
  }
};

const transformTransactions = (
  transactions: Transaction[],
  pairsTokens: PairsTokens,
  userAddress?: HexString,
): DisplayTransaction[] => {
  return transactions
    .filter((tx) => !!pairsTokens.pairsByAddress.get(tx.pairId))
    .map((tx) => ({
      type:
        tx.type === 'ADD_LIQUIDITY'
          ? 'Add'
          : tx.type === 'REMOVE_LIQUIDITY'
            ? 'Remove'
            : tx.type.charAt(0).toUpperCase() + tx.type.slice(1).toLowerCase(),
      amount: formatAmount(tx, pairsTokens),
      wallet: formatWallet(tx.user),
      time: formatTime(tx.timestamp),
      timeSort: new Date(tx.timestamp).getTime(),
      isMyTx: tx.user === userAddress,
    }));
};

type SortField = 'type' | 'wallet' | 'timeSort' | null;
type SortDirection = 'asc' | 'desc';

const getGraphQLOrderBy = (field: SortField, direction: SortDirection): TransactionsOrderBy | null => {
  if (!field) return null;

  switch (field) {
    case 'type':
      return direction === 'asc' ? TransactionsOrderBy.TYPE_ASC : TransactionsOrderBy.TYPE_DESC;
    case 'wallet':
      return direction === 'asc' ? TransactionsOrderBy.USER_ASC : TransactionsOrderBy.USER_DESC;
    case 'timeSort':
      return direction === 'asc' ? TransactionsOrderBy.TIMESTAMP_ASC : TransactionsOrderBy.TIMESTAMP_DESC;
    default:
      return null;
  }
};

const ITEMS_PER_PAGE = 20;

type ExplorePageTransactionsProps = {
  showMyTransactions: boolean;
  transactionTypeFilter: string;
  pairsTokens?: PairsTokens;
};

export function ExplorePageTransactions({
  showMyTransactions,
  transactionTypeFilter,
  pairsTokens,
}: ExplorePageTransactionsProps) {
  const { account } = useAccount();

  const [transactionSort, setTransactionSort] = useState<{ field: SortField; direction: SortDirection }>({
    field: 'timeSort',
    direction: 'desc',
  });

  const [currentPage, setCurrentPage] = useState(1);

  const orderBy = getGraphQLOrderBy(transactionSort.field, transactionSort.direction);

  const buildFilter = () => {
    const filter: { type?: { equalTo: string }; user?: { equalTo: string } } = {};

    if (transactionTypeFilter !== 'all') {
      const typeMap: { [key: string]: string } = {
        swap: 'SWAP',
        add: 'ADD_LIQUIDITY',
        remove: 'REMOVE_LIQUIDITY',
      };
      filter.type = { equalTo: typeMap[transactionTypeFilter] };
    }

    if (showMyTransactions && account?.decodedAddress) {
      filter.user = { equalTo: account.decodedAddress };
    }

    return Object.keys(filter).length > 0 ? filter : undefined;
  };

  const {
    data: transactionsResult,
    isFetching,
    error,
  } = useGraphQLQuery<{
    allTransactions: {
      nodes: Transaction[];
      totalCount: number;
    };
  }>(['transactions', orderBy, buildFilter(), currentPage], GetTransactionsQuery, {
    orderBy: orderBy ? [orderBy] : [TransactionsOrderBy.TIMESTAMP_DESC],
    filter: buildFilter(),
    first: ITEMS_PER_PAGE,
    offset: (currentPage - 1) * ITEMS_PER_PAGE,
  });

  const isLoading = isFetching || !pairsTokens;

  const transactionsData =
    transactionsResult?.allTransactions?.nodes && pairsTokens
      ? transformTransactions(transactionsResult.allTransactions.nodes, pairsTokens, account?.decodedAddress)
      : [];

  const totalCount = transactionsResult?.allTransactions?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [showMyTransactions, transactionTypeFilter, transactionSort]);

  const handleSort = (
    field: SortField,
    currentSort: { field: SortField; direction: SortDirection },
    setSort: (sort: { field: SortField; direction: SortDirection }) => void,
  ) => {
    const direction = currentSort.field === field && currentSort.direction === 'desc' ? 'asc' : 'desc';
    setSort({ field, direction });
  };

  const getSortIcon = (field: SortField, currentSort: { field: SortField; direction: SortDirection }) => {
    if (currentSort.field !== field) return null;
    return currentSort.direction === 'desc' ? (
      <ChevronDown className="w-3 h-3 ml-1" />
    ) : (
      <ChevronUp className="w-3 h-3 ml-1" />
    );
  };

  const SortableHeader = ({
    field,
    children,
    sort,
    onSort,
  }: {
    field: SortField;
    children: React.ReactNode;
    sort: { field: SortField; direction: SortDirection };
    onSort: (field: SortField) => void;
  }) => (
    <th
      className="text-right py-4 px-6 font-bold uppercase text-sm text-gray-400 cursor-pointer hover:text-[#00FF85] transition-colors select-none"
      onClick={() => onSort(field)}>
      <div className="flex items-center justify-end">
        {children}
        {getSortIcon(field, sort)}
      </div>
    </th>
  );

  const SortableHeaderLeft = ({
    field,
    children,
    sort,
    onSort,
  }: {
    field: SortField;
    children: React.ReactNode;
    sort: { field: SortField; direction: SortDirection };
    onSort: (field: SortField) => void;
  }) => (
    <th
      className="text-left py-4 px-6 font-bold uppercase text-sm text-gray-400 cursor-pointer hover:text-[#00FF85] transition-colors select-none"
      onClick={() => onSort(field)}>
      <div className="flex items-center">
        {children}
        {getSortIcon(field, sort)}
      </div>
    </th>
  );

  return (
    <div className="card overflow-hidden">
      {isLoading && (
        <div className="flex justify-center items-center py-8">
          <div className="text-gray-400">Loading transactions...</div>
        </div>
      )}
      {error && (
        <div className="flex justify-center items-center py-8">
          <div className="text-red-400">Error loading transactions: {error.message}</div>
        </div>
      )}
      {!isLoading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-500/20">
                <SortableHeaderLeft
                  field="type"
                  sort={transactionSort}
                  onSort={(field) => handleSort(field, transactionSort, setTransactionSort)}>
                  TYPE
                </SortableHeaderLeft>
                <th className="text-left py-4 px-6 font-bold uppercase text-sm text-gray-400">AMOUNT</th>
                <SortableHeaderLeft
                  field="wallet"
                  sort={transactionSort}
                  onSort={(field) => handleSort(field, transactionSort, setTransactionSort)}>
                  WALLET
                </SortableHeaderLeft>
                <SortableHeader
                  field="timeSort"
                  sort={transactionSort}
                  onSort={(field) => handleSort(field, transactionSort, setTransactionSort)}>
                  TIME
                </SortableHeader>
              </tr>
            </thead>
            <tbody>
              {transactionsData.length > 0 ? (
                transactionsData.map((tx, index) => (
                  <tr key={`${tx.wallet}-${tx.timeSort}-${index}`} className="table-row">
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                            tx.type === 'Swap'
                              ? 'bg-blue-500/20 text-blue-400'
                              : tx.type === 'Add'
                                ? 'bg-[#00FF85]/20 text-[#00FF85]'
                                : 'bg-red-500/20 text-red-400'
                          }`}>
                          {tx.type}
                        </span>
                        {tx.isMyTx && (
                          <span className="px-2 py-1 bg-[#00FF85]/20 text-[#00FF85] text-xs rounded-full">MY</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 mono theme-text">{tx.amount}</td>
                    <td className="py-4 px-6 mono text-gray-400">{tx.wallet}</td>
                    <td className="py-4 px-6 text-right text-gray-400">{tx.time}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400">
                    No transactions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-500/20">
          <div className="text-sm text-gray-400">
            Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, totalCount)} to{' '}
            {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount} transactions
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="flex items-center px-3 py-1 text-sm bg-gray-800 text-gray-300 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-800 transition-colors">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </button>

            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      currentPage === pageNum
                        ? 'bg-[#00FF85] text-black font-bold'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}>
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="flex items-center px-3 py-1 text-sm bg-gray-800 text-gray-300 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-800 transition-colors">
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
