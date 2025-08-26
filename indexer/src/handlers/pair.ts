import { GearApi } from "@gear-js/api";
import { MoreThanOrEqual } from "typeorm";
import {
  getBlockCommonData,
  isSailsEvent,
  isUserMessageSentEvent,
} from "../helpers";
import {
  Pair,
  Transaction,
  TransactionType,
  Token,
  TokenPriceSnapshot,
} from "../model";
import { ProcessorContext } from "../processor";
import {
  PairProgram,
  VftProgram,
  PriceCalculator,
  TokenManager,
} from "../services";
import { SailsDecoder } from "../sails-decoder";
import { BlockCommonData, UserMessageSentEvent, PairInfo } from "../types";
import { BaseHandler } from "./base";

export class PairHandler extends BaseHandler {
  private _pairDecoder: SailsDecoder;
  private _transactions: Map<string, Transaction>;
  private _tokensToSave: Map<string, Token>;
  private _snapshotsToSave: Map<string, TokenPriceSnapshot>;
  private _pairInfo: PairInfo;
  private _pair: Pair;
  private _isPairUpdated: boolean;
  private _priceCalculator: PriceCalculator;
  private _tokenManager: TokenManager;
  private _api: GearApi;

  constructor(pairInfo: PairInfo) {
    super();
    this._pairInfo = pairInfo;
    this.userMessageSentProgramIds = [pairInfo.address];
    this.events = [];
    this.messageQueuedProgramIds = [];
    this._isPairUpdated = false;
    this._transactions = new Map();
    this._tokensToSave = new Map();
    this._snapshotsToSave = new Map();
  }

  public async init(api: GearApi): Promise<void> {
    this._api = api;
    this._pairDecoder = await SailsDecoder.new("assets/pair.idl");

    const pairProgram = new PairProgram(api, this._pairInfo.address);
    const token0Program = new VftProgram(api, this._pairInfo.tokens[0]);
    const token1Program = new VftProgram(api, this._pairInfo.tokens[1]);

    const token0Symbol = await token0Program.vft.symbol();
    const token1Symbol = await token1Program.vft.symbol();
    const [reserve0, reserve1] = await pairProgram.pair.getReserves();
    const totalSupply = await pairProgram.vft.totalSupply();

    this._isPairUpdated = true;

    this._pair = new Pair({
      id: this._pairInfo.address,
      token0: this._pairInfo.tokens[0],
      token1: this._pairInfo.tokens[1],
      token0Symbol,
      token1Symbol,
      reserve0: BigInt(reserve0),
      reserve1: BigInt(reserve1),
      totalSupply: BigInt(totalSupply),
      volumeUsd: 0,
      volume24h: 0,
      volume7d: 0,
      tvlUsd: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  public async clear(): Promise<void> {
    this._transactions.clear();
    this._tokensToSave.clear();
    this._snapshotsToSave.clear();
  }

  public async save(): Promise<void> {
    // Save pair if updated
    if (this._isPairUpdated) {
      await this._ctx.store.save(this._pair);
      this._isPairUpdated = false;
    }

    // Save tokens
    const tokens = Array.from(this._tokensToSave.values());
    if (tokens.length > 0) {
      this._ctx.log.info({ count: tokens.length }, "Saving tokens");
      await this._ctx.store.save(tokens);
    }

    // Save price snapshots
    const snapshots = Array.from(this._snapshotsToSave.values());
    if (snapshots.length > 0) {
      this._ctx.log.info({ count: snapshots.length }, "Saving price snapshots");
      await this._ctx.store.save(snapshots);
    }

    // Save transactions
    const transactions = Array.from(this._transactions.values());
    if (transactions.length > 0) {
      this._ctx.log.info({ count: transactions.length }, "Saving transactions");
      await this._ctx.store.save(transactions);
    }
  }

  public async process(ctx: ProcessorContext): Promise<void> {
    // Always call super.process(ctx) first
    await super.process(ctx);

    // Initialize services
    this._priceCalculator = new PriceCalculator(ctx);
    this._tokenManager = new TokenManager(ctx, this._api);

    // Ensure tokens exist and prepare them for saving
    const { token: token0, isNew: isToken0New } =
      await this._tokenManager.getOrCreateToken(this._pairInfo.tokens[0]);
    const { token: token1, isNew: isToken1New } =
      await this._tokenManager.getOrCreateToken(this._pairInfo.tokens[1]);

    // Add new tokens to save collection
    if (isToken0New) {
      this._tokensToSave.set(token0.id, token0);
    }
    if (isToken1New) {
      this._tokensToSave.set(token1.id, token1);
    }

    ctx.log.info(`Processing ${ctx.blocks.length} blocks`);

    for (const block of ctx.blocks) {
      const common = getBlockCommonData(block);

      for (const event of block.events) {
        this._ctx.log.info(
          {
            event,
            pairAddress: this._pairInfo.address,
            sorce: event.args.message.source,
            isUserMessageSentEvent: isUserMessageSentEvent(event),
          },
          "Event"
        );

        if (
          isUserMessageSentEvent(event) &&
          event.args.message.source === this._pairInfo.address
        ) {
          await this._handleUserMessageSentEvent(event, common);
        }
      }
    }
  }

  private async _handleUserMessageSentEvent(
    event: UserMessageSentEvent,
    common: BlockCommonData
  ) {
    this._ctx.log.info({ event }, "Just Evemt!!!");
    if (isSailsEvent(event)) {
      this._ctx.log.info({ event }, "SailsEvent!!!");
      const { service, method, payload } = this._pairDecoder.decodeEvent(event);

      this._ctx.log.info(
        { service, method, payload },
        ` UserMessageSentEvent from ${this._pairInfo.address}`
      );

      if (service === "Pair") {
        await this._handlePairService(method, payload, common, event);
      }
    }
  }

  private async _handlePairService(
    method: string,
    payload: any,
    common: BlockCommonData,
    event: UserMessageSentEvent
  ) {
    switch (method) {
      case "LiquidityAdded": {
        const transaction = new Transaction({
          id: event.args.message.id,
          type: TransactionType.ADD_LIQUIDITY,
          // TODO: get from event params
          user: event.args.message.source,
          blockNumber: BigInt(common.blockNumber),
          timestamp: common.blockTimestamp,
          amountA: BigInt(payload.amount_a),
          amountB: BigInt(payload.amount_b),
          liquidity: BigInt(payload.liquidity),
          pair: { id: this._pair.id } as any,
        });

        // Calculate USD values
        await this._calculateTransactionUSDValues(transaction);

        // Update pair reserves (this would come from actual reserve update events)
        this._pair.reserve0 = BigInt(
          payload.new_reserve_0 || this._pair.reserve0
        );
        this._pair.reserve1 = BigInt(
          payload.new_reserve_1 || this._pair.reserve1
        );
        this._pair.updatedAt = common.blockTimestamp;
        this._isPairUpdated = true;

        // Update token prices
        await this._updateTokenPrices(
          common.blockTimestamp,
          BigInt(common.blockNumber)
        );

        // Update pair metrics
        await this._updatePairTVL();

        this._transactions.set(event.args.message.id, transaction);
        this._ctx.log.info({ transaction }, "Processed LiquidityAdded event");
        break;
      }

      case "LiquidityRemoved": {
        const transaction = new Transaction({
          id: event.args.message.id,
          type: TransactionType.REMOVE_LIQUIDITY,
          user: event.args.message.source,
          blockNumber: BigInt(common.blockNumber),
          timestamp: common.blockTimestamp,
          amountA: BigInt(payload.amount_a),
          amountB: BigInt(payload.amount_b),
          liquidity: BigInt(payload.liquidity),
          pair: { id: this._pair.id } as any,
        });

        // Calculate USD values
        await this._calculateTransactionUSDValues(transaction);

        // Update pair reserves
        this._pair.reserve0 = BigInt(
          payload.new_reserve_0 || this._pair.reserve0
        );
        this._pair.reserve1 = BigInt(
          payload.new_reserve_1 || this._pair.reserve1
        );
        this._pair.updatedAt = common.blockTimestamp;
        this._isPairUpdated = true;

        // Update token prices
        await this._updateTokenPrices(
          common.blockTimestamp,
          BigInt(common.blockNumber)
        );

        // Update pair metrics
        await this._updatePairTVL();

        this._transactions.set(event.args.message.id, transaction);
        this._ctx.log.info({ transaction }, "Processed LiquidityRemoved event");
        break;
      }

      case "Swap": {
        const transaction = new Transaction({
          id: event.args.message.id,
          type: TransactionType.SWAP,
          user: event.args.message.source,
          blockNumber: BigInt(common.blockNumber),
          timestamp: common.blockTimestamp,
          amountIn: BigInt(payload.amount_in),
          amountOut: BigInt(payload.amount_out),
          tokenIn: payload.token_in,
          tokenOut: payload.token_out,
          pair: { id: this._pair.id } as any,
        });

        // Calculate USD values
        await this._calculateTransactionUSDValues(transaction);

        // Update pair reserves
        this._pair.reserve0 = BigInt(
          payload.new_reserve_0 || this._pair.reserve0
        );
        this._pair.reserve1 = BigInt(
          payload.new_reserve_1 || this._pair.reserve1
        );
        this._pair.updatedAt = common.blockTimestamp;
        this._isPairUpdated = true;

        // Update token prices
        await this._updateTokenPrices(
          common.blockTimestamp,
          BigInt(common.blockNumber)
        );

        // Update pair metrics
        await this._updatePairTVL();

        // TODO: update on time interval (once per 15 minutes or so)
        await this._updatePairVolumeMetrics();

        this._transactions.set(event.args.message.id, transaction);
        this._ctx.log.info({ transaction }, "Processed Swap event");
        break;
      }

      default:
        this._ctx.log.debug(
          { method, payload },
          "Unhandled pair service method"
        );
    }
  }

  /**
   * Calculate USD values for transaction
   */
  private async _calculateTransactionUSDValues(
    transaction: Transaction
  ): Promise<void> {
    if (transaction.amountA && transaction.amountB) {
      const token0 = await this._ctx.store.get(Token, this._pair.token0);
      const token1 = await this._ctx.store.get(Token, this._pair.token1);

      if (token0?.priceUsd) {
        transaction.amountAUsd = await this._priceCalculator.calculateVolumeUSD(
          this._pair.token0,
          transaction.amountA,
          token0.priceUsd
        );
      }

      if (token1?.priceUsd) {
        transaction.amountBUsd = await this._priceCalculator.calculateVolumeUSD(
          this._pair.token1,
          transaction.amountB,
          token1.priceUsd
        );
      }

      transaction.valueUsd =
        (transaction.amountAUsd || 0) + (transaction.amountBUsd || 0);
    }

    if (transaction.amountIn && transaction.tokenIn) {
      const tokenIn = await this._ctx.store.get(Token, transaction.tokenIn);
      if (tokenIn?.priceUsd) {
        transaction.amountInUsd =
          await this._priceCalculator.calculateVolumeUSD(
            transaction.tokenIn,
            transaction.amountIn,
            tokenIn.priceUsd
          );
      }
    }

    if (transaction.amountOut && transaction.tokenOut) {
      const tokenOut = await this._ctx.store.get(Token, transaction.tokenOut);
      if (tokenOut?.priceUsd) {
        transaction.amountOutUsd =
          await this._priceCalculator.calculateVolumeUSD(
            transaction.tokenOut,
            transaction.amountOut,
            tokenOut.priceUsd
          );
      }
    }

    if (transaction.type === TransactionType.SWAP) {
      // For swaps, only count the input amount to avoid double counting
      transaction.valueUsd = transaction.amountInUsd || 0;
    }
  }

  /**
   * Update token prices for both tokens in the pair
   */
  private async _updateTokenPrices(
    timestamp: Date,
    blockNumber: bigint
  ): Promise<void> {
    // Update token0 metrics
    const token0Metrics = await this._priceCalculator.prepareTokenMetrics(
      this._pair.token0,
      timestamp,
      blockNumber
    );
    if (token0Metrics.token) {
      this._tokensToSave.set(token0Metrics.token.id, token0Metrics.token);
    }
    if (token0Metrics.snapshot) {
      this._snapshotsToSave.set(
        token0Metrics.snapshot.id,
        token0Metrics.snapshot
      );
    }

    // Update token1 metrics
    const token1Metrics = await this._priceCalculator.prepareTokenMetrics(
      this._pair.token1,
      timestamp,
      blockNumber
    );
    if (token1Metrics.token) {
      this._tokensToSave.set(token1Metrics.token.id, token1Metrics.token);
    }
    if (token1Metrics.snapshot) {
      this._snapshotsToSave.set(
        token1Metrics.snapshot.id,
        token1Metrics.snapshot
      );
    }
  }

  /**
   * Update pair-level metrics like TVL and volume
   */
  private async _updatePairTVL(): Promise<void> {
    // Calculate TVL
    this._pair.tvlUsd = await this._priceCalculator.calculatePairTVL(
      this._pair
    );
  }

  /**
   * Update pair volume metrics based on recent transactions
   */
  private async _updatePairVolumeMetrics(): Promise<void> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get transactions for 24h volume
    const transactions24h = await this._ctx.store.find(Transaction, {
      where: {
        pair: { id: this._pair.id },
        timestamp: MoreThanOrEqual(oneDayAgo),
      },
    });

    // Get transactions for 7d volume
    const transactions7d = await this._ctx.store.find(Transaction, {
      where: {
        pair: { id: this._pair.id },
        timestamp: MoreThanOrEqual(sevenDaysAgo),
      },
    });

    // Calculate 24h volume
    this._pair.volume24h = transactions24h.reduce((total, tx) => {
      return total + (tx.valueUsd || 0);
    }, 0);

    // Calculate 7d volume
    this._pair.volume7d = transactions7d.reduce((total, tx) => {
      return total + (tx.valueUsd || 0);
    }, 0);

    // Update total volume (cumulative)
    if (this._pair.volumeUsd === undefined || this._pair.volumeUsd === null) {
      // If volumeUsd is not set, calculate it from all transactions
      const allTransactions = await this._ctx.store.find(Transaction, {
        where: {
          pair: { id: this._pair.id },
        },
      });

      this._pair.volumeUsd = allTransactions.reduce((total, tx) => {
        return total + (tx.valueUsd || 0);
      }, 0);
    } else {
      // Just add the current transaction's value to the total
      const currentTransactionValue = Array.from(
        this._transactions.values()
      ).reduce((total, tx) => total + (tx.valueUsd || 0), 0);
      this._pair.volumeUsd += currentTransactionValue;
    }

    this._ctx.log.info(
      {
        pairId: this._pair.id,
        volume24h: this._pair.volume24h,
        volume7d: this._pair.volume7d,
        volumeUsd: this._pair.volumeUsd,
      },
      "Updated pair volume metrics"
    );
  }
}
