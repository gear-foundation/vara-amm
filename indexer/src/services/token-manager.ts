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
   * Get or create a token entity
   * Returns the token and whether it was newly created
   */
  async getOrCreateToken(
    tokenAddress: string
  ): Promise<{ token: Token; isNew: boolean }> {
    let token = await this.ctx.store.get(Token, tokenAddress);

    if (!token) {
      // Create new token by querying the contract
      token = await this.createTokenFromContract(tokenAddress);
      return { token, isNew: true };
    }

    return { token, isNew: false };
  }

  /**
   * Create a new token entity by querying the contract
   */
  private async createTokenFromContract(tokenAddress: string): Promise<Token> {
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
