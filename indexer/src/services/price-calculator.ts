import {
  Token,
  TokenPriceSnapshot,
  Pair,
  Transaction,
  TransactionType,
} from "../model";
import { ProcessorContext } from "../processor";
import { LessThanOrEqual, MoreThanOrEqual, In } from "typeorm";

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
    tokenAddress: string,
    timestamp: Date,
    blockNumber: bigint
  ): Promise<number | null> {
    // Get all pairs containing this token
    const pairs = await this.ctx.store.find(Pair, {
      where: [{ token0: tokenAddress }, { token1: tokenAddress }],
    });

    if (pairs.length === 0) {
      return null;
    }

    // For now, we'll use a simple approach:
    // 1. If there's a USDC or USDT pair, use that (assume stablecoin = $1)
    // 2. Otherwise, try to find a chain of pairs to calculate price

    const stablecoins = ["USDC", "USDT"]; // Add known stablecoin symbols

    for (const pair of pairs) {
      const isToken0 = pair.token0 === tokenAddress;
      const otherTokenSymbol = isToken0 ? pair.token1Symbol : pair.token0Symbol;

      if (otherTokenSymbol && stablecoins.includes(otherTokenSymbol)) {
        // Calculate price against stablecoin
        const tokenReserve = isToken0 ? pair.reserve0 : pair.reserve1;
        const stablecoinReserve = isToken0 ? pair.reserve1 : pair.reserve0;

        if (tokenReserve > 0n && stablecoinReserve > 0n) {
          // Price = stablecoinReserve / tokenReserve
          return Number(stablecoinReserve) / Number(tokenReserve);
        }
      }
    }

    // If no direct stablecoin pair, return null for now
    // TODO: Implement multi-hop price calculation
    return null;
  }

  /**
   * Calculate volume in USD for a given amount and token
   */
  async calculateVolumeUSD(
    tokenAddress: string,
    amount: bigint,
    priceUSD: number
  ): Promise<number> {
    const token = await this.ctx.store.get(Token, tokenAddress);
    if (!token) return 0;

    // Convert amount to human readable format using decimals
    const humanAmount = Number(amount) / Math.pow(10, token.decimals);
    return humanAmount * priceUSD;
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

    const reserve0USD =
      (Number(pair.reserve0) / Math.pow(10, token0.decimals)) * token0.priceUsd;
    const reserve1USD =
      (Number(pair.reserve1) / Math.pow(10, token1.decimals)) * token1.priceUsd;

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
    const now = timestamp;
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

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

    const price1h = await getClosestPrice(oneHourAgo);
    const price24h = await getClosestPrice(oneDayAgo);
    const price7d = await getClosestPrice(sevenDaysAgo);
    const price30d = await getClosestPrice(thirtyDaysAgo);

    const calculateChange = (oldPrice: number | null): number | null => {
      if (!oldPrice || oldPrice === 0) return null;
      return ((currentPrice - oldPrice) / oldPrice) * 100;
    };

    return {
      change1h: calculateChange(price1h),
      change24h: calculateChange(price24h),
      change7d: calculateChange(price7d),
      change30d: calculateChange(price30d),
    };
  }

  /**
   * Calculate volume for different time periods based on transactions
   */
  async calculateVolumeMetrics(
    tokenAddress: string,
    timestamp: Date
  ): Promise<{
    volume1h: number;
    volume24h: number;
    volume7d: number;
    volume30d: number;
    volume1y: number;
  }> {
    const now = timestamp;
    const periods = {
      volume1h: new Date(now.getTime() - 60 * 60 * 1000),
      volume24h: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      volume7d: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      volume30d: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      volume1y: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
    };

    const results: any = {};

    for (const [key, startTime] of Object.entries(periods)) {
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
    tokenAddress: string,
    timestamp: Date,
    blockNumber: bigint
  ): Promise<{
    token: Token | null;
    snapshot: TokenPriceSnapshot | null;
  }> {
    let token = await this.ctx.store.get(Token, tokenAddress);
    if (!token) return { token: null, snapshot: null };

    // Calculate current price
    const currentPrice = await this.calculateTokenPrice(
      tokenAddress,
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
      tokenAddress,
      timestamp
    );

    // Calculate FDV (Fully Diluted Valuation)
    const fdv = token.totalSupply
      ? (Number(token.totalSupply) / Math.pow(10, token.decimals)) *
        currentPrice
      : null;

    // Update token
    token.priceUsd = currentPrice;
    token.volume24h = volumeMetrics.volume24h;
    token.volume7d = volumeMetrics.volume7d;
    token.volume30d = volumeMetrics.volume30d;
    token.fdv = fdv;
    token.updatedAt = timestamp;

    // Create price snapshot
    const snapshotId = `${tokenAddress}:${blockNumber.toString()}`;
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
