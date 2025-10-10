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
   * Calculate price from reserves (for AMM pairs)
   * Uses the same formula as GetAmountOut with 0.3% fee (997/1000 multiplier)
   * Formula: amount_out = (amount_in * 997 * reserve_out) / (reserve_in * 1000 + amount_in * 997)
   * For price calculation, we use 1 unit of input token to get the price
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

    const amountIn = BigInt(Math.pow(10, tokenDecimals));
    const numerator = amountIn * 997n * otherTokenReserve;
    const denominator = tokenReserve * 1000n + amountIn * 997n;

    if (denominator === 0n) {
      return 0;
    }

    const amountOut = numerator / denominator;
    const priceInOtherToken = this.toHumanAmount(amountOut, otherTokenDecimals);

    return priceInOtherToken;
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
