interface LiquidityEventPayload {
  amount_a: number | string | bigint;
  amount_b: number | string | bigint;
  liquidity: number | string | bigint;
}

// Swap event currently doesn't contain data in IDL, but will be updated soon
// Expected future structure based on swap operations:
interface SwapEventPayload {
  amount_in?: number | string | bigint;
  amount_out?: number | string | bigint;
  token_in?: string;
  token_out?: string;
  // TODO: Update when new Swap event structure is implemented
}

type PairEventPayload = LiquidityEventPayload | SwapEventPayload;

export { PairEventPayload, LiquidityEventPayload, SwapEventPayload };
