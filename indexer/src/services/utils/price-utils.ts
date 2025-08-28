import { Token } from "../../model";

/**
 * Utility functions for price calculations
 */
export class PriceUtils {
  /**
   * Convert token amount to human readable format using decimals
   */
  static toHumanAmount(amount: bigint, decimals: number): number {
    return Number(amount) / Math.pow(10, decimals);
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

    const tokenAmount = this.toHumanAmount(tokenReserve, tokenDecimals);
    const otherTokenAmount = this.toHumanAmount(otherTokenReserve, otherTokenDecimals);
    
    return otherTokenAmount / tokenAmount;
  }

  /**
   * Calculate FDV (Fully Diluted Valuation)
   */
  static calculateFDV(totalSupply: bigint | null, decimals: number, priceUSD: number): number | null {
    if (!totalSupply) return null;
    const humanSupply = this.toHumanAmount(totalSupply, decimals);
    return humanSupply * priceUSD;
  }

  /**
   * Check if a token symbol is a known stablecoin
   */
  static isStablecoin(symbol: string): boolean {
    const stablecoins = ["USDC", "USDT", "DAI", "BUSD", "USDD"];
    return stablecoins.includes(symbol.toUpperCase());
  }

  /**
   * Calculate percentage change
   */
  static calculatePercentageChange(current: number, previous: number | null): number | null {
    if (!previous || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  }
}
