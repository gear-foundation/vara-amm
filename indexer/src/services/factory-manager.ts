import { GearApi, HexString } from "@gear-js/api";

import { SailsProgram as FactoryProgram } from "./factory-program";
import { PairInfo } from "../types";

export class FactoryManager {
  private _pairs: PairInfo[] = [];

  constructor(private _factoryProgramId: HexString) {}

  public async init(api: GearApi): Promise<void> {
    console.log("[*] Initializing FactoryManager...");
    await this._loadPairs(api);
  }

  private async _loadPairs(api: GearApi): Promise<void> {
    try {
      console.log("[*] Loading pairs from factory:", this._factoryProgramId);

      const factoryProgram = new FactoryProgram(api, this._factoryProgramId);

      const pairsData = await factoryProgram.factory.pairs();

      this._pairs = pairsData.map(([[token0, token1], pairAddress]) => ({
        tokens: [token0, token1],
        address: pairAddress,
      }));

      console.log(`[*] Loaded ${this._pairs.length} pairs:`, this._pairs);
    } catch (error) {
      console.error("[!] Error loading pairs:", error);
      throw error;
    }
  }

  public getPairs(): PairInfo[] {
    return this._pairs;
  }

  public getPairAddresses(): string[] {
    return this._pairs.map((pair) => pair.address);
  }
}
