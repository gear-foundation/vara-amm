import type { HexString } from '@gear-js/api';
import { useAccount, useAlert, useApi } from '@gear-js/react-hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import type { SubmittableExtrinsic } from '@polkadot/api/types';
import { ISubmittableResult } from '@polkadot/types/types';
import { ArrowDownUp, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';

import { TokenSelector } from '@/components/token-selector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Wallet } from '@/components/wallet';
import { INPUT_PERCENTAGES, SECONDS_IN_MINUTE, SLIPPAGE } from '@/consts';
import { usePairsBalances, usePairsReserves } from '@/features/pair';
import { createSwapValidationSchema, SwapFormData } from '@/features/pair/schema';
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
  useGetReservesQuery,
} from '@/lib/sails';
import { getErrorMessage } from '@/lib/utils';

type TradePageProps = {
  pairsTokens: PairsTokens;
  refetchBalances: () => void;
};

export function Swap({ pairsTokens, refetchBalances }: TradePageProps) {
  const { api } = useApi();
  const alert = useAlert();
  const { pairReserves, refetchReserves } = usePairsReserves();
  const [lastInputTouch, setLastInputTouch] = useState<'from' | 'to'>('from');

  const swapFormSchema = useMemo(
    () => createSwapValidationSchema(pairsTokens, pairReserves, lastInputTouch),
    [pairsTokens, pairReserves, lastInputTouch],
  );

  const form = useForm<SwapFormData>({
    resolver: zodResolver(swapFormSchema),
    mode: 'onChange',
    defaultValues: {
      fromAmount: '',
      toAmount: '',
      fromTokenAddress: pairsTokens.pairsArray[0].token0.address,
      toTokenAddress: pairsTokens.pairsArray[0].token1.address,
    },
  });

  const { control, handleSubmit, setValue, watch, formState, trigger } = form;
  const { errors, isSubmitting, isValid } = formState;

  const watchedFromAmount = watch('fromAmount');
  const watchedToAmount = watch('toAmount');
  const fromTokenAddress = watch('fromTokenAddress') as HexString;
  const toTokenAddress = watch('toTokenAddress') as HexString;

  const { pairPrograms } = usePairsBalances();

  const fromToken = useMemo(() => pairsTokens.tokens.get(fromTokenAddress), [pairsTokens, fromTokenAddress]);
  const toToken = useMemo(() => pairsTokens.tokens.get(toTokenAddress), [pairsTokens, toTokenAddress]);

  const selectedPairResult = useMemo(
    () => getSelectedPair(pairsTokens, fromTokenAddress, toTokenAddress),
    [pairsTokens, fromTokenAddress, toTokenAddress],
  );

  const { selectedPair, isPairReverse, pairIndex } = selectedPairResult || {};
  const pairAddress = selectedPair?.pairAddress;
  const { reserves } = useGetReservesQuery(pairAddress);

  const approve = useApproveMessage(fromToken?.address || ('0x0' as HexString));
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

  const [showFromTokenSelector, setShowFromTokenSelector] = useState(false);
  const [showToTokenSelector, setShowToTokenSelector] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { account } = useAccount();

  const [oneOutAmount, setOneOutAmount] = useState('');

  useEffect(() => {
    const fetchOneOutAmount = async () => {
      if (!fromToken || !toToken) return;
      const amount = await getAmount('1');
      setOneOutAmount(amount);
    };
    const recalculateAmounts = async () => {
      if (!fromToken || !toToken) return;
      if (lastInputTouch === 'from') {
        const amountOut = await getAmount(watchedFromAmount);
        setValue('toAmount', amountOut);
      } else {
        const amountIn = await getAmount(watchedToAmount, true);
        setValue('fromAmount', amountIn);
      }
      void trigger();
    };
    void recalculateAmounts();
    void fetchOneOutAmount();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromTokenAddress, toTokenAddress, pairPrograms, pairIndex, reserves, watchedFromAmount, watchedToAmount]);

  // Early return if tokens not found - after all hooks
  if (!fromToken || !toToken) {
    return <div>Error: Token not found</div>;
  }

  const isWalletConnected = !!account;

  const swapTokens = () => {
    const tempAddress = fromTokenAddress;
    const tempAmount = watchedFromAmount;
    setValue('fromAmount', watchedToAmount);
    setValue('toAmount', tempAmount);
    setValue('fromTokenAddress', toTokenAddress);
    setValue('toTokenAddress', tempAddress);
    setLastInputTouch((prev) => (prev === 'from' ? 'to' : 'from'));
  };

  const handleFromTokenSelect = (token: Token, _network: Network) => {
    setValue('fromTokenAddress', token.address);
  };

  const handleToTokenSelect = (token: Token, _network: Network) => {
    setValue('toTokenAddress', token.address);
  };

  const handleSwap = async (data: SwapFormData) => {
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
        const amountIn = parseUnits(data.fromAmount, fromToken.decimals);
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
        const amountOut = parseUnits(data.toAmount, toToken.decimals);
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
      void refetchReserves();
      setValue('toAmount', '');
      setValue('fromAmount', '');
    } catch (_error) {
      alert.error(getErrorMessage(_error));
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
    const amount = parseUnits(watchedFromAmount || '0', fromToken.decimals);
    const fee = calculatePercentage(amount, FEE);
    return formatUnits(fee, fromToken.decimals) + ' ' + fromToken.displaySymbol;
  };

  const networks = getNetworks(pairsTokens.tokens);

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
      return '';
    }

    return formatUnits(amountOut, decimalsOut);
  };

  const isSwapDisabled =
    !pairAddress ||
    swapTokensForExactTokens.isPending ||
    swapExactTokensForTokens.isPending ||
    isSubmitting ||
    !isValid ||
    !Number(watchedFromAmount) ||
    !Number(watchedToAmount);

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
              {fromToken.balance
                ? getFormattedBalance(fromToken.balance, fromToken.decimals, fromToken.displaySymbol)
                : '0'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Controller
              name="fromAmount"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  onChange={async (e) => {
                    const value = e.target.value;
                    if (Number(value) < 0 || isNaN(Number(value))) return;

                    setLastInputTouch('from');
                    field.onChange(value);
                    const amountOut = await getAmount(value);
                    setValue('toAmount', amountOut);
                  }}
                  placeholder="0.0"
                  className="input-field flex-1 text-xl"
                />
              )}
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
              <span>{fromToken.displaySymbol}</span>
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
                  setValue('fromAmount', amountIn);
                  setValue('toAmount', amountOut);
                  setLastInputTouch('from');
                  void trigger();
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
            disabled={swapTokensForExactTokens.isPending || swapExactTokensForTokens.isPending || isSubmitting}
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
              {toToken.balance ? getFormattedBalance(toToken.balance, toToken.decimals, toToken.displaySymbol) : '0'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Controller
              name="toAmount"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  onChange={async (e) => {
                    const value = e.target.value;
                    if (Number(value) < 0 || isNaN(Number(value))) return;

                    setLastInputTouch('to');
                    field.onChange(value);
                    const amountIn = await getAmount(value, true);
                    setValue('fromAmount', amountIn, { shouldValidate: true });
                  }}
                  placeholder="0.0"
                  className="input-field flex-1 text-xl"
                />
              )}
            />
            <Button
              onClick={() => setShowToTokenSelector(true)}
              variant="secondary"
              className="flex items-center space-x-2 min-w-[120px]">
              <img src={toToken.logoURI || '/placeholder.svg'} alt={toToken.name} className="w-5 h-5 rounded-full" />
              <span>{toToken.displaySymbol}</span>
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
                  1 {fromToken.displaySymbol} = {oneOutAmount} {toToken.displaySymbol}
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

        {(errors.fromAmount || errors.toAmount) && (
          <div className="text-red-500">{errors.fromAmount?.message || errors.toAmount?.message}</div>
        )}

        {isWalletConnected ? (
          <Button
            onClick={handleSubmit(handleSwap)}
            disabled={isSwapDisabled}
            variant="default"
            className="w-full py-4 text-lg">
            {isSubmitting ? 'SWAPPING...' : 'SWAP TOKENS'}
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
        disabledTokenAddress={toTokenAddress}
      />

      <TokenSelector
        isOpen={showToTokenSelector}
        onClose={() => setShowToTokenSelector(false)}
        onSelectToken={handleToTokenSelect}
        title="Select token to swap to"
        networks={networks}
        disabledTokenAddress={fromTokenAddress}
      />
    </Card>
  );
}
