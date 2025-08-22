import { HexString } from "@gear-js/api";

export interface PairInfo {
  tokens: [HexString, HexString];
  address: HexString;
}
