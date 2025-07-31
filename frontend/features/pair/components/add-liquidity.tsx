'use client';

import { HexString } from '@gear-js/api';
import { useAccount } from '@gear-js/react-hooks';
import { Plus, ChevronDown, Info } from 'lucide-react';
import { useState } from 'react';

import { TokenSelector } from '@/components/token-selector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SECONDS_IN_MINUTE } from '@/consts';
import { useAddLiquidityMessage, useGetReservesQuery, useVftApproveMessage, useVftTotalSupplyQuery } from '@/lib/sails';

import { Token, Network } from '../types';

const AddLiquidity = () => {
  const [token0, setToken0] = useState<Token>({
    symbol: 'ETH',
    name: 'Ethereum',
    address: '0x...',
    decimals: 18,
    logoURI: '/tokens/eth.png',
    balance: '2.5',
  });
  const [token1, setToken1] = useState<Token>({
    symbol: 'VARA',
    name: 'Vara Token',
    address: '0x...',
    decimals: 18,
    logoURI: '/tokens/vara.png',
    balance: '0.0',
  });

  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  const [showToken0Selector, setShowToken0Selector] = useState(false);
  const [showToken1Selector, setShowToken1Selector] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToken0Select = (token: Token, network: Network) => {
    setError(null);
    setToken0(token);
  };

  const handleToken1Select = (token: Token, network: Network) => {
    setError(null);
    setToken1(token);
  };

  const pairAddress = '0x123';

  const { reserves: _reserves, isFetching: isReservesFetching } = useGetReservesQuery(pairAddress);
  const reservesExample = [10 * 10 ** 18, 3 * 10 ** 10];

  const { totalSupply, isFetching: isTotalSupplyFetching } = useVftTotalSupplyQuery(pairAddress);

  const isPoolEmpty = _reserves?.[0] === 0 && _reserves?.[1] === 0 && totalSupply === 0n;

  const { approveMessage, isPending: isApprovePending } = useVftApproveMessage(pairAddress);
  const { addLiquidityMessage, isPending: isAddLiquidityPending } = useAddLiquidityMessage(pairAddress);
  const isPending = isApprovePending || isAddLiquidityPending || isTotalSupplyFetching || isReservesFetching;
  const { account } = useAccount();

  const addLiquidity = async () => {
    setError(null);
    if (!amount0 || !amount1) {
      setError('Please enter amounts for both tokens');
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

    const token0Balance = parseFloat(token0.balance || '0');
    const token1Balance = parseFloat(token1.balance || '0');

    if (amountANum > token0Balance) {
      setError(`Insufficient ${token0.symbol} balance. Available: ${token0Balance}`);
      return;
    }

    if (amountBNum > token1Balance) {
      setError(`Insufficient ${token1.symbol} balance. Available: ${token1Balance}`);
      return;
    }

    const amountADesired = amountANum * 10 ** token0.decimals;
    const amountBDesired = amountBNum * 10 ** token1.decimals;

    const slippageTolerance = 0.05; // 5%
    const amountAMin = Math.floor(amountANum * (1 - slippageTolerance));
    const amountBMin = Math.floor(amountBNum * (1 - slippageTolerance));

    const deadline = Math.floor(Date.now() / 1000) + 20 * SECONDS_IN_MINUTE;

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

    // approve pair contract to spend token0 and token1
    // TODO: get approve amount from token0 and token1 balances
    await approveMessage({
      value: amount0,
      spender: pairAddress,
    });

    await approveMessage({
      value: amount1,
      spender: pairAddress,
    });

    void addLiquidityMessage({
      amountADesired: BigInt(amountADesired),
      amountBDesired: BigInt(amountBDesired),
      amountAMin: BigInt(amountAMin),
      amountBMin: BigInt(amountBMin),
      deadline: deadline.toString(),
    });
  };

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
                Balance: {token0.balance} {token0.symbol}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Input
                value={amount0}
                type="number"
                inputMode="decimal"
                min={0}
                max={token0.balance}
                onChange={(e) => {
                  setError(null);
                  setAmount0(e.target.value);
                  const amount = parseFloat(e.target.value) * 10 ** token0.decimals;
                  if (!isPoolEmpty) {
                    const newAmount1 = (amount * (reservesExample[1] / reservesExample[0])) / 10 ** token1.decimals;
                    setAmount1(newAmount1 ? newAmount1.toString() : '');
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
                Balance: {token1.balance} {token1.symbol}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Input
                value={amount1}
                type="number"
                inputMode="decimal"
                min={0}
                max={token1.balance}
                onChange={(e) => {
                  setError(null);
                  setAmount1(e.target.value);
                  const amount = parseFloat(e.target.value) * 10 ** token1.decimals;
                  if (!isPoolEmpty) {
                    const newAmount0 = (amount * (reservesExample[0] / reservesExample[1])) / 10 ** token0.decimals;
                    setAmount0(newAmount0 ? newAmount0.toString() : '');
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

          <Button onClick={addLiquidity} disabled={isPending} className="btn-primary w-full py-4 text-lg">
            ADD LIQUIDITY
          </Button>

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
      />

      <TokenSelector
        isOpen={showToken1Selector}
        onClose={() => setShowToken1Selector(false)}
        onSelectToken={handleToken1Select}
        selectedToken={token1}
        title="Select second token"
      />
    </>
  );
};

export { AddLiquidity };
