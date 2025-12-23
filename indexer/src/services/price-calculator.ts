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
   * Uses multi-tier pricing strategy with liquidity-weighted average:
   *
   * Tier 1: Direct pairs with stablecoins (most reliable)
   * Tier 2: Pairs with whitelisted base tokens (BTC, ETH, WVARA)
   * Tier 3: Derived pricing from any token with known price
   */
  calculateTokenPrice(
    token: Token,
    pairs: Pair[],
    tokens: Map<string, Token>,
    tokenPrices: Map<string, number>
  ): number | null {
    if (!pairs.length) {
      return null;
    }

    // Tier 1: Direct stablecoin pairs (highest priority)
    const tier1Price = this.calculatePriceFromPairs(
      token,
      pairs.filter((p) => {
        const otherSymbol =
          p.token0 === token.id ? p.token1Symbol : p.token0Symbol;
        return otherSymbol && PriceUtils.isStablecoin(otherSymbol);
      }),
      tokens,
      tokenPrices
    );
    if (tier1Price !== null) return tier1Price;

    // Tier 2: Whitelisted base token pairs (high liquidity tokens)
    const tier2Price = this.calculatePriceFromPairs(
      token,
      pairs.filter((p) => {
        const otherSymbol =
          p.token0 === token.id ? p.token1Symbol : p.token0Symbol;
        return otherSymbol && PriceUtils.isWhitelistedBaseToken(otherSymbol);
      }),
      tokens,
      tokenPrices
    );
    if (tier2Price !== null) return tier2Price;

    // Tier 3: Any pair with a token that has a known price
    const tier3Price = this.calculatePriceFromPairs(
      token,
      pairs.filter((p) => {
        const otherTokenId = p.token0 === token.id ? p.token1 : p.token0;
        return tokenPrices.has(otherTokenId);
      }),
      tokens,
      tokenPrices
    );

    return tier3Price;
  }

  /**
   * Calculate liquidity-weighted average price from a set of pairs
   * Supports derived pricing: uses known prices of paired tokens
   */
  private calculatePriceFromPairs(
    token: Token,
    pairs: Pair[],
    tokens: Map<string, Token>,
    tokenPrices: Map<string, number>
  ): number | null {
    if (!pairs.length) {
      return null;
    }

    let totalWeightedPrice = 0;
    let totalWeight = 0;

    for (const pair of pairs) {
      const isToken0 = pair.token0 === token.id;
      const otherTokenId = isToken0 ? pair.token1 : pair.token0;
      const otherToken = tokens.get(otherTokenId);

      if (!otherToken) continue;

      const tokenReserve = isToken0 ? pair.reserve0 : pair.reserve1;
      const otherTokenReserve = isToken0 ? pair.reserve1 : pair.reserve0;

      if (tokenReserve === 0n || otherTokenReserve === 0n) continue;

      // Calculate price ratio from reserves (in terms of other token)
      const priceInOtherToken = PriceUtils.calculatePriceFromReserves(
        tokenReserve,
        otherTokenReserve,
        token.decimals,
        otherToken.decimals
      );

      // Get USD price of the other token
      let otherTokenPriceUSD: number;

      const otherTokenSymbol = isToken0 ? pair.token1Symbol : pair.token0Symbol;
      if (otherTokenSymbol && PriceUtils.isStablecoin(otherTokenSymbol)) {
        // Stablecoins are assumed to be $1
        otherTokenPriceUSD = 1.0;
      } else if (tokenPrices.has(otherTokenId)) {
        // Use known price from priceSnapshot
        otherTokenPriceUSD = tokenPrices.get(otherTokenId)!;
      } else {
        // No price available for the paired token
        continue;
      }

      const derivedPriceUSD = priceInOtherToken * otherTokenPriceUSD;

      // Use liquidity (TVL) as weight for more accurate pricing
      // High liquidity pairs have more influence on the final price
      const weight = pair.tvlUsd || 1;

      totalWeightedPrice += derivedPriceUSD * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) {
      return null;
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
    blockNumber: bigint,
    pairs: Pair[],
    tokens: Map<string, Token>,
    tokenPrices: Map<string, number>
  ): Promise<{
    snapshot: TokenPriceSnapshot | null;
  }> {
    // Calculate current price using multi-tier pricing strategy
    const currentPrice = this.calculateTokenPrice(
      token,
      pairs,
      tokens,
      tokenPrices
    );
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
