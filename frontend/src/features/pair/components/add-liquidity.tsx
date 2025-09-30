import type { HexString } from '@gear-js/api';
import { useAccount, useAlert, useApi } from '@gear-js/react-hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, ChevronDown, Info } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import {
  Wallet,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  TokenSelector,
  Input,
  Tooltip,
  TokenIcon,
} from '@/components';
import { SECONDS_IN_MINUTE } from '@/consts';
import { TokenImportModal, useTokenImport } from '@/features/token-import';
import { useSignAndSend } from '@/hooks/use-sign-and-send';
import {
  useAddLiquidityMessage,
  useGetReservesQuery,
  useVftTotalSupplyQuery,
  useApproveMessage,
  useMintMessage,
} from '@/lib/sails';
import { getErrorMessage } from '@/lib/utils';

import { useCreatePair, useTokenPrices, useVaraTokenAddress } from '../hooks';
import { createAddLiquidityValidationSchema } from '../schema';
import type { Token, Network, PairsTokens } from '../types';
import {
  getFormattedBalance,
  getNetworks,
  parseUnits,
  calculatePercentage,
  calculateProportionalAmount,
  getSelectedPair,
  calculateLPTokens,
  calculatePoolShare,
  formatUnits,
} from '../utils';

import { InitialLiquidityInfo } from './initial-liquidity-info';

type AddLiquidityProps = {
  pairsTokens: PairsTokens;
  onSuccess: () => void;
  defaultToken0: HexString | null;
  defaultToken1: HexString | null;
};

type AddLiquidityFormData = {
  token0Address: HexString;
  token1Address: HexString;
  amount0: string;
  amount1: string;
};

const AddLiquidity = ({ pairsTokens, onSuccess, defaultToken0, defaultToken1 }: AddLiquidityProps) => {
  const [showToken0Selector, setShowToken0Selector] = useState(false);
  const [showToken1Selector, setShowToken1Selector] = useState(false);

  const defaultValues: AddLiquidityFormData = {
    token0Address: defaultToken0 || pairsTokens.pairsArray[0].token0.address,
    token1Address: defaultToken1 || pairsTokens.pairsArray[0].token1.address,
    amount0: '',
    amount1: '',
  };

  const validationSchema = useMemo(() => createAddLiquidityValidationSchema(pairsTokens.tokens), [pairsTokens.tokens]);

  const form = useForm<AddLiquidityFormData>({
    resolver: zodResolver(validationSchema),
    defaultValues,
    mode: 'onChange',
  });

  const { register, handleSubmit, setValue, formState, control, trigger } = form;
  const { errors, isSubmitting } = formState;

  const watchedValues = useWatch({ control });
  const { token0Address, token1Address, amount0, amount1 } = watchedValues;

  const { tokenImportModalProps, handleAddressSearch, customTokensMap } = useTokenImport({
    onSelectToken: (token: Token) => {
      if (showToken0Selector) {
        setValue('token0Address', token.address);
        setShowToken0Selector(false);
      }
      if (showToken1Selector) {
        setValue('token1Address', token.address);
        setShowToken1Selector(false);
      }
      setShowToken1Selector(false);
    },
    tokens: pairsTokens.tokens,
  });

  const token0 = useMemo(() => {
    if (!token0Address) return undefined;
    return pairsTokens.tokens.get(token0Address) || customTokensMap.get(token0Address);
  }, [pairsTokens, token0Address, customTokensMap]);

  const token1 = useMemo(() => {
    if (!token1Address) return undefined;
    return pairsTokens.tokens.get(token1Address) || customTokensMap.get(token1Address);
  }, [pairsTokens, token1Address, customTokensMap]);

  const { api } = useApi();
  const alert = useAlert();

  const handleToken0Select = (token: Token, _network: Network) => {
    setValue('token0Address', token.address);
  };

  const handleToken1Select = (token: Token, _network: Network) => {
    setValue('token1Address', token.address);
  };

  const selectedPairResult = useMemo(() => {
    if (!token0Address || !token1Address) return null;
    return getSelectedPair(pairsTokens, token0Address, token1Address);
  }, [pairsTokens, token0Address, token1Address]);

  const { selectedPair, isPairReverse } = selectedPairResult || {};
  const pairAddress = selectedPair?.pairAddress;

  const { reserves, isFetching: isReservesFetching, refetch: refreshReserves } = useGetReservesQuery(pairAddress);
  const {
    totalSupply,
    isFetching: isTotalSupplyFetching,
    refetch: refreshTotalSupply,
  } = useVftTotalSupplyQuery(pairAddress);

  const token0Approve = useApproveMessage(token0?.address || ('0x0' as HexString));
  const token1Approve = useApproveMessage(token1?.address || ('0x0' as HexString));

  const addLiquidity = useAddLiquidityMessage(pairAddress);
  const varaTokenAddress = useVaraTokenAddress();
  const mint = useMintMessage(varaTokenAddress);
  const signAndSend = useSignAndSend({
    programs: [token0Approve.program, token1Approve.program, addLiquidity.program, mint.program],
  });

  const { account } = useAccount();
  const isPoolEmpty = reserves?.[0] === 0n && reserves?.[1] === 0n && totalSupply === 0n;

  const handleAmount0Change = (value: string) => {
    if (!isPoolEmpty && reserves?.[0] && reserves?.[1] && isPairReverse !== undefined && token0 && token1) {
      const newAmount1 = calculateProportionalAmount(
        value,
        token0.decimals,
        reserves[0],
        reserves[1],
        token1.decimals,
        isPairReverse,
      );
      setValue('amount1', newAmount1 ?? '', { shouldValidate: true });
    }
  };

  const handleAmount1Change = (value: string) => {
    if (!isPoolEmpty && reserves?.[0] && reserves?.[1] && isPairReverse !== undefined && token0 && token1) {
      const newAmount0 = calculateProportionalAmount(
        value,
        token1.decimals,
        reserves[1],
        reserves[0],
        token0.decimals,
        isPairReverse,
      );
      setValue('amount0', newAmount0 ?? '', { shouldValidate: true });
    }
  };

  useEffect(() => {
    handleAmount0Change(amount0 || '');
    void trigger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token0Address, token1Address, reserves]);

  const { createPair } = useCreatePair();
  const { prices, isLowLiquidity } = useTokenPrices(amount0, amount1, token0, token1, isPoolEmpty);

  if (!token0 || !token1) {
    return <div>Error: Token not found</div>;
  }

  const lpTokensToMint =
    reserves && totalSupply !== undefined && isPairReverse !== undefined && amount0 && amount1 && token0 && token1
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

  const isPending =
    token0Approve.isPending ||
    token1Approve.isPending ||
    addLiquidity.isPending ||
    isTotalSupplyFetching ||
    isReservesFetching ||
    isSubmitting;

  const isInitialLiquidity = isPoolEmpty || !pairAddress;

  const onSubmit = async (data: AddLiquidityFormData) => {
    if (!api || !account?.decodedAddress) {
      throw new Error('API or account is not ready');
    }

    if (!pairAddress) {
      await createPair(token0.address, token1.address);
      return;
    }

    const amountADesired = parseUnits(data.amount0, token0.decimals);
    const amountBDesired = parseUnits(data.amount1, token1.decimals);

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
      const token0ApproveTx = await token0Approve.mutateAsync({
        value: amountADesired,
        spender: pairAddress,
      });
      const token1ApproveTx = await token1Approve.mutateAsync({
        value: amountBDesired,
        spender: pairAddress,
      });
      const addLiquidityTx = await addLiquidity.mutateAsync({
        amountADesired: isPairReverse ? amountBDesired : amountADesired,
        amountBDesired: isPairReverse ? amountADesired : amountBDesired,
        amountAMin: isPairReverse ? amountBMin : amountAMin,
        amountBMin: isPairReverse ? amountAMin : amountBMin,
        deadline: deadline.toString(),
      });
      if (!token0ApproveTx?.extrinsic || !token1ApproveTx?.extrinsic || !addLiquidityTx?.extrinsic) {
        throw new Error('Failed to create batch');
      }

      const transactions = [token0ApproveTx.extrinsic, token1ApproveTx.extrinsic, addLiquidityTx.extrinsic];

      if (token0.isVaraNative) {
        const mintTx0 = await mint.mutateAsync({ value: amountADesired });
        if (mintTx0) {
          transactions.unshift(mintTx0.extrinsic);
        }
      }
      if (token1.isVaraNative) {
        const mintTx1 = await mint.mutateAsync({ value: amountBDesired });
        if (mintTx1) {
          transactions.unshift(mintTx1.extrinsic);
        }
      }

      const extrinsic = api.tx.utility.batchAll(transactions);
      await signAndSend.mutateAsync({ extrinsic });
      void refreshReserves();
      void refreshTotalSupply();
      onSuccess();
      alert.success('Liquidity added successfully');
    } catch (_error) {
      console.error('Error adding liquidity:', _error);
      alert.error(getErrorMessage(_error));
    }
  };

  const networks = getNetworks(pairsTokens, customTokensMap);

  const formError =
    errors.amount0?.message ||
    errors.amount1?.message ||
    errors.token0Address?.message ||
    errors.token1Address?.message;
  const isFormValid = !formError && amount0 && amount1 && !isLowLiquidity;

  return (
    <>
      <Card className="card max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-lg font-bold uppercase theme-text">ADD LIQUIDITY</CardTitle>
          <div className="text-sm text-gray-400">Fixed fee tier: 0.3%</div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                  {...register('amount0', {
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleAmount0Change(e.target.value),
                  })}
                  value={amount0}
                  type="number"
                  inputMode="decimal"
                  placeholder="0.0"
                  className="input-field flex-1 text-xl"
                />
                <Button
                  type="button"
                  onClick={() => setShowToken0Selector(true)}
                  variant="secondary"
                  className="flex items-center space-x-2 min-w-[120px]">
                  <TokenIcon token={token0} size="xs" />
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
                  {...register('amount1', {
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleAmount1Change(e.target.value),
                  })}
                  value={amount1}
                  type="number"
                  inputMode="decimal"
                  placeholder="0.0"
                  className="input-field flex-1 text-xl"
                />
                <Button
                  type="button"
                  onClick={() => setShowToken1Selector(true)}
                  variant="secondary"
                  className="flex items-center space-x-2 min-w-[120px]">
                  <TokenIcon token={token1} size="xs" />
                  <span>{token1.displaySymbol}</span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {isInitialLiquidity && (
              <InitialLiquidityInfo token0={token0} token1={token1} prices={prices} isLowLiquidity={isLowLiquidity} />
            )}
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
                  <span className="theme-text">
                    {isInitialLiquidity ? 'New Pool' : formatUnits(lpTokensToMint, 18)}
                  </span>
                  <Tooltip
                    content={
                      <p className="text-xs">
                        LP tokens represent your share in the liquidity pool. They automatically earn trading fees
                        (0.3%) and can be redeemed for underlying tokens at any time. The amount of LP tokens is
                        proportional to your contribution to the pool&apos;s total liquidity.
                      </p>
                    }
                    contentClassName="max-w-xs">
                    <Info className="w-3 h-3 text-gray-400 cursor-help" />
                  </Tooltip>
                </div>
              </div>
            </div>
            {account ? (
              <Button type="submit" disabled={isPending || !isFormValid} className="btn-primary w-full py-4 text-lg">
                {pairAddress ? 'ADD LIQUIDITY' : 'CREATE PAIR'}
              </Button>
            ) : (
              <Wallet />
            )}
            {formError && <div className="text-red-500">{formError}</div>}
          </form>
        </CardContent>
      </Card>

      {/* Token Selectors */}
      <TokenSelector
        isOpen={showToken0Selector}
        onClose={() => setShowToken0Selector(false)}
        onSelectToken={handleToken0Select}
        title="Select first token"
        networks={networks}
        disabledTokenAddress={token1Address}
        onSearch={handleAddressSearch}
      />

      <TokenSelector
        isOpen={showToken1Selector}
        onClose={() => setShowToken1Selector(false)}
        onSelectToken={handleToken1Select}
        title="Select second token"
        networks={networks}
        disabledTokenAddress={token0Address}
        onSearch={handleAddressSearch}
      />

      <TokenImportModal {...tokenImportModalProps} />
    </>
  );
};

export { AddLiquidity };
