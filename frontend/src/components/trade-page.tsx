import { useAccount, useAlert, useApi } from '@gear-js/react-hooks';
import type { ISubmittableResult } from '@polkadot/types/types';
import { ArrowDownUp, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet } from '@/components/wallet';
import { INPUT_PERCENTAGES, SECONDS_IN_MINUTE, SLIPPAGE } from '@/consts';
import { usePairsBalances } from '@/features/pair';
import type { Token, Network, PairsTokens } from '@/features/pair/types';
import {
  calculatePercentage,
  formatUnits,
  getFormattedBalance,
  getNetworks,
  getSelectedPair,
  handleStatus,
  parseUnits,
} from '@/features/pair/utils';
import {
  useApproveMessage,
  usePairsQuery,
  useSwapExactTokensForTokensMessage,
  useSwapTokensForExactTokensMessage,
} from '@/lib/sails';

import { TokenSelector } from './token-selector';
import { TradePageBuy } from './trade-page-buy';
import { TradePageSell } from './trade-page-sell';

type TradePageProps = {
  pairsTokens: PairsTokens;
  refetchBalances: () => void;
};

export function TradePage({ pairsTokens, refetchBalances }: TradePageProps) {
  const { api } = useApi();
  const alert = useAlert();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastInputTouch, setLastInputTouch] = useState<'from' | 'to'>('from');
  const [fromToken, setFromToken] = useState<Token>(pairsTokens[0].token0);
  const [toToken, setToToken] = useState<Token>(pairsTokens[0].token1);

  const { pairs } = usePairsQuery();
  const { pairPrograms } = usePairsBalances({ pairs });
  const { selectedPair, isPairReverse, pairIndex } = getSelectedPair(pairsTokens, fromToken, toToken) || {};
  const pairAddress = selectedPair?.pairAddress;

  useEffect(() => {
    setFromToken((prev) => ({
      ...prev,
      balance: isPairReverse ? selectedPair?.token1.balance : selectedPair?.token0.balance,
    }));
    setToToken((prev) => ({
      ...prev,
      balance: isPairReverse ? selectedPair?.token0.balance : selectedPair?.token1.balance,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairsTokens]);

  const { approveMessage } = useApproveMessage(fromToken.address);

  const { swapTokensForExactTokensMessage, isPending: isSwapTokensForExactTokensPending } =
    useSwapTokensForExactTokensMessage(pairAddress);
  const { swapExactTokensForTokensMessage, isPending: isSwapExactTokensForTokensPending } =
    useSwapExactTokensForTokensMessage(pairAddress);

  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [showFromTokenSelector, setShowFromTokenSelector] = useState(false);
  const [showToTokenSelector, setShowToTokenSelector] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { account } = useAccount();

  const isWalletConnected = !!account;

  const swapTokens = () => {
    const tempToken = fromToken;
    const tempAmount = fromAmount;
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount(toAmount);
    setToAmount(tempAmount);
  };

  const handleFromTokenSelect = (token: Token, network: Network) => {
    setFromToken({ ...token, network: network.name });
  };

  const handleToTokenSelect = (token: Token, network: Network) => {
    setToToken({ ...token, network: network.name });
  };

  const handleSwap = async () => {
    if (!pairPrograms || pairIndex === undefined || isPairReverse === undefined || !api || !pairAddress || !account)
      return;
    const deadline = (Math.floor(Date.now() / 1000) + 20 * SECONDS_IN_MINUTE) * 1000;
    const isToken0ToToken1 = !isPairReverse;

    let batch: ReturnType<typeof api.tx.utility.batch>;

    if (lastInputTouch === 'from') {
      const amountIn = parseUnits(fromAmount, fromToken.decimals);
      const amountOut = await pairPrograms[pairIndex].pair.getAmountOut(amountIn, isToken0ToToken1);
      const amountOutMin = calculatePercentage(amountOut, 1 - SLIPPAGE).toString();

      console.log('swapExactTokensForTokensMessage', {
        amountIn: amountIn.toString(),
        amountOutMin,
        isToken0ToToken1,
        deadline: deadline.toString(),
      });

      const approveTx = await approveMessage({ value: amountIn, spender: pairAddress });

      const swapExactTokensForTokensTx = await swapExactTokensForTokensMessage({
        amountIn: amountIn.toString(),
        amountOutMin,
        isToken0ToToken1,
        deadline: deadline.toString(),
      });

      if (!approveTx?.extrinsic || !swapExactTokensForTokensTx?.extrinsic) {
        alert.error('Failed to create batch');
        return;
      }

      batch = api.tx.utility.batch([approveTx.extrinsic, swapExactTokensForTokensTx.extrinsic]);
    } else {
      const amountOut = parseUnits(toAmount, toToken.decimals);
      const amountIn = await pairPrograms[pairIndex].pair.getAmountIn(amountOut, isToken0ToToken1);
      const amountInMax = calculatePercentage(amountIn, 1 + SLIPPAGE).toString();

      console.log('swapTokensForExactTokensMessage', {
        amountOut: amountOut.toString(),
        amountInMax,
        isToken0ToToken1,
        deadline: deadline.toString(),
      });

      const swapTokensForExactTokensTx = await swapTokensForExactTokensMessage({
        amountOut: amountOut.toString(),
        amountInMax,
        isToken0ToToken1,
        deadline: deadline.toString(),
      });

      const approveTx = await approveMessage({ value: amountInMax, spender: pairAddress });
      if (!approveTx?.extrinsic || !swapTokensForExactTokensTx?.extrinsic) {
        alert.error('Failed to create batch');
        return;
      }

      batch = api.tx.utility.batch([approveTx.extrinsic, swapTokensForExactTokensTx.extrinsic]);
    }

    setLoading(true);

    const { address, signer } = account;
    const statusCallback = (result: ISubmittableResult) => {
      return handleStatus(api, result, {
        // TODO: SEEMS LIKE BATCH SUCCESS EVERYTIME ON FAILED TX
        onSuccess: () => {
          alert.success('Swap successful');
          void refetchBalances();
          setToAmount('');
          setFromAmount('');
        },
        onError: (_error) => alert.error(_error),
        onFinally: () => setLoading(false),
      });
    };

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    await batch.signAndSend(address, { signer }, statusCallback);
  };

  const getSwapDirection = () => {
    if (fromToken.network === toToken.network) {
      return `${fromToken.network}`;
    }
    return `${fromToken.network} → ${toToken.network}`;
  };

  const calculateFee = () => {
    const FEE = 0.003;
    const amount = parseUnits(fromAmount || '0', fromToken.decimals);
    const fee = calculatePercentage(amount, FEE);
    return formatUnits(fee, fromToken.decimals) + ' ' + fromToken.symbol;
  };

  const networks = getNetworks(pairsTokens);

  const getAmount = async (amount: string, isReverse?: boolean) => {
    if (pairIndex === undefined || !pairPrograms || isPairReverse === undefined) return '';
    const pairProgram = pairPrograms[pairIndex];
    const isToken0ToToken1 = !isReverse ? !isPairReverse : isPairReverse;

    const decimalsIn = isReverse ? toToken.decimals : fromToken.decimals;
    const decimalsOut = isReverse ? fromToken.decimals : toToken.decimals;
    const amountIn = parseUnits(amount, decimalsIn);

    let amountOut = 0n;
    if (lastInputTouch === 'from') {
      amountOut = await pairProgram.pair.getAmountOut(amountIn, isToken0ToToken1);
    } else {
      amountOut = await pairProgram.pair.getAmountIn(amountIn, !isToken0ToToken1);
    }

    return formatUnits(amountOut, decimalsOut);
  };

  const [oneOutAmount, setOneOutAmount] = useState('');

  useEffect(() => {
    const fetchOneOutAmount = async () => {
      const amount = await getAmount('1');
      setOneOutAmount(amount);
    };
    void fetchOneOutAmount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromToken, toToken, pairPrograms, pairIndex]);

  const checkBalances = (amount: string) => {
    const amountIn = parseUnits(amount, fromToken.decimals);

    if (!fromToken.balance || amountIn > fromToken.balance) {
      setError('Insufficient balance');
    } else {
      setError('');
    }
  };

  const isSwapDisabled =
    !pairAddress ||
    isSwapTokensForExactTokensPending ||
    isSwapExactTokensForTokensPending ||
    loading ||
    !!error ||
    !Number(fromAmount) ||
    !Number(toAmount);

  return (
    <div className="max-w-md mx-auto">
      <Tabs defaultValue="swap" className="w-full">
        <TabsList className="card p-1 w-full flex">
          <TabsTrigger
            value="swap"
            className="data-[state=active]:bg-[#00FF85] data-[state=active]:text-black font-bold uppercase flex-1">
            SWAP
          </TabsTrigger>
          <TabsTrigger
            value="buy"
            className="data-[state=active]:bg-[#00FF85] data-[state=active]:text-black font-bold uppercase flex-1">
            BUY
          </TabsTrigger>
          <TabsTrigger
            value="sell"
            className="data-[state=active]:bg-[#00FF85] data-[state=active]:text-black font-bold uppercase flex-1">
            SELL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="swap" className="mt-6">
          <Card className="card">
            <CardHeader className="pb-4">{/* Removed SWAP TOKENS title and settings gear icon */}</CardHeader>
            <CardContent className="space-y-4">
              {/* From Token */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>FROM</span>
                  <span>
                    Balance:{' '}
                    {fromToken.balance
                      ? getFormattedBalance(fromToken.balance, fromToken.decimals, fromToken.symbol)
                      : '0'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Input
                    value={fromAmount}
                    onChange={async (e) => {
                      const value = e.target.value;
                      if (Number(value) < 0 || isNaN(Number(value))) return;

                      checkBalances(value);
                      setLastInputTouch('from');
                      setFromAmount(value);
                      const amountOut = await getAmount(value);
                      setToAmount(amountOut);
                    }}
                    placeholder="0.0"
                    className="input-field flex-1 text-xl"
                  />
                  <Button
                    onClick={() => setShowFromTokenSelector(true)}
                    className="btn-secondary flex items-center space-x-2 min-w-[120px]"
                    variant="secondary">
                    <img
                      src={fromToken.logoURI || '/placeholder.svg'}
                      alt={fromToken.name}
                      className="w-5 h-5 rounded-full"
                    />
                    <span>{fromToken.symbol}</span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex space-x-2">
                  {INPUT_PERCENTAGES.map(({ label, value }) => (
                    <Button
                      key={value}
                      variant="ghost"
                      size="sm"
                      className="text-xs bg-gray-500/20 hover:bg-gray-500/30 theme-text"
                      onClick={async () => {
                        const amountIn = formatUnits(
                          calculatePercentage(fromToken.balance || 0n, value),
                          fromToken.decimals || 0,
                        );
                        const amountOut = await getAmount(amountIn);
                        setFromAmount(amountIn);
                        setToAmount(amountOut);
                        setLastInputTouch('from');
                      }}>
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Swap Button */}
              <div className="flex justify-center">
                <Button
                  onClick={swapTokens}
                  variant="ghost"
                  size="icon"
                  disabled={isSwapTokensForExactTokensPending || isSwapExactTokensForTokensPending || loading}
                  className="rounded-full bg-gray-500/20 border-2 border-gray-500/30 hover:border-[#00FF85] hover:bg-[#00FF85]/10 theme-text hover:text-[#00FF85] transition-all duration-200">
                  <ArrowDownUp className="w-4 h-4" />
                </Button>
              </div>

              {/* To Token */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>TO</span>
                  <span>
                    Balance:{' '}
                    {toToken.balance ? getFormattedBalance(toToken.balance, toToken.decimals, toToken.symbol) : '0'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Input
                    value={toAmount}
                    onChange={async (e) => {
                      const value = e.target.value;
                      if (Number(value) < 0 || isNaN(Number(value))) return;

                      setLastInputTouch('to');
                      setToAmount(value);
                      const amountIn = await getAmount(value, true);
                      setFromAmount(amountIn);
                      checkBalances(amountIn);
                    }}
                    placeholder="0.0"
                    className="input-field flex-1 text-xl"
                  />
                  <Button
                    onClick={() => setShowToTokenSelector(true)}
                    className="btn-secondary flex items-center space-x-2 min-w-[120px]"
                    variant="secondary">
                    <img
                      src={toToken.logoURI || '/placeholder.svg'}
                      alt={toToken.name}
                      className="w-5 h-5 rounded-full"
                    />
                    <span>{toToken.symbol}</span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Expandable Details Block */}
              <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-500/5 transition-colors">
                  <div className="flex items-center space-x-2">
                    {pairAddress ? (
                      <span className="text-sm theme-text">
                        1 {fromToken.symbol} = {oneOutAmount} {toToken.symbol}
                      </span>
                    ) : (
                      <div className="text-red-500"> Pair not found</div>
                    )}
                    <Info className="w-3 h-3 text-gray-400" />
                  </div>
                  {showDetails ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {showDetails && (
                  <div className="px-3 pb-3 space-y-2 border-t border-gray-500/10">
                    <div className="flex justify-between text-sm pt-2">
                      <span className="text-gray-400">Fee (0.3%)</span>
                      <span className="theme-text">{calculateFee()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Swap direction</span>
                      <span className="theme-text">{getSwapDirection()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Max slippage</span>
                      <span className="theme-text">Auto {SLIPPAGE * 100}%</span>
                    </div>
                  </div>
                )}
              </div>

              {error && <div className="text-red-500">{error}</div>}

              {isWalletConnected ? (
                <Button onClick={handleSwap} disabled={isSwapDisabled} className="btn-primary w-full py-4 text-lg">
                  SWAP TOKENS
                </Button>
              ) : (
                <Wallet />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="buy" className="mt-6">
          <TradePageBuy />
        </TabsContent>

        <TabsContent value="sell" className="mt-6">
          <TradePageSell />
        </TabsContent>
      </Tabs>

      <TokenSelector
        isOpen={showFromTokenSelector}
        onClose={() => setShowFromTokenSelector(false)}
        onSelectToken={handleFromTokenSelect}
        title="Select token to swap from"
        networks={networks}
      />

      <TokenSelector
        isOpen={showToTokenSelector}
        onClose={() => setShowToTokenSelector(false)}
        onSelectToken={handleToTokenSelect}
        title="Select token to swap to"
        networks={networks}
      />
    </div>
  );
}
