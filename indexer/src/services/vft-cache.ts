import { GearApi } from "@gear-js/api";
import { VftProgram } from "./sails";

/**
 * Cache for VftProgram instances to avoid creating duplicates
 * for the same token address
 */
export class VftProgramCache {
  private cache: Map<string, VftProgram> = new Map();
  private api: GearApi;

  constructor(api: GearApi) {
    this.api = api;
  }

  /**
   * Get or create a VftProgram instance for the given token address
   * @param tokenAddress The token contract address
   * @returns VftProgram instance
   */
  getOrCreate(tokenAddress: string): VftProgram {
    let vftProgram = this.cache.get(tokenAddress);
    
    if (!vftProgram) {
      vftProgram = new VftProgram(this.api, tokenAddress as `0x${string}`);
      this.cache.set(tokenAddress, vftProgram);
    }
    
    return vftProgram;
  }

  /**
   * Clear the cache (useful for testing or memory management)
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size (for monitoring)
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Check if a token address is cached
   */
  has(tokenAddress: string): boolean {
    return this.cache.has(tokenAddress);
  }
}
