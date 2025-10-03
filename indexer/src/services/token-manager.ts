import { Token } from "../model";
import { ProcessorContext } from "../processor";
import { VftProgramCache } from "./vft-cache";

export class TokenManager {
  private ctx: ProcessorContext;
  private vftCache: VftProgramCache;

  constructor(ctx: ProcessorContext, vftCache: VftProgramCache) {
    this.ctx = ctx;
    this.vftCache = vftCache;
  }

  /**
   * Create a new token entity by querying the contract
   */
  async createTokenFromContract(tokenAddress: string): Promise<Token> {
    const vftProgram = this.vftCache.getOrCreate(tokenAddress);

    try {
      const [symbol, name, decimals, totalSupply] = await Promise.all([
        vftProgram.vft.symbol(),
        vftProgram.vft.name().catch(() => null), // name might not be implemented
        vftProgram.vft.decimals(),
        vftProgram.vft.totalSupply(),
      ]);

      return new Token({
        id: tokenAddress,
        symbol,
        name,
        decimals: Number(decimals),
        totalSupply: BigInt(totalSupply),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      this.ctx.log.error(
        { error, tokenAddress },
        "Failed to create token from contract"
      );
    }
  }
}
