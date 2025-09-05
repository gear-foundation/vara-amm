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

/**
 * State in which message processing can be.
 */
export type MessageStatus =
  | { sendingMsgToLockTokenA: null }
  /**
   * Reply is received for a token deposit message.
   */
  | { tokenALocked: boolean }
  | { sendingMsgToLockTokenB: null }
  /**
   * Reply is received for a token deposit message.
   */
  | { tokenBLocked: boolean }
  /**
   * Message to refund tokens is sent.
   */
  | { sendingMessageToReturnTokensA: null }
  /**
   * Reply is received for a token refund message.
   */
  | { tokensAReturnComplete: boolean }
  | { sendingMsgToTransferTokenIn: null }
  | { tokenInTransfered: boolean }
  | { sendingMsgToTransferTokenOut: null }
  | { tokenOutTransfered: boolean }
  | { sendingMessageToReturnTokenIn: null }
  | { tokenInReturnComplete: boolean }
  | { sendingMsgToUnlockTokenA: null }
  /**
   * Reply is received for a token deposit message.
   */
  | { tokenAUnlocked: boolean }
  | { sendingMsgToUnlockTokenB: null }
  /**
   * Reply is received for a token deposit message.
   */
  | { tokenBUnlocked: boolean };
