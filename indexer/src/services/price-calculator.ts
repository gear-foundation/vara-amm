import { Token, TokenPriceSnapshot, Pair } from "../model";
import { ProcessorContext } from "../processor";
import { LessThanOrEqual } from "typeorm";
import { PriceUtils, TimeUtils } from "./utils";

export class PriceCalculator {
  private ctx: ProcessorContext;

  constructor(ctx: ProcessorContext) {
    this.ctx = ctx;
  }

  /**
   * Calculate token price in USD based on pair reserves
   * Uses liquidity-weighted average price from all stablecoin pairs
   */
  async calculateTokenPrice(token: Token): Promise<number | null> {
    // Get all pairs containing this token
    const pairs = await this.ctx.store.find(Pair, {
      where: [{ token0: token.id }, { token1: token.id }],
    });

    if (pairs.length === 0) {
      return null;
    }

    let totalWeightedPrice = 0;
    let totalWeight = 0;

    // Collect all stablecoin pairs and calculate weighted average
    for (const pair of pairs) {
      const isToken0 = pair.token0 === token.id;
      const otherTokenSymbol = isToken0 ? pair.token1Symbol : pair.token0Symbol;

      if (otherTokenSymbol && PriceUtils.isStablecoin(otherTokenSymbol)) {
        const tokenReserve = isToken0 ? pair.reserve0 : pair.reserve1;
        const stablecoinReserve = isToken0 ? pair.reserve1 : pair.reserve0;

        if (tokenReserve > 0n && stablecoinReserve > 0n) {
          // Get other token for accurate calculation
          const otherToken = await this.ctx.store.get(
            Token,
            isToken0 ? pair.token1 : pair.token0
          );

          if (!otherToken) continue;

          const pairPrice = PriceUtils.calculatePriceFromReserves(
            tokenReserve,
            stablecoinReserve,
            token.decimals,
            otherToken.decimals
          );

          // Use TVL as weight for the price calculation
          const weight = pair.tvlUsd || 1;

          totalWeightedPrice += pairPrice * weight;
          totalWeight += weight;
        }
      }
    }

    return totalWeightedPrice / totalWeight;
  }

  /**
   * Calculate TVL (Total Value Locked) for a pair in USD
   */
  calculatePairTVL(
    pair: Pair,
    token0: Token,
    token1: Token,
    token0Price?: number,
    token1Price?: number
  ): number {
    if (!token0 || !token1 || !token0Price || !token1Price) {
      return 0;
    }

    const reserve0USD = PriceUtils.calculateUSDValue(
      pair.reserve0,
      token0.decimals,
      token0Price
    );
    const reserve1USD = PriceUtils.calculateUSDValue(
      pair.reserve1,
      token1.decimals,
      token1Price
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

    return {
      change1h: PriceUtils.calculatePercentageChange(currentPrice, price1h),
      change24h: PriceUtils.calculatePercentageChange(currentPrice, price24h),
    };
  }

  /**
   * Prepare token metrics including price, volume, and changes
   * Returns updated token and snapshot to be saved by the handler
   */
  async prepareTokenPriceSnapshot(
    token: Token,
    timestamp: Date,
    blockNumber: bigint
  ): Promise<{
    snapshot: TokenPriceSnapshot | null;
  }> {
    // Calculate current price
    const currentPrice = await this.calculateTokenPrice(token);
    if (!currentPrice) return { snapshot: null };

    // Calculate price changes
    const changes = await this.calculatePriceChanges(
      token,
      currentPrice,
      timestamp
    );

    // Calculate FDV (Fully Diluted Valuation)
    const fdv = PriceUtils.calculateFDV(
      token.totalSupply,
      token.decimals,
      currentPrice
    );

    // Create price snapshot
    const snapshotId = `${token.id}:${blockNumber.toString()}`;
    const snapshot = new TokenPriceSnapshot({
      id: snapshotId,
      token,
      priceUsd: currentPrice,
      fdv,
      change1h: changes.change1h,
      change24h: changes.change24h,
      timestamp,
      blockNumber,
    });

    return { snapshot };
  }
}
