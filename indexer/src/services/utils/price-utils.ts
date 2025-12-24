/**
 * Utility functions for price calculations
 */
export class PriceUtils {
  /**
   * Convert token amount to human readable format using decimals
   * Uses BigInt arithmetic to avoid precision loss
   */
  static toHumanAmount(amount: bigint, decimals: number): number {
    if (decimals === 0) {
      return Number(amount);
    }
    
    const divisor = BigInt(10 ** decimals);
    const wholePart = amount / divisor;
    const fractionalPart = amount % divisor;
    
    // Convert to number safely
    const wholeNumber = Number(wholePart);
    const fractionalNumber = Number(fractionalPart) / (10 ** decimals);
    
    return wholeNumber + fractionalNumber;
  }

  /**
   * Calculate USD value for a token amount
   */
  static calculateUSDValue(
    amount: bigint,
    decimals: number,
    priceUSD: number
  ): number {
    const humanAmount = this.toHumanAmount(amount, decimals);
    return humanAmount * priceUSD;
  }

  /**
   * Calculate mid/spot price from reserves (for Uniswap V2 pairs)
   * Returns the real pool price without fees or price impact
   * Formula: price = (otherTokenReserve / tokenReserve) * 10^(tokenDecimals - otherTokenDecimals)
   */
  static calculatePriceFromReserves(
    tokenReserve: bigint,
    otherTokenReserve: bigint,
    tokenDecimals: number,
    otherTokenDecimals: number
  ): number {
    if (tokenReserve === 0n || otherTokenReserve === 0n) {
      return 0;
    }

    // Use fixed-point precision Q = 10^18 for accurate division
    const Q = 10n ** 18n;
    
    // Calculate price with Q precision: (otherTokenReserve * Q) / tokenReserve
    const priceQ = (otherTokenReserve * Q) / tokenReserve;
    
    // Adjust for decimal differences
    const decimalsDiff = tokenDecimals - otherTokenDecimals;
    let adjustedPriceQ: bigint;
    
    if (decimalsDiff > 0) {
      // tokenDecimals > otherTokenDecimals, multiply by 10^decimalsDiff
      adjustedPriceQ = priceQ * (10n ** BigInt(decimalsDiff));
    } else if (decimalsDiff < 0) {
      // tokenDecimals < otherTokenDecimals, divide by 10^|decimalsDiff|
      adjustedPriceQ = priceQ / (10n ** BigInt(-decimalsDiff));
    } else {
      // Same decimals, no adjustment needed
      adjustedPriceQ = priceQ;
    }
    
    // Convert from Q-precision to number
    return Number(adjustedPriceQ) / Number(Q);
  }

  /**
   * Calculate FDV (Fully Diluted Valuation)
   */
  static calculateFDV(
    totalSupply: bigint | null,
    decimals: number,
    priceUSD: number
  ): number | null {
    if (!totalSupply) return null;
    const humanSupply = this.toHumanAmount(totalSupply, decimals);
    return humanSupply * priceUSD;
  }

  /**
   * Check if a token symbol is a known stablecoin
   */
  static isStablecoin(symbol: string): boolean {
    const stablecoins = ["WUSDC", "WUSDT", "USDC", "USDT"];
    return stablecoins.includes(symbol.toUpperCase());
  }

  /**
   * Check if a token symbol is a whitelisted base token for derived pricing
   * These are high-liquidity, trusted tokens used as price reference
   */
  static isWhitelistedBaseToken(symbol: string): boolean {
    const baseTokens = [
      "WVARA", "VARA",  // Native token
      "WETH", "ETH",     // Ethereum
      "WBTC", "BTC",     // Bitcoin
      "WUSDC", "WUSDT", "USDC", "USDT"  // Stablecoins
    ];
    return baseTokens.includes(symbol.toUpperCase());
  }

  /**
   * Calculate percentage change
   */
  static calculatePercentageChange(
    current: number,
    previous: number | null
  ): number | null {
    if (!previous || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  }
}
