import { useAccount, useAlert, useApi } from '@gear-js/react-hooks';
import type { ISubmittableResult } from '@polkadot/types/types';
import { Plus, ChevronDown, Info } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Wallet, Button, Card, CardContent, CardHeader, CardTitle, TokenSelector, Input, Tooltip } from '@/components';
import { SECONDS_IN_MINUTE } from '@/consts';
import {
  useAddLiquidityMessage,
  useGetReservesQuery,
  useVftTotalSupplyQuery,
  useApproveMessage,
  useMintMessage,
} from '@/lib/sails';
import { getErrorMessage } from '@/lib/utils';

import type { Token, Network, PairsTokens } from '../types';
import {
  getFormattedBalance,
  getNetworks,
  parseUnits,
  calculatePercentage,
  calculateProportionalAmount,
  handleStatus,
  getSelectedPair,
  calculateLPTokens,
  calculatePoolShare,
  formatUnits,
} from '../utils';

type AddLiquidityProps = {
  pairsTokens: PairsTokens;
  onSuccess: () => void;
  defaultToken0: Token | null;
  defaultToken1: Token | null;
};

const AddLiquidity = ({ pairsTokens, onSuccess, defaultToken0, defaultToken1 }: AddLiquidityProps) => {
  const [token0, setToken0] = useState<Token>(defaultToken0 || pairsTokens[0].token0);
  const [token1, setToken1] = useState<Token>(defaultToken1 || pairsTokens[0].token1);

  useEffect(() => {
    setToken0((prev) => ({
      ...prev,
      balance: pairsTokens.find((pair) => pair.token0.address === prev.address)?.token0.balance,
    }));
    setToken1((prev) => ({
      ...prev,
      balance: pairsTokens.find((pair) => pair.token1.address === prev.address)?.token1.balance,
    }));
  }, [pairsTokens]);

  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  const [showToken0Selector, setShowToken0Selector] = useState(false);
  const [showToken1Selector, setShowToken1Selector] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { api } = useApi();
  const alert = useAlert();

  const handleToken0Select = (token: Token, _network: Network) => {
    setError(null);
    setToken0(token);
  };

  const handleToken1Select = (token: Token, _network: Network) => {
    setError(null);
    setToken1(token);
  };

  const { selectedPair, isPairReverse } = getSelectedPair(pairsTokens, token0, token1) || {};
  const pairAddress = selectedPair?.pairAddress;

  const { reserves, isFetching: isReservesFetching, refetch: refreshReserves } = useGetReservesQuery(pairAddress);
  const {
    totalSupply,
    isFetching: isTotalSupplyFetching,
    refetch: refreshTotalSupply,
  } = useVftTotalSupplyQuery(pairAddress);

  const isPoolEmpty = reserves?.[0] === 0n && reserves?.[1] === 0n && totalSupply === 0n;

  const lpTokensToMint =
    reserves && totalSupply !== undefined && isPairReverse !== undefined
      ? calculateLPTokens(
          amount0,
          amount1,
          token0.decimals,
          token1.decimals,
          reserves[0],
          reserves[1],
          totalSupply,
          isPairReverse,
        )
      : 0n;

  const poolSharePercentage =
    reserves && totalSupply !== undefined && isPairReverse !== undefined
      ? calculatePoolShare(totalSupply, lpTokensToMint)
      : '0';

  const { approveMessage: token0ApproveMessage, isPending: isToken0ApprovePending } = useApproveMessage(token0.address);
  const { approveMessage: token1ApproveMessage, isPending: isToken1ApprovePending } = useApproveMessage(token1.address);

  const { addLiquidityMessage, isPending: isAddLiquidityPending } = useAddLiquidityMessage(pairAddress);
  const { mintMessage } = useMintMessage();
  const isPending =
    isToken0ApprovePending ||
    isToken1ApprovePending ||
    isAddLiquidityPending ||
    isTotalSupplyFetching ||
    isReservesFetching ||
    loading;

  const { account } = useAccount();

  const addLiquidity = async () => {
    setError(null);

    if (!api) {
      setError('API is not ready');
      return;
    }

    if (!pairAddress) {
      setError('Pair not found');
      return;
    }

    if (!amount0 || !amount1) {
      setError('Please enter amounts for both tokens');
      return;
    }

    if (token0.balance === undefined || token1.balance === undefined) {
      setError('Please select tokens');
      return;
    }

    if (!account?.decodedAddress) {
      setError('Wallet not connected');
      return;
    }

    const amountANum = parseFloat(amount0);
    const amountBNum = parseFloat(amount1);

    if (isNaN(amountANum) || amountANum <= 0) {
      setError('Invalid amount for first token');
      return;
    }

    if (isNaN(amountBNum) || amountBNum <= 0) {
      setError('Invalid amount for second token');
      return;
    }

    const token0Balance = token0.balance;
    const token1Balance = token1.balance;

    const amountADesired = parseUnits(amountANum.toString(), token0.decimals);
    const amountBDesired = parseUnits(amountBNum.toString(), token1.decimals);

    if (amountADesired > token0Balance) {
      setError(
        `Insufficient ${token0.displaySymbol} balance. Available: ${getFormattedBalance(token0Balance, token0.decimals, token0.displaySymbol)}`,
      );
      return;
    }

    if (amountBDesired > token1Balance) {
      setError(
        `Insufficient ${token1.displaySymbol} balance. Available: ${getFormattedBalance(token1Balance, token1.decimals, token1.displaySymbol)}`,
      );
      return;
    }

    const slippageTolerance = 0.05; // 5%
    const amountAMin = calculatePercentage(amountADesired, 1 - slippageTolerance);
    const amountBMin = calculatePercentage(amountBDesired, 1 - slippageTolerance);

    const deadline = (Math.floor(Date.now() / 1000) + 20 * SECONDS_IN_MINUTE) * 1000;

    console.log('Adding liquidity with params:', {
      tokenA: `${token0.displaySymbol} (${token0.address})`,
      tokenB: `${token1.displaySymbol} (${token1.address})`,
      amountADesired,
      amountBDesired,
      amountAMin,
      amountBMin,
      deadline: deadline.toString(),
      recipient: account.decodedAddress,
    });

    try {
      const token0ApproveTx = await token0ApproveMessage({
        value: amountADesired,
        spender: pairAddress,
      });
      const token1ApproveTx = await token1ApproveMessage({
        value: amountBDesired,
        spender: pairAddress,
      });
      const addLiquidityTx = await addLiquidityMessage({
        amountADesired: isPairReverse ? amountBDesired : amountADesired,
        amountBDesired: isPairReverse ? amountADesired : amountBDesired,
        amountAMin: isPairReverse ? amountBMin : amountAMin,
        amountBMin: isPairReverse ? amountAMin : amountBMin,
        deadline: deadline.toString(),
      });
      if (!token0ApproveTx?.extrinsic || !token1ApproveTx?.extrinsic || !addLiquidityTx?.extrinsic) {
        setError('Failed to create batch');
        return;
      }

      const transactions = [token0ApproveTx.extrinsic, token1ApproveTx.extrinsic, addLiquidityTx.extrinsic];

      setLoading(true);

      if (token0.isVaraNative) {
        const mintTx0 = await mintMessage({ value: amountADesired });
        if (mintTx0) {
          transactions.unshift(mintTx0.extrinsic);
        }
      }
      if (token1.isVaraNative) {
        const mintTx1 = await mintMessage({ value: amountBDesired });
        if (mintTx1) {
          transactions.unshift(mintTx1.extrinsic);
        }
      }

      const batch = api.tx.utility.batch(transactions);
      const { address, signer } = account;
      const statusCallback = (result: ISubmittableResult) =>
        handleStatus(api, result, {
          onSuccess: () => {
            void refreshReserves();
            void refreshTotalSupply();
            onSuccess();
            alert.success('Liquidity added successfully');
          },
          onError: (_error) => alert.error(_error),
          onFinally: () => setLoading(false),
        });
      // TODO: check versions of polkadot and types
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await batch.signAndSend(address, { signer }, statusCallback);
    } catch (_error) {
      console.error('Error adding liquidity:', _error);
      alert.error(getErrorMessage(_error));
    } finally {
      setLoading(false);
    }
  };

  const networks = getNetworks(pairsTokens);

  return (
    <>
      <Card className="card max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-lg font-bold uppercase theme-text">ADD LIQUIDITY</CardTitle>
          <div className="text-sm text-gray-400">Fixed fee tier: 0.3%</div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Token 0 */}
          <div className="space-y-2">
            <div className="flex justify-between gap-2 text-sm text-gray-400">
              <span>TOKEN 1</span>
              <span className="text-right">
                Balance:{' '}
                {token0.balance ? getFormattedBalance(token0.balance, token0.decimals, token0.displaySymbol) : '0'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Input
                value={amount0}
                type="number"
                inputMode="decimal"
                min={0}
                max={token0.balance ? getFormattedBalance(token0.balance, token0.decimals) : undefined}
                onChange={(e) => {
                  setError(null);
                  setAmount0(e.target.value);
                  if (!isPoolEmpty && reserves && isPairReverse !== undefined) {
                    const newAmount1 = calculateProportionalAmount(
                      e.target.value,
                      token0.decimals,
                      reserves[0],
                      reserves[1],
                      token1.decimals,
                      isPairReverse,
                    );
                    setAmount1(newAmount1);
                  }
                }}
                placeholder="0.0"
                className="input-field flex-1 text-xl"
              />
              <Button
                onClick={() => setShowToken0Selector(true)}
                variant="secondary"
                className="flex items-center space-x-2 min-w-[120px]">
                <img src={token0.logoURI || '/placeholder.svg'} alt={token0.name} className="w-5 h-5 rounded-full" />
                <span>{token0.displaySymbol}</span>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex justify-center">
            <Plus className="w-6 h-6 text-gray-400" />
          </div>

          {/* Token 1 */}
          <div className="space-y-2">
            <div className="flex justify-between gap-2 text-sm text-gray-400">
              <span>TOKEN 2</span>
              <span className="text-right">
                Balance:{' '}
                {token1.balance ? getFormattedBalance(token1.balance, token1.decimals, token1.displaySymbol) : '0'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Input
                value={amount1}
                type="number"
                inputMode="decimal"
                min={0}
                max={token1.balance ? getFormattedBalance(token1.balance, token1.decimals) : undefined}
                onChange={(e) => {
                  setError(null);
                  setAmount1(e.target.value);
                  if (!isPoolEmpty && reserves && isPairReverse !== undefined) {
                    const newAmount0 = calculateProportionalAmount(
                      e.target.value,
                      token1.decimals,
                      reserves[1],
                      reserves[0],
                      token0.decimals,
                      isPairReverse,
                    );
                    setAmount0(newAmount0);
                  }
                }}
                placeholder="0.0"
                className="input-field flex-1 text-xl"
              />
              <Button
                onClick={() => setShowToken1Selector(true)}
                variant="secondary"
                className="flex items-center space-x-2 min-w-[120px]">
                <img src={token1.logoURI || '/placeholder.svg'} alt={token1.name} className="w-5 h-5 rounded-full" />
                <span>{token1.displaySymbol}</span>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Pool Info */}
          <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Pool Share</span>
              <span className="theme-text">{poolSharePercentage}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Fee Tier</span>
              <span className="theme-text">0.3%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">LP Tokens</span>
              <div className="flex items-center space-x-1">
                <span className="theme-text">{formatUnits(lpTokensToMint, 18)}</span>
                <Tooltip
                  content={
                    <p className="text-xs">
                      LP tokens represent your share in the liquidity pool. They automatically earn trading fees (0.3%)
                      and can be redeemed for underlying tokens at any time. The amount of LP tokens is proportional to
                      your contribution to the pool&apos;s total liquidity.
                    </p>
                  }
                  side="top"
                  contentClassName="max-w-xs bg-gray-900 text-white border-gray-700"
                  delayDuration={200}>
                  <Info className="w-3 h-3 text-gray-400 cursor-help" />
                </Tooltip>
              </div>
            </div>
          </div>

          {account ? (
            <Button
              onClick={addLiquidity}
              disabled={isPending || !pairAddress}
              className="btn-primary w-full py-4 text-lg">
              ADD LIQUIDITY
            </Button>
          ) : (
            <Wallet />
          )}

          {!pairAddress && <div className="text-red-500"> Pair not found</div>}

          {error && <div className="text-red-500">{error}</div>}
        </CardContent>
      </Card>

      {/* Token Selectors */}
      <TokenSelector
        isOpen={showToken0Selector}
        onClose={() => setShowToken0Selector(false)}
        onSelectToken={handleToken0Select}
        title="Select first token"
        networks={networks}
      />

      <TokenSelector
        isOpen={showToken1Selector}
        onClose={() => setShowToken1Selector(false)}
        onSelectToken={handleToken1Select}
        title="Select second token"
        networks={networks}
      />
    </>
  );
};

export { AddLiquidity };
