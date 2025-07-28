import { GearApi, HexString, decodeAddress } from "@gear-js/api";
import { TypeRegistry } from "@polkadot/types";
import {
  TransactionBuilder,
  ActorId,
  throwOnErrorReply,
  getServiceNamePrefix,
  getFnNamePrefix,
  ZERO_ADDRESS,
} from "sails-js";
import { Config } from "./types";

export class Program {
  public readonly registry: TypeRegistry;
  public readonly pair: Pair;
  public readonly vft: Vft;

  constructor(public api: GearApi, private _programId?: `0x${string}`) {
    const types: Record<string, any> = {
      Config: {
        gas_for_token_ops: "u64",
        gas_for_reply_deposit: "u64",
        reply_timeout: "u32",
      },
    };

    this.registry = new TypeRegistry();
    this.registry.setKnownTypes({ types });
    this.registry.register(types);

    this.pair = new Pair(this);
    this.vft = new Vft(this);
  }

  public get programId(): `0x${string}` {
    if (!this._programId) throw new Error(`Program ID is not set`);
    return this._programId;
  }

  newCtorFromCode(
    code: Uint8Array | Buffer | HexString,
    config: Config,
    token0: ActorId,
    token1: ActorId,
    fee_to: ActorId
  ): TransactionBuilder<null> {
    const builder = new TransactionBuilder<null>(
      this.api,
      this.registry,
      "upload_program",
      ["New", config, token0, token1, fee_to],
      "(String, Config, [u8;32], [u8;32], [u8;32])",
      "String",
      code
    );

    this._programId = builder.programId;
    return builder;
  }

  newCtorFromCodeId(
    codeId: `0x${string}`,
    config: Config,
    token0: ActorId,
    token1: ActorId,
    fee_to: ActorId
  ) {
    const builder = new TransactionBuilder<null>(
      this.api,
      this.registry,
      "create_program",
      ["New", config, token0, token1, fee_to],
      "(String, Config, [u8;32], [u8;32], [u8;32])",
      "String",
      codeId
    );

    this._programId = builder.programId;
    return builder;
  }
}

export class Pair {
  constructor(private _program: Program) {}

  public addLiquidity(
    amount_a_desired: number | string | bigint,
    amount_b_desired: number | string | bigint,
    amount_a_min: number | string | bigint,
    amount_b_min: number | string | bigint,
    deadline: number | string | bigint
  ): TransactionBuilder<null> {
    if (!this._program.programId) throw new Error("Program ID is not set");
    return new TransactionBuilder<null>(
      this._program.api,
      this._program.registry,
      "send_message",
      [
        "Pair",
        "AddLiquidity",
        amount_a_desired,
        amount_b_desired,
        amount_a_min,
        amount_b_min,
        deadline,
      ],
      "(String, String, U256, U256, U256, U256, u64)",
      "Null",
      this._program.programId
    );
  }

  /**
   * Removes liquidity from the AMM pool
   *
   * # Parameters
   * * `liquidity` - Amount of LP tokens to burn
   * * `amount_a_min` - Minimum amount of token A to receive (slippage protection)
   * * `amount_b_min` - Minimum amount of token B to receive (slippage protection)
   * * `deadline` - Timestamp after which the transaction is considered invalid
   *
   * # Algorithm
   * 1. Validates deadline and user's LP token balance
   * 2. Mints accumulated protocol fees (modifies state permanently)
   * 3. Calculates proportional amounts of tokens A and B to return
   * 4. Validates amounts against minimum thresholds
   * 5. Burns user's LP tokens and transfers underlying tokens back
   * 6. Updates pool reserves
   */
  public removeLiquidity(
    liquidity: number | string | bigint,
    amount_a_min: number | string | bigint,
    amount_b_min: number | string | bigint,
    deadline: number | string | bigint
  ): TransactionBuilder<null> {
    if (!this._program.programId) throw new Error("Program ID is not set");
    return new TransactionBuilder<null>(
      this._program.api,
      this._program.registry,
      "send_message",
      [
        "Pair",
        "RemoveLiquidity",
        liquidity,
        amount_a_min,
        amount_b_min,
        deadline,
      ],
      "(String, String, U256, U256, U256, u64)",
      "Null",
      this._program.programId
    );
  }

  /**
   * Swaps an exact amount of input tokens for as many output tokens as possible in a single pair.
   * Direction is specified by is_token0_to_token1 (true for token0 -> token1, false for token1 -> token0).
   * Combines high-level swap logic with low-level swap execution for a single-contract setup.
   * # Arguments
   * * `amount_in` - Exact amount of input token to swap
   * * `amount_out_min` - Minimum amount of output token expected (slippage protection)
   * * `is_token0_to_token1` - Direction of swap (true: token0 to token1, false: token1 to token0)
   * * `deadline` - Unix timestamp after which the transaction will revert
   */
  public swapExactTokensForTokens(
    amount_in: number | string | bigint,
    amount_out_min: number | string | bigint,
    is_token0_to_token1: boolean,
    deadline: number | string | bigint
  ): TransactionBuilder<null> {
    if (!this._program.programId) throw new Error("Program ID is not set");
    return new TransactionBuilder<null>(
      this._program.api,
      this._program.registry,
      "send_message",
      [
        "Pair",
        "SwapExactTokensForTokens",
        amount_in,
        amount_out_min,
        is_token0_to_token1,
        deadline,
      ],
      "(String, String, U256, U256, bool, u64)",
      "Null",
      this._program.programId
    );
  }

  /**
   * Swaps as few input tokens as possible for an exact amount of output tokens in a single pair.
   * Direction is specified by is_token0_to_token1 (true for token0 -> token1, false for token1 -> token0).
   * Combines high-level swap logic with low-level swap execution for a single-contract setup.
   * # Arguments
   * * `amount_out` - Exact amount of output token desired
   * * `amount_in_max` - Maximum amount of input token willing to pay (slippage protection)
   * * `is_token0_to_token1` - Direction of swap (true: token0 to token1, false: token1 to token0)
   * * `deadline` - Unix timestamp after which the transaction will revert
   */
  public swapTokensForExactTokens(
    amount_out: number | string | bigint,
    amount_in_max: number | string | bigint,
    is_token0_to_token1: boolean,
    deadline: number | string | bigint
  ): TransactionBuilder<null> {
    if (!this._program.programId) throw new Error("Program ID is not set");
    return new TransactionBuilder<null>(
      this._program.api,
      this._program.registry,
      "send_message",
      [
        "Pair",
        "SwapTokensForExactTokens",
        amount_out,
        amount_in_max,
        is_token0_to_token1,
        deadline,
      ],
      "(String, String, U256, U256, bool, u64)",
      "Null",
      this._program.programId
    );
  }

  /**
   * Calculates accumulated swap fees for a specific LP provider.
   *
   * Similar to calculate_lp_fee, but returns the share of LP fees for a user with a given
   * LP token balance (pro-rata based on `user_lp_balance / total_supply`). Returns 0 if no growth.
   */
  public async calculateLpUserFee(
    user: ActorId,
    originAddress?: string,
    value?: number | string | bigint,
    atBlock?: `0x${string}`
  ): Promise<bigint> {
    const payload = this._program.registry
      .createType("(String, String, [u8;32])", [
        "Pair",
        "CalculateLpUserFee",
        user,
      ])
      .toHex();
    const reply = await this._program.api.message.calculateReply({
      destination: this._program.programId,
      origin: originAddress ? decodeAddress(originAddress) : ZERO_ADDRESS,
      payload,
      value: value || 0,
      gasLimit: this._program.api.blockGasLimit.toBigInt(),
      at: atBlock,
    });
    throwOnErrorReply(
      reply.code,
      reply.payload.toU8a(),
      this._program.api.specVersion,
      this._program.registry
    );
    const result = this._program.registry.createType(
      "(String, String, U256)",
      reply.payload
    );
    return result[2].toBigInt() as unknown as bigint;
  }

  /**
   * Calculates protocol fees for the liquidity pool, similar to Uniswap V2, without minting.
   *
   * This function checks if protocol fees are enabled (via `fee_to` address) and calculates
   * the growth in pool reserves due to accumulated swap fees (0.3% per swap, with 1/6 or
   * 0.05% going to the protocol). Returns the amount of new liquidity tokens (LP tokens)
   * that would be minted to the `fee_to` address, proportional to the increase in the square root
   * of the constant product (`reserve0 * reserve1`). If protocol fees are disabled or no growth,
   * returns 0.
   *
   * Can be called for estimation or off-chain calculations. Does not modify state.
   */
  public async calculateProtocolFee(
    originAddress?: string,
    value?: number | string | bigint,
    atBlock?: `0x${string}`
  ): Promise<bigint> {
    const payload = this._program.registry
      .createType("(String, String)", ["Pair", "CalculateProtocolFee"])
      .toHex();
    const reply = await this._program.api.message.calculateReply({
      destination: this._program.programId,
      origin: originAddress ? decodeAddress(originAddress) : ZERO_ADDRESS,
      payload,
      value: value || 0,
      gasLimit: this._program.api.blockGasLimit.toBigInt(),
      at: atBlock,
    });
    throwOnErrorReply(
      reply.code,
      reply.payload.toU8a(),
      this._program.api.specVersion,
      this._program.registry
    );
    const result = this._program.registry.createType(
      "(String, String, U256)",
      reply.payload
    );
    return result[2].toBigInt() as unknown as bigint;
  }

  /**
   * Calculates the amounts of token A and B a user would receive when removing liquidity.
   *
   * This function simulates the removal of liquidity by burning a given amount of LP tokens.
   * It accounts for protocol fees (by simulating mint_fee dilution), calculates pro-rata shares
   * based on reserves (assuming they include swap fees), and sorts amounts by token_a/token_b.
   * Does not modify state or perform any transactions.
   */
  public async calculateRemoveLiquidity(
    liquidity: number | string | bigint,
    originAddress?: string,
    value?: number | string | bigint,
    atBlock?: `0x${string}`
  ): Promise<null> {
    const payload = this._program.registry
      .createType("(String, String, U256)", [
        "Pair",
        "CalculateRemoveLiquidity",
        liquidity,
      ])
      .toHex();
    const reply = await this._program.api.message.calculateReply({
      destination: this._program.programId,
      origin: originAddress ? decodeAddress(originAddress) : ZERO_ADDRESS,
      payload,
      value: value || 0,
      gasLimit: this._program.api.blockGasLimit.toBigInt(),
      at: atBlock,
    });
    throwOnErrorReply(
      reply.code,
      reply.payload.toU8a(),
      this._program.api.specVersion,
      this._program.registry
    );
    const result = this._program.registry.createType(
      "(String, String, Null)",
      reply.payload
    );
    return result[2].toJSON() as unknown as null;
  }

  /**
   * Calculates the required input amount of an asset given a desired output amount and pair reserves.
   * This accounts for a 0.3% fee (997/1000 multiplier).
   * Formula: amount_in = (reserve_in * amount_out * 1000) / (reserve_out - amount_out) * 997) + 1
   * Uses floor division and adds 1 to ensure sufficient input (ceiling effect).
   * # Arguments
   * * `amount_out` - Desired amount of output asset
   * * `is_token0_to_token1` - Direction of swap (true: token0 to token1, false: token1 to token0)
   */
  public async getAmountIn(
    amount_out: number | string | bigint,
    is_token0_to_token1: boolean,
    originAddress?: string,
    value?: number | string | bigint,
    atBlock?: `0x${string}`
  ): Promise<bigint> {
    const payload = this._program.registry
      .createType("(String, String, U256, bool)", [
        "Pair",
        "GetAmountIn",
        amount_out,
        is_token0_to_token1,
      ])
      .toHex();
    const reply = await this._program.api.message.calculateReply({
      destination: this._program.programId,
      origin: originAddress ? decodeAddress(originAddress) : ZERO_ADDRESS,
      payload,
      value: value || 0,
      gasLimit: this._program.api.blockGasLimit.toBigInt(),
      at: atBlock,
    });
    throwOnErrorReply(
      reply.code,
      reply.payload.toU8a(),
      this._program.api.specVersion,
      this._program.registry
    );
    const result = this._program.registry.createType(
      "(String, String, U256)",
      reply.payload
    );
    return result[2].toBigInt() as unknown as bigint;
  }

  /**
   * Calculates the maximum output amount of the other asset given an input amount and pair reserves.
   * This accounts for a 0.3% fee (997/1000 multiplier).
   * Formula: amount_out = (amount_in * 997 * reserve_out) / (reserve_in * 1000 + amount_in * 997)
   * Uses floor division
   * # Arguments
   * * `amount_in` - Amount of input asset being swapped
   * * `is_token0_to_token1` - Direction of swap (true: token0 to token1, false: token1 to token0)
   */
  public async getAmountOut(
    amount_in: number | string | bigint,
    is_token0_to_token1: boolean,
    originAddress?: string,
    value?: number | string | bigint,
    atBlock?: `0x${string}`
  ): Promise<bigint> {
    const payload = this._program.registry
      .createType("(String, String, U256, bool)", [
        "Pair",
        "GetAmountOut",
        amount_in,
        is_token0_to_token1,
      ])
      .toHex();
    const reply = await this._program.api.message.calculateReply({
      destination: this._program.programId,
      origin: originAddress ? decodeAddress(originAddress) : ZERO_ADDRESS,
      payload,
      value: value || 0,
      gasLimit: this._program.api.blockGasLimit.toBigInt(),
      at: atBlock,
    });
    throwOnErrorReply(
      reply.code,
      reply.payload.toU8a(),
      this._program.api.specVersion,
      this._program.registry
    );
    const result = this._program.registry.createType(
      "(String, String, U256)",
      reply.payload
    );
    return result[2].toBigInt() as unknown as bigint;
  }

  public async getReserves(
    originAddress?: string,
    value?: number | string | bigint,
    atBlock?: `0x${string}`
  ): Promise<[number | string | bigint, number | string | bigint]> {
    const payload = this._program.registry
      .createType("(String, String)", ["Pair", "GetReserves"])
      .toHex();
    const reply = await this._program.api.message.calculateReply({
      destination: this._program.programId,
      origin: originAddress ? decodeAddress(originAddress) : ZERO_ADDRESS,
      payload,
      value: value || 0,
      gasLimit: this._program.api.blockGasLimit.toBigInt(),
      at: atBlock,
    });
    throwOnErrorReply(
      reply.code,
      reply.payload.toU8a(),
      this._program.api.specVersion,
      this._program.registry
    );
    const result = this._program.registry.createType(
      "(String, String, (U256, U256))",
      reply.payload
    );
    return result[2].toJSON() as unknown as [
      number | string | bigint,
      number | string | bigint
    ];
  }
}

export class Vft {
  constructor(private _program: Program) {}

  public grantAdminRole(to: ActorId): TransactionBuilder<null> {
    if (!this._program.programId) throw new Error("Program ID is not set");
    return new TransactionBuilder<null>(
      this._program.api,
      this._program.registry,
      "send_message",
      ["Vft", "GrantAdminRole", to],
      "(String, String, [u8;32])",
      "Null",
      this._program.programId
    );
  }

  public grantBurnerRole(to: ActorId): TransactionBuilder<null> {
    if (!this._program.programId) throw new Error("Program ID is not set");
    return new TransactionBuilder<null>(
      this._program.api,
      this._program.registry,
      "send_message",
      ["Vft", "GrantBurnerRole", to],
      "(String, String, [u8;32])",
      "Null",
      this._program.programId
    );
  }

  public grantMinterRole(to: ActorId): TransactionBuilder<null> {
    if (!this._program.programId) throw new Error("Program ID is not set");
    return new TransactionBuilder<null>(
      this._program.api,
      this._program.registry,
      "send_message",
      ["Vft", "GrantMinterRole", to],
      "(String, String, [u8;32])",
      "Null",
      this._program.programId
    );
  }

  public revokeAdminRole(from: ActorId): TransactionBuilder<null> {
    if (!this._program.programId) throw new Error("Program ID is not set");
    return new TransactionBuilder<null>(
      this._program.api,
      this._program.registry,
      "send_message",
      ["Vft", "RevokeAdminRole", from],
      "(String, String, [u8;32])",
      "Null",
      this._program.programId
    );
  }

  public revokeBurnerRole(from: ActorId): TransactionBuilder<null> {
    if (!this._program.programId) throw new Error("Program ID is not set");
    return new TransactionBuilder<null>(
      this._program.api,
      this._program.registry,
      "send_message",
      ["Vft", "RevokeBurnerRole", from],
      "(String, String, [u8;32])",
      "Null",
      this._program.programId
    );
  }

  public revokeMinterRole(from: ActorId): TransactionBuilder<null> {
    if (!this._program.programId) throw new Error("Program ID is not set");
    return new TransactionBuilder<null>(
      this._program.api,
      this._program.registry,
      "send_message",
      ["Vft", "RevokeMinterRole", from],
      "(String, String, [u8;32])",
      "Null",
      this._program.programId
    );
  }

  public approve(
    spender: ActorId,
    value: number | string | bigint
  ): TransactionBuilder<boolean> {
    if (!this._program.programId) throw new Error("Program ID is not set");
    return new TransactionBuilder<boolean>(
      this._program.api,
      this._program.registry,
      "send_message",
      ["Vft", "Approve", spender, value],
      "(String, String, [u8;32], U256)",
      "bool",
      this._program.programId
    );
  }

  public transfer(
    to: ActorId,
    value: number | string | bigint
  ): TransactionBuilder<boolean> {
    if (!this._program.programId) throw new Error("Program ID is not set");
    return new TransactionBuilder<boolean>(
      this._program.api,
      this._program.registry,
      "send_message",
      ["Vft", "Transfer", to, value],
      "(String, String, [u8;32], U256)",
      "bool",
      this._program.programId
    );
  }

  public transferFrom(
    from: ActorId,
    to: ActorId,
    value: number | string | bigint
  ): TransactionBuilder<boolean> {
    if (!this._program.programId) throw new Error("Program ID is not set");
    return new TransactionBuilder<boolean>(
      this._program.api,
      this._program.registry,
      "send_message",
      ["Vft", "TransferFrom", from, to, value],
      "(String, String, [u8;32], [u8;32], U256)",
      "bool",
      this._program.programId
    );
  }

  public async admins(
    originAddress?: string,
    value?: number | string | bigint,
    atBlock?: `0x${string}`
  ): Promise<Array<ActorId>> {
    const payload = this._program.registry
      .createType("(String, String)", ["Vft", "Admins"])
      .toHex();
    const reply = await this._program.api.message.calculateReply({
      destination: this._program.programId,
      origin: originAddress ? decodeAddress(originAddress) : ZERO_ADDRESS,
      payload,
      value: value || 0,
      gasLimit: this._program.api.blockGasLimit.toBigInt(),
      at: atBlock,
    });
    throwOnErrorReply(
      reply.code,
      reply.payload.toU8a(),
      this._program.api.specVersion,
      this._program.registry
    );
    const result = this._program.registry.createType(
      "(String, String, Vec<[u8;32]>)",
      reply.payload
    );
    return result[2].toJSON() as unknown as Array<ActorId>;
  }

  public async burners(
    originAddress?: string,
    value?: number | string | bigint,
    atBlock?: `0x${string}`
  ): Promise<Array<ActorId>> {
    const payload = this._program.registry
      .createType("(String, String)", ["Vft", "Burners"])
      .toHex();
    const reply = await this._program.api.message.calculateReply({
      destination: this._program.programId,
      origin: originAddress ? decodeAddress(originAddress) : ZERO_ADDRESS,
      payload,
      value: value || 0,
      gasLimit: this._program.api.blockGasLimit.toBigInt(),
      at: atBlock,
    });
    throwOnErrorReply(
      reply.code,
      reply.payload.toU8a(),
      this._program.api.specVersion,
      this._program.registry
    );
    const result = this._program.registry.createType(
      "(String, String, Vec<[u8;32]>)",
      reply.payload
    );
    return result[2].toJSON() as unknown as Array<ActorId>;
  }

  public async minters(
    originAddress?: string,
    value?: number | string | bigint,
    atBlock?: `0x${string}`
  ): Promise<Array<ActorId>> {
    const payload = this._program.registry
      .createType("(String, String)", ["Vft", "Minters"])
      .toHex();
    const reply = await this._program.api.message.calculateReply({
      destination: this._program.programId,
      origin: originAddress ? decodeAddress(originAddress) : ZERO_ADDRESS,
      payload,
      value: value || 0,
      gasLimit: this._program.api.blockGasLimit.toBigInt(),
      at: atBlock,
    });
    throwOnErrorReply(
      reply.code,
      reply.payload.toU8a(),
      this._program.api.specVersion,
      this._program.registry
    );
    const result = this._program.registry.createType(
      "(String, String, Vec<[u8;32]>)",
      reply.payload
    );
    return result[2].toJSON() as unknown as Array<ActorId>;
  }

  public async allowance(
    owner: ActorId,
    spender: ActorId,
    originAddress?: string,
    value?: number | string | bigint,
    atBlock?: `0x${string}`
  ): Promise<bigint> {
    const payload = this._program.registry
      .createType("(String, String, [u8;32], [u8;32])", [
        "Vft",
        "Allowance",
        owner,
        spender,
      ])
      .toHex();
    const reply = await this._program.api.message.calculateReply({
      destination: this._program.programId,
      origin: originAddress ? decodeAddress(originAddress) : ZERO_ADDRESS,
      payload,
      value: value || 0,
      gasLimit: this._program.api.blockGasLimit.toBigInt(),
      at: atBlock,
    });
    throwOnErrorReply(
      reply.code,
      reply.payload.toU8a(),
      this._program.api.specVersion,
      this._program.registry
    );
    const result = this._program.registry.createType(
      "(String, String, U256)",
      reply.payload
    );
    return result[2].toBigInt() as unknown as bigint;
  }

  public async balanceOf(
    account: ActorId,
    originAddress?: string,
    value?: number | string | bigint,
    atBlock?: `0x${string}`
  ): Promise<bigint> {
    const payload = this._program.registry
      .createType("(String, String, [u8;32])", ["Vft", "BalanceOf", account])
      .toHex();
    const reply = await this._program.api.message.calculateReply({
      destination: this._program.programId,
      origin: originAddress ? decodeAddress(originAddress) : ZERO_ADDRESS,
      payload,
      value: value || 0,
      gasLimit: this._program.api.blockGasLimit.toBigInt(),
      at: atBlock,
    });
    throwOnErrorReply(
      reply.code,
      reply.payload.toU8a(),
      this._program.api.specVersion,
      this._program.registry
    );
    const result = this._program.registry.createType(
      "(String, String, U256)",
      reply.payload
    );
    return result[2].toBigInt() as unknown as bigint;
  }

  public async decimals(
    originAddress?: string,
    value?: number | string | bigint,
    atBlock?: `0x${string}`
  ): Promise<number> {
    const payload = this._program.registry
      .createType("(String, String)", ["Vft", "Decimals"])
      .toHex();
    const reply = await this._program.api.message.calculateReply({
      destination: this._program.programId,
      origin: originAddress ? decodeAddress(originAddress) : ZERO_ADDRESS,
      payload,
      value: value || 0,
      gasLimit: this._program.api.blockGasLimit.toBigInt(),
      at: atBlock,
    });
    throwOnErrorReply(
      reply.code,
      reply.payload.toU8a(),
      this._program.api.specVersion,
      this._program.registry
    );
    const result = this._program.registry.createType(
      "(String, String, u8)",
      reply.payload
    );
    return result[2].toNumber() as unknown as number;
  }

  public async name(
    originAddress?: string,
    value?: number | string | bigint,
    atBlock?: `0x${string}`
  ): Promise<string> {
    const payload = this._program.registry
      .createType("(String, String)", ["Vft", "Name"])
      .toHex();
    const reply = await this._program.api.message.calculateReply({
      destination: this._program.programId,
      origin: originAddress ? decodeAddress(originAddress) : ZERO_ADDRESS,
      payload,
      value: value || 0,
      gasLimit: this._program.api.blockGasLimit.toBigInt(),
      at: atBlock,
    });
    throwOnErrorReply(
      reply.code,
      reply.payload.toU8a(),
      this._program.api.specVersion,
      this._program.registry
    );
    const result = this._program.registry.createType(
      "(String, String, String)",
      reply.payload
    );
    return result[2].toString() as unknown as string;
  }

  public async symbol(
    originAddress?: string,
    value?: number | string | bigint,
    atBlock?: `0x${string}`
  ): Promise<string> {
    const payload = this._program.registry
      .createType("(String, String)", ["Vft", "Symbol"])
      .toHex();
    const reply = await this._program.api.message.calculateReply({
      destination: this._program.programId,
      origin: originAddress ? decodeAddress(originAddress) : ZERO_ADDRESS,
      payload,
      value: value || 0,
      gasLimit: this._program.api.blockGasLimit.toBigInt(),
      at: atBlock,
    });
    throwOnErrorReply(
      reply.code,
      reply.payload.toU8a(),
      this._program.api.specVersion,
      this._program.registry
    );
    const result = this._program.registry.createType(
      "(String, String, String)",
      reply.payload
    );
    return result[2].toString() as unknown as string;
  }

  public async totalSupply(
    originAddress?: string,
    value?: number | string | bigint,
    atBlock?: `0x${string}`
  ): Promise<bigint> {
    const payload = this._program.registry
      .createType("(String, String)", ["Vft", "TotalSupply"])
      .toHex();
    const reply = await this._program.api.message.calculateReply({
      destination: this._program.programId,
      origin: originAddress ? decodeAddress(originAddress) : ZERO_ADDRESS,
      payload,
      value: value || 0,
      gasLimit: this._program.api.blockGasLimit.toBigInt(),
      at: atBlock,
    });
    throwOnErrorReply(
      reply.code,
      reply.payload.toU8a(),
      this._program.api.specVersion,
      this._program.registry
    );
    const result = this._program.registry.createType(
      "(String, String, U256)",
      reply.payload
    );
    return result[2].toBigInt() as unknown as bigint;
  }

  public subscribeToMintedEvent(
    callback: (data: {
      to: ActorId;
      value: number | string | bigint;
    }) => void | Promise<void>
  ): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent(
      "UserMessageSent",
      ({ data: { message } }) => {
        if (
          !message.source.eq(this._program.programId) ||
          !message.destination.eq(ZERO_ADDRESS)
        ) {
          return;
        }

        const payload = message.payload.toHex();
        if (
          getServiceNamePrefix(payload) === "Vft" &&
          getFnNamePrefix(payload) === "Minted"
        ) {
          callback(
            this._program.registry
              .createType(
                '(String, String, {"to":"[u8;32]","value":"U256"})',
                message.payload
              )[2]
              .toJSON() as unknown as {
              to: ActorId;
              value: number | string | bigint;
            }
          );
        }
      }
    );
  }

  public subscribeToBurnedEvent(
    callback: (data: {
      from: ActorId;
      value: number | string | bigint;
    }) => void | Promise<void>
  ): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent(
      "UserMessageSent",
      ({ data: { message } }) => {
        if (
          !message.source.eq(this._program.programId) ||
          !message.destination.eq(ZERO_ADDRESS)
        ) {
          return;
        }

        const payload = message.payload.toHex();
        if (
          getServiceNamePrefix(payload) === "Vft" &&
          getFnNamePrefix(payload) === "Burned"
        ) {
          callback(
            this._program.registry
              .createType(
                '(String, String, {"from":"[u8;32]","value":"U256"})',
                message.payload
              )[2]
              .toJSON() as unknown as {
              from: ActorId;
              value: number | string | bigint;
            }
          );
        }
      }
    );
  }

  public subscribeToApprovalEvent(
    callback: (data: {
      owner: ActorId;
      spender: ActorId;
      value: number | string | bigint;
    }) => void | Promise<void>
  ): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent(
      "UserMessageSent",
      ({ data: { message } }) => {
        if (
          !message.source.eq(this._program.programId) ||
          !message.destination.eq(ZERO_ADDRESS)
        ) {
          return;
        }

        const payload = message.payload.toHex();
        if (
          getServiceNamePrefix(payload) === "Vft" &&
          getFnNamePrefix(payload) === "Approval"
        ) {
          callback(
            this._program.registry
              .createType(
                '(String, String, {"owner":"[u8;32]","spender":"[u8;32]","value":"U256"})',
                message.payload
              )[2]
              .toJSON() as unknown as {
              owner: ActorId;
              spender: ActorId;
              value: number | string | bigint;
            }
          );
        }
      }
    );
  }

  public subscribeToTransferEvent(
    callback: (data: {
      from: ActorId;
      to: ActorId;
      value: number | string | bigint;
    }) => void | Promise<void>
  ): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent(
      "UserMessageSent",
      ({ data: { message } }) => {
        if (
          !message.source.eq(this._program.programId) ||
          !message.destination.eq(ZERO_ADDRESS)
        ) {
          return;
        }

        const payload = message.payload.toHex();
        if (
          getServiceNamePrefix(payload) === "Vft" &&
          getFnNamePrefix(payload) === "Transfer"
        ) {
          callback(
            this._program.registry
              .createType(
                '(String, String, {"from":"[u8;32]","to":"[u8;32]","value":"U256"})',
                message.payload
              )[2]
              .toJSON() as unknown as {
              from: ActorId;
              to: ActorId;
              value: number | string | bigint;
            }
          );
        }
      }
    );
  }
}
