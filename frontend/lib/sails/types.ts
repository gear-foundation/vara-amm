/**
 * Config that will be used to send messages to the other programs or create programs.
 */
export interface FactoryConfig {
  /**
   * Gas limit for token operations. Token operations include:
   * - Mint
   * - Burn
   * - TransferFrom
   */
  gas_for_token_ops: number | string | bigint;
  /**
   * Gas to reserve for reply processing.
   */
  gas_for_reply_deposit: number | string | bigint;
  /**
   * Timeout in blocks that current program will wait for reply from
   * the other programs such as VFT
   */
  reply_timeout: number;
  gas_for_pair_creation: number | string | bigint;
}

export interface Config {
  /**
   * Gas limit for token operations. Token operations include:
   * - Mint
   * - Burn
   * - TransferFrom
   */
  gas_for_token_ops: number | string | bigint;
  /**
   * Gas to reserve for reply processing.
   */
  gas_for_reply_deposit: number | string | bigint;
  /**
   * Timeout in blocks that current program will wait for reply from
   * the other programs such as VFT
   */
  reply_timeout: number;
}
