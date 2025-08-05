'use client';

import { useAccount, useAlert, useApi } from '@gear-js/react-hooks';
import { ISubmittableResult } from '@polkadot/types/types';
import { Plus, ChevronDown, Info } from 'lucide-react';
import { useEffect, useState } from 'react';

import { TokenSelector } from '@/components/token-selector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SECONDS_IN_MINUTE } from '@/consts';
import { useAddLiquidityMessage, useGetReservesQuery, useVftTotalSupplyQuery, useApproveMessage } from '@/lib/sails';

import { Token, Network, PairsTokens } from '../types';
import {
  getFormattedBalance,
  getNetworks,
  parseUnits,
  calculatePercentage,
  calculateProportionalAmount,
  handleStatus,
  getSelectedPair,
} from '../utils';

type AddLiquidityProps = {
  pairsTokens: PairsTokens;
  onSuccess: () => void;
  defaultToken0: Token | null;
  defaultToken1: Token | null;
  openConnectWallet: () => void;
};

const AddLiquidity = ({
  pairsTokens,
  onSuccess,
  defaultToken0,
  defaultToken1,
  openConnectWallet,
}: AddLiquidityProps) => {
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

  const handleToken0Select = (token: Token, network: Network) => {
    setError(null);
    setToken0(token);
  };

  const handleToken1Select = (token: Token, network: Network) => {
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

  const { approveMessage: token0ApproveMessage, isPending: isToken0ApprovePending } = useApproveMessage(token0.address);
  const { approveMessage: token1ApproveMessage, isPending: isToken1ApprovePending } = useApproveMessage(token1.address);

  const { addLiquidityMessage, isPending: isAddLiquidityPending } = useAddLiquidityMessage(pairAddress);
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
        `Insufficient ${token0.symbol} balance. Available: ${getFormattedBalance(token0Balance, token0.decimals, token0.symbol)}`,
      );
      return;
    }

    if (amountBDesired > token1Balance) {
      setError(
        `Insufficient ${token1.symbol} balance. Available: ${getFormattedBalance(token1Balance, token1.decimals, token1.symbol)}`,
      );
      return;
    }

    const slippageTolerance = 0.05; // 5%
    const amountAMin = calculatePercentage(amountADesired, 1 - slippageTolerance);
    const amountBMin = calculatePercentage(amountBDesired, 1 - slippageTolerance);

    const deadline = (Math.floor(Date.now() / 1000) + 20 * SECONDS_IN_MINUTE) * 1000;

    console.log('Adding liquidity with params:', {
      tokenA: `${token0.symbol} (${token0.address})`,
      tokenB: `${token1.symbol} (${token1.address})`,
      amountADesired,
      amountBDesired,
      amountAMin,
      amountBMin,
      deadline: deadline.toString(),
      recipient: account.decodedAddress,
    });

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
    setLoading(true);

    const batch = api.tx.utility.batch([
      token0ApproveTx.extrinsic,
      token1ApproveTx.extrinsic,
      addLiquidityTx.extrinsic,
    ]);

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

    await batch.signAndSend(address, { signer }, statusCallback);
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
            <div className="flex justify-between text-sm text-gray-400">
              <span>TOKEN 1</span>
              <span>
                Balance: {token0.balance ? getFormattedBalance(token0.balance, token0.decimals, token0.symbol) : '0'}
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
                className="btn-secondary flex items-center space-x-2 min-w-[120px]">
                <img src={token0.logoURI || '/placeholder.svg'} alt={token0.name} className="w-5 h-5 rounded-full" />
                <span>{token0.symbol}</span>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex justify-center">
            <Plus className="w-6 h-6 text-gray-400" />
          </div>

          {/* Token 1 */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-400">
              <span>TOKEN 2</span>
              <span>
                Balance: {token1.balance ? getFormattedBalance(token1.balance, token1.decimals, token1.symbol) : '0'}
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
                className="btn-secondary flex items-center space-x-2 min-w-[120px]">
                <img src={token1.logoURI || '/placeholder.svg'} alt={token1.name} className="w-5 h-5 rounded-full" />
                <span>{token1.symbol}</span>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Pool Info */}
          <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Pool Share</span>
              <span className="theme-text">0.12%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Fee Tier</span>
              <span className="theme-text">0.3%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">LP Tokens</span>
              <div className="flex items-center space-x-1">
                <span className="theme-text">1,234.56</span>
                <Info className="w-3 h-3 text-gray-400" />
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
            <Button onClick={openConnectWallet} className="btn-primary w-full py-4 text-lg">
              CONNECT WALLET
            </Button>
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
        selectedToken={token0}
        title="Select first token"
        networks={networks}
      />

      <TokenSelector
        isOpen={showToken1Selector}
        onClose={() => setShowToken1Selector(false)}
        onSelectToken={handleToken1Select}
        selectedToken={token1}
        title="Select second token"
        networks={networks}
      />
    </>
  );
};

export { AddLiquidity };
