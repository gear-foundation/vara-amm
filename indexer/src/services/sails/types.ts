import { HexString } from "@gear-js/api";

interface LiquidityEventPayload {
  user_id: HexString;
  amount_a: number | string | bigint;
  amount_b: number | string | bigint;
  liquidity: number | string | bigint;
}

interface SwapEventPayload {
  user_id: HexString;
  amount_in: number | string | bigint;
  amount_out: number | string | bigint;
  is_token0_to_token1: boolean;
}

type PairEventPayload = LiquidityEventPayload | SwapEventPayload;

export { PairEventPayload, LiquidityEventPayload, SwapEventPayload };
