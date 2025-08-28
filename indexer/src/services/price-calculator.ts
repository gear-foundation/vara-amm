import {
  Token,
  TokenPriceSnapshot,
  Pair,
  Transaction,
  TransactionType,
} from "../model";
import { ProcessorContext } from "../processor";
import { LessThanOrEqual, MoreThanOrEqual } from "typeorm";
import { PriceUtils, TimeUtils } from "./utils";
import { VolumePeriods } from "../types";

export class PriceCalculator {
  private ctx: ProcessorContext;

  constructor(ctx: ProcessorContext) {
    this.ctx = ctx;
  }

  /**
   * Calculate token price in USD based on pair reserves
   * Uses the most liquid pair to determine price
   */
  async calculateTokenPrice(
    token: Token,
    timestamp: Date,
    blockNumber: bigint
  ): Promise<number | null> {
    // Get all pairs containing this token
    const pairs = await this.ctx.store.find(Pair, {
      where: [{ token0: token.id }, { token1: token.id }],
    });

    if (pairs.length === 0) {
      return null;
    }

    // Find a stablecoin pair for direct price calculation
    for (const pair of pairs) {
      const isToken0 = pair.token0 === token.id;
      const otherTokenSymbol = isToken0 ? pair.token1Symbol : pair.token0Symbol;

      if (otherTokenSymbol && PriceUtils.isStablecoin(otherTokenSymbol)) {
        const tokenReserve = isToken0 ? pair.reserve0 : pair.reserve1;
        const stablecoinReserve = isToken0 ? pair.reserve1 : pair.reserve0;

        // Get other token for accurate calculation
        const otherToken = await this.ctx.store.get(
          Token,
          isToken0 ? pair.token1 : pair.token0
        );

        if (otherToken && tokenReserve > 0n && stablecoinReserve > 0n) {
          return PriceUtils.calculatePriceFromReserves(
            tokenReserve,
            stablecoinReserve,
            token.decimals,
            otherToken.decimals
          );
        }
      }
    }

    // If no direct stablecoin pair, return null for now
    // TODO: Implement multi-hop price calculation
    return null;
  }

  /**
   * Calculate TVL (Total Value Locked) for a pair in USD
   */
  async calculatePairTVL(pair: Pair): Promise<number> {
    const token0 = await this.ctx.store.get(Token, pair.token0);
    const token1 = await this.ctx.store.get(Token, pair.token1);

    if (!token0 || !token1 || !token0.priceUsd || !token1.priceUsd) {
      return 0;
    }

    const reserve0USD = PriceUtils.calculateUSDValue(
      pair.reserve0,
      token0.decimals,
      token0.priceUsd
    );
    const reserve1USD = PriceUtils.calculateUSDValue(
      pair.reserve1,
      token1.decimals,
      token1.priceUsd
    );

    return reserve0USD + reserve1USD;
  }

  /**
   * Calculate price changes for a token
   */
  async calculatePriceChanges(
    token: Token,
    currentPrice: number,
    timestamp: Date
  ): Promise<{
    change1h: number | null;
    change24h: number | null;
    change7d: number | null;
    change30d: number | null;
  }> {
    const periods = TimeUtils.getTimePeriods(timestamp);

    const getClosestPrice = async (
      targetTime: Date
    ): Promise<number | null> => {
      const snapshot = await this.ctx.store.findOne(TokenPriceSnapshot, {
        where: {
          token: { id: token.id },
          timestamp: LessThanOrEqual(targetTime),
        },
        order: { timestamp: "DESC" },
      });
      return snapshot?.priceUsd || null;
    };

    const price1h = await getClosestPrice(periods.oneHourAgo);
    const price24h = await getClosestPrice(periods.oneDayAgo);
    const price7d = await getClosestPrice(periods.sevenDaysAgo);
    const price30d = await getClosestPrice(periods.thirtyDaysAgo);

    return {
      change1h: PriceUtils.calculatePercentageChange(currentPrice, price1h),
      change24h: PriceUtils.calculatePercentageChange(currentPrice, price24h),
      change7d: PriceUtils.calculatePercentageChange(currentPrice, price7d),
      change30d: PriceUtils.calculatePercentageChange(currentPrice, price30d),
    };
  }

  /**
   * Calculate volume for different time periods based on transactions
   */
  async calculateVolumeMetrics(
    tokenAddress: string,
    timestamp: Date
  ): Promise<VolumePeriods> {
    const periods = TimeUtils.getTimePeriods(timestamp);
    const periodMap = {
      volume1h: periods.oneHourAgo,
      volume24h: periods.oneDayAgo,
      volume7d: periods.sevenDaysAgo,
      volume30d: periods.thirtyDaysAgo,
      volume1y: periods.oneYearAgo,
    };

    const results: any = {};

    for (const [key, startTime] of Object.entries(periodMap)) {
      // Get all transactions in this period where this token is involved
      const transactions = await this.ctx.store.find(Transaction, {
        where: {
          timestamp: MoreThanOrEqual(startTime),
        },
        relations: {
          pair: true,
        },
      });

      // Calculate total volume for this period
      let totalVolume = 0;

      for (const tx of transactions) {
        let shouldCount = false;
        let volumeToAdd = 0;

        if (tx.type === TransactionType.SWAP) {
          // For swaps, count if this token is involved
          if (tx.tokenIn === tokenAddress || tx.tokenOut === tokenAddress) {
            shouldCount = true;
            // Use the transaction's total value (which is now only input side)
            volumeToAdd = tx.valueUsd || 0;
          }
        }

        if (shouldCount) {
          totalVolume += volumeToAdd;
        }
      }

      results[key] = totalVolume;
    }

    return results;
  }

  /**
   * Prepare token metrics including price, volume, and changes
   * Returns updated token and snapshot to be saved by the handler
   */
  async prepareTokenMetrics(
    token: Token,
    timestamp: Date,
    blockNumber: bigint
  ): Promise<{
    token: Token | null;
    snapshot: TokenPriceSnapshot | null;
  }> {
    // Calculate current price
    const currentPrice = await this.calculateTokenPrice(
      token,
      timestamp,
      blockNumber
    );
    if (!currentPrice) return { token: null, snapshot: null };

    // Calculate price changes
    const changes = await this.calculatePriceChanges(
      token,
      currentPrice,
      timestamp
    );

    // Calculate volume metrics
    const volumeMetrics = await this.calculateVolumeMetrics(
      token.id,
      timestamp
    );

    // Calculate FDV (Fully Diluted Valuation)
    const fdv = PriceUtils.calculateFDV(
      token.totalSupply,
      token.decimals,
      currentPrice
    );

    // Update token
    token.priceUsd = currentPrice;
    token.volume24h = volumeMetrics.volume24h;
    token.volume7d = volumeMetrics.volume7d;
    token.volume30d = volumeMetrics.volume30d;
    token.fdv = fdv;
    token.updatedAt = timestamp;

    // Create price snapshot
    const snapshotId = `${token.id}:${blockNumber.toString()}`;
    const snapshot = new TokenPriceSnapshot({
      id: snapshotId,
      token,
      priceUsd: currentPrice,
      volume1h: volumeMetrics.volume1h,
      volume24h: volumeMetrics.volume24h,
      volume7d: volumeMetrics.volume7d,
      volume30d: volumeMetrics.volume30d,
      volume1y: volumeMetrics.volume1y,
      change1h: changes.change1h,
      change24h: changes.change24h,
      change7d: changes.change7d,
      change30d: changes.change30d,
      timestamp,
      blockNumber,
    });

    return { token, snapshot };
  }
}
