import { useAccount, useAlert, useApi } from '@gear-js/react-hooks';
import type { SubmittableExtrinsic } from '@polkadot/api/types';
import { ISubmittableResult } from '@polkadot/types/types';
import { ArrowDownUp, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useState } from 'react';

import { TokenSelector } from '@/components/token-selector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  parseUnits,
} from '@/features/pair/utils';
import { useSignAndSend } from '@/hooks/use-sign-and-send';
import {
  useApproveMessage,
  useSwapExactTokensForTokensMessage,
  useSwapTokensForExactTokensMessage,
  useMintMessage,
  useBurnMessage,
} from '@/lib/sails';
import { useGetReservesQuery } from '@/lib/sails/pair/queries/use-get-reserves-query';
import { getErrorMessage } from '@/lib/utils';

type TradePageProps = {
  pairsTokens: PairsTokens;
  refetchBalances: () => void;
};

export function Swap({ pairsTokens, refetchBalances }: TradePageProps) {
  const { api } = useApi();
  const alert = useAlert();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastInputTouch, setLastInputTouch] = useState<'from' | 'to'>('from');
  const [fromToken, setFromToken] = useState<Token>(pairsTokens[0].token0);
  const [toToken, setToToken] = useState<Token>(pairsTokens[0].token1);

  const { pairPrograms } = usePairsBalances();
  const { selectedPair, isPairReverse, pairIndex } = getSelectedPair(pairsTokens, fromToken, toToken) || {};
  const pairAddress = selectedPair?.pairAddress;
  const { reserves } = useGetReservesQuery(pairAddress);

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

  const approve = useApproveMessage(fromToken.address);
  const mint = useMintMessage();
  const burn = useBurnMessage();

  const swapTokensForExactTokens = useSwapTokensForExactTokensMessage(pairAddress);
  const swapExactTokensForTokens = useSwapExactTokensForTokensMessage(pairAddress);

  const signAndSend = useSignAndSend({
    programs: [
      approve.program,
      mint.program,
      burn.program,
      swapTokensForExactTokens.program,
      swapExactTokensForTokens.program,
    ],
  });

  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [showFromTokenSelector, setShowFromTokenSelector] = useState(false);
  const [showToTokenSelector, setShowToTokenSelector] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { account } = useAccount();

  const isWalletConnected = !!account;

  const LIQUIDITY_ERROR = 'This trade cannot be executed due to insufficient liquidity or too much price impact.';

  const swapTokens = () => {
    const tempToken = fromToken;
    const tempAmount = fromAmount;
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount(toAmount);
    setToAmount(tempAmount);
    setLastInputTouch((prev) => (prev === 'from' ? 'to' : 'from'));
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

    try {
      let transactions: SubmittableExtrinsic<'promise', ISubmittableResult>[] = [];

      const shouldMint = fromToken.isVaraNative;
      const shouldBurn = toToken.isVaraNative;
      let mintValue: bigint;
      let burnValue: bigint;

      if (lastInputTouch === 'from') {
        const amountIn = parseUnits(fromAmount, fromToken.decimals);
        const amountOut = await pairPrograms[pairIndex].pair.getAmountOut(amountIn, isToken0ToToken1);
        const amountOutMin = calculatePercentage(amountOut, 1 - SLIPPAGE);
        mintValue = amountIn;
        burnValue = amountOutMin;

        console.log('swapExactTokensForTokensMessage', {
          amountIn: amountIn.toString(),
          amountOutMin,
          isToken0ToToken1,
          deadline: deadline.toString(),
        });

        const approveTx = await approve.mutateAsync({ value: amountIn, spender: pairAddress });

        const swapExactTokensForTokensTx = await swapExactTokensForTokens.mutateAsync({
          amountIn: amountIn.toString(),
          amountOutMin: amountOutMin.toString(),
          isToken0ToToken1,
          deadline: deadline.toString(),
        });

        if (!approveTx?.extrinsic || !swapExactTokensForTokensTx?.extrinsic) {
          alert.error('Failed to create batch');
          return;
        }

        transactions = [approveTx.extrinsic, swapExactTokensForTokensTx.extrinsic];
      } else {
        const amountOut = parseUnits(toAmount, toToken.decimals);
        const amountIn = await pairPrograms[pairIndex].pair.getAmountIn(amountOut, isToken0ToToken1);
        const amountInMax = calculatePercentage(amountIn, 1 + SLIPPAGE);
        mintValue = amountInMax;
        burnValue = amountOut;

        console.log('swapTokensForExactTokensMessage', {
          amountOut: amountOut.toString(),
          amountInMax,
          isToken0ToToken1,
          deadline: deadline.toString(),
        });

        const swapTokensForExactTokensTx = await swapTokensForExactTokens.mutateAsync({
          amountOut: amountOut.toString(),
          amountInMax: amountInMax.toString(),
          isToken0ToToken1,
          deadline: deadline.toString(),
        });

        const approveTx = await approve.mutateAsync({ value: amountInMax, spender: pairAddress });
        if (!approveTx?.extrinsic || !swapTokensForExactTokensTx?.extrinsic) {
          alert.error('Failed to create batch');
          return;
        }

        transactions = [approveTx.extrinsic, swapTokensForExactTokensTx.extrinsic];
      }

      setLoading(true);

      if (shouldMint) {
        const mintTx = await mint.mutateAsync({ value: mintValue });
        if (mintTx) transactions.push(mintTx.extrinsic);
      }

      if (shouldBurn) {
        const burnTx = await burn.mutateAsync({ value: burnValue });
        if (burnTx) transactions.push(burnTx.extrinsic);
      }

      const extrinsic = api.tx.utility.batchAll(transactions);
      await signAndSend.mutateAsync({ extrinsic });

      alert.success('Swap successful');
      void refetchBalances();
      setToAmount('');
      setFromAmount('');
    } catch (_error) {
      alert.error(getErrorMessage(_error));
    } finally {
      setLoading(false);
    }
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
    try {
      if (lastInputTouch === 'from') {
        amountOut = await pairProgram.pair.getAmountOut(amountIn, isToken0ToToken1);
      } else {
        amountOut = await pairProgram.pair.getAmountIn(amountIn, !isToken0ToToken1);
      }
    } catch {
      setError(LIQUIDITY_ERROR);
      return '';
    }

    return formatUnits(amountOut, decimalsOut);
  };

  const [oneOutAmount, setOneOutAmount] = useState('');

  const validateLiquidity = (currentFromAmount: string, currentToAmount: string) => {
    if (!reserves || isPairReverse === undefined) return;
    const isToken0ToToken1 = !isPairReverse;
    const reserveOut = isToken0ToToken1 ? reserves[1] : reserves[0];

    try {
      if (lastInputTouch === 'from') {
        const desiredOutWei = parseUnits(currentToAmount || '0', toToken.decimals);
        if (desiredOutWei >= reserveOut && Number(currentFromAmount)) {
          setError(LIQUIDITY_ERROR);
          return;
        }
      } else {
        const desiredOutWei = parseUnits(currentToAmount || '0', toToken.decimals);
        if (desiredOutWei >= reserveOut && Number(currentToAmount)) {
          setError(LIQUIDITY_ERROR);
          return;
        }
      }

      // If previous error was liquidity error, clear it when conditions no longer hold
      if (error === LIQUIDITY_ERROR) {
        setError('');
      }
    } catch {
      // Parsing issues: conservatively set error
      setError(LIQUIDITY_ERROR);
    }
  };

  useEffect(() => {
    const fetchOneOutAmount = async () => {
      const amount = await getAmount('1');
      setOneOutAmount(amount);
    };
    const recalculateAmounts = async () => {
      if (lastInputTouch === 'from') {
        const amountOut = await getAmount(fromAmount);
        setToAmount(amountOut);
        validateLiquidity(fromAmount, amountOut);
        checkBalances(fromAmount);
      } else {
        const amountIn = await getAmount(toAmount, true);
        setFromAmount(amountIn);
        validateLiquidity(amountIn, toAmount);
        checkBalances(amountIn);
      }
    };
    void recalculateAmounts();
    void fetchOneOutAmount();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromToken, toToken, pairPrograms, pairIndex, reserves]);

  const checkBalances = (amount: string) => {
    const amountIn = parseUnits(amount, fromToken.decimals);

    if (!fromToken.balance || amountIn > fromToken.balance) {
      setError('Insufficient balance');
    } else if (error === 'Insufficient balance') {
      setError('');
    }
  };

  const isSwapDisabled =
    !pairAddress ||
    swapTokensForExactTokens.isPending ||
    swapExactTokensForTokens.isPending ||
    loading ||
    !!error ||
    !Number(fromAmount) ||
    !Number(toAmount);

  return (
    <Card className="card">
      <CardHeader className="pb-4">{/* Removed SWAP TOKENS title and settings gear icon */}</CardHeader>
      <CardContent className="space-y-4">
        {/* From Token */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-400">
            <span>FROM</span>
            <span>
              Balance:{' '}
              {fromToken.balance ? getFormattedBalance(fromToken.balance, fromToken.decimals, fromToken.symbol) : '0'}
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
                validateLiquidity(value, amountOut);
              }}
              placeholder="0.0"
              className="input-field flex-1 text-xl"
            />
            <Button
              onClick={() => setShowFromTokenSelector(true)}
              variant="secondary"
              className="flex items-center space-x-2 min-w-[120px]">
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
                  validateLiquidity(amountIn, amountOut);
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
            disabled={swapTokensForExactTokens.isPending || swapExactTokensForTokens.isPending || loading}
            className="rounded-full bg-gray-500/20 border-2 border-gray-500/30 hover:border-[#00FF85] hover:bg-[#00FF85]/10 theme-text hover:text-[#00FF85] transition-all duration-200">
            <ArrowDownUp className="w-4 h-4" />
          </Button>
        </div>

        {/* To Token */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-400">
            <span>TO</span>
            <span>
              Balance: {toToken.balance ? getFormattedBalance(toToken.balance, toToken.decimals, toToken.symbol) : '0'}
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
                validateLiquidity(amountIn, value);
              }}
              placeholder="0.0"
              className="input-field flex-1 text-xl"
            />
            <Button
              onClick={() => setShowToTokenSelector(true)}
              variant="secondary"
              className="flex items-center space-x-2 min-w-[120px]">
              <img src={toToken.logoURI || '/placeholder.svg'} alt={toToken.name} className="w-5 h-5 rounded-full" />
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

      <TokenSelector
        isOpen={showFromTokenSelector}
        onClose={() => setShowFromTokenSelector(false)}
        onSelectToken={handleFromTokenSelect}
        title="Select token to swap from"
        networks={networks}
        disabledTokenAddress={toToken.address}
      />

      <TokenSelector
        isOpen={showToTokenSelector}
        onClose={() => setShowToTokenSelector(false)}
        onSelectToken={handleToTokenSelect}
        title="Select token to swap to"
        networks={networks}
        disabledTokenAddress={fromToken.address}
      />
    </Card>
  );
}
