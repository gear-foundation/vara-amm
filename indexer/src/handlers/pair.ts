import { GearApi } from "@gear-js/api";
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
  PriceCalculator,
  TokenManager,
  VolumeCalculator,
  VftProgramCache,
  PriceUtils,
} from "../services";
import { SailsDecoder } from "../sails-decoder";
import { BlockCommonData, UserMessageSentEvent, PairInfo } from "../types";
import { BaseHandler } from "./base";
import {
  PairEventPayload,
  LiquidityEventPayload,
  SwapEventPayload,
} from "../services/sails";

export class PairHandler extends BaseHandler {
  private _pairDecoder: SailsDecoder;
  private _transactions: Map<string, Transaction>;
  private _snapshotsToSave: Map<string, TokenPriceSnapshot>;
  private _pairInfo: PairInfo;
  private _pair: Pair;
  private _isPairUpdated: boolean;
  private _priceCalculator: PriceCalculator;
  private _tokenManager: TokenManager;
  private _volumeCalculator: VolumeCalculator;
  private _vftCache: VftProgramCache;
  private _pairProgram: PairProgram;
  private _tokens: Map<string, Token>;
  private _isTokensUpdated: boolean;
  private _api: GearApi;

  constructor(pairInfo: PairInfo) {
    super();
    this._pairInfo = pairInfo;
    this.userMessageSentProgramIds = [pairInfo.address];
    this.events = [];
    this.messageQueuedProgramIds = [];
    this._isPairUpdated = false;
    this._transactions = new Map();
    this._tokens = new Map();
    this._isTokensUpdated = false;
    this._snapshotsToSave = new Map();
  }

  public async init(api: GearApi): Promise<void> {
    this._api = api;
    this._vftCache = new VftProgramCache(api);
    this._pairProgram = new PairProgram(api, this._pairInfo.address);
    this._pairDecoder = await SailsDecoder.new("assets/pair.idl");
  }

  public async clear(): Promise<void> {
    this._transactions.clear();
    this._snapshotsToSave.clear();
    this._isPairUpdated = false;
    this._isTokensUpdated = false;

    // Clear volume calculator buffers
    if (this._volumeCalculator) {
      this._volumeCalculator.clearBuffers();
    }
  }

  public async save(): Promise<void> {
    // Flush volume buffers before saving
    if (this._volumeCalculator) {
      await this._volumeCalculator.saveSnapshots();
    }

    // Save pair if updated
    if (this._isPairUpdated) {
      await this._ctx.store.save(this._pair);
    }

    // Save tokens
    if (this._isTokensUpdated) {
      const tokens = Array.from(this._tokens.values());
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

    // Check if pair already exists in database and load existing data
    await this._checkAndLoadExistingPair(ctx);

    // Initialize services
    this._priceCalculator = new PriceCalculator(ctx);
    this._tokenManager = new TokenManager(ctx, this._vftCache);
    this._volumeCalculator = new VolumeCalculator(ctx);

    await this._initTokens();

    ctx.log.info(`Processing ${ctx.blocks.length} blocks`);

    for (const block of ctx.blocks) {
      const common = getBlockCommonData(block);

      for (const event of block.events) {
        if (
          isUserMessageSentEvent(event) &&
          event.args.message.source === this._pairInfo.address
        ) {
          await this._handleUserMessageSentEvent(event, common);
        }
      }
    }
  }

  private async _checkAndLoadExistingPair(
    ctx: ProcessorContext
  ): Promise<void> {
    // If pair is already loaded/cached, no need to query database
    if (this._pair) {
      return;
    }

    // Query database only during initialization when pair is not yet cached
    const existingPair = await ctx.store.get(Pair, this._pairInfo.address);

    if (existingPair) {
      ctx.log.info(
        {
          pairId: this._pairInfo.address,
          symbols: `${existingPair.token0Symbol} / ${existingPair.token1Symbol}`,
          existingVolumeUsd: existingPair.volumeUsd,
          existingTvlUsd: existingPair.tvlUsd,
          existingVolume24h: existingPair.volume24h,
        },
        "Found existing pair in database, preserving accumulated metrics"
      );

      this._pair = existingPair;

      this._isPairUpdated = true;
    } else {
      ctx.log.info(
        { pairId: this._pairInfo.address },
        "Creating new pair entry in database"
      );

      const token0Program = this._vftCache.getOrCreate(
        this._pairInfo.tokens[0]
      );
      const token1Program = this._vftCache.getOrCreate(
        this._pairInfo.tokens[1]
      );

      const token0Symbol = await token0Program.vft.symbol();
      const token1Symbol = await token1Program.vft.symbol();
      const [reserve0, reserve1] = await this._pairProgram.pair.getReserves();
      const totalSupply = await this._pairProgram.vft.totalSupply();

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
        volume30d: 0,
        volume1y: 0,
        tvlUsd: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      this._isPairUpdated = true;
    }
  }

  private async _initTokens(): Promise<void> {
    if (this._tokens.size === 0) {
      // Ensure tokens exist and prepare them for saving
      const { token: token0, isNew: isToken0New } =
        await this._tokenManager.getOrCreateToken(this._pairInfo.tokens[0]);
      const { token: token1, isNew: isToken1New } =
        await this._tokenManager.getOrCreateToken(this._pairInfo.tokens[1]);

      // Add new tokens to save collection
      if (isToken0New) {
        this._tokens.set(token0.id, token0);
        this._isTokensUpdated = true;
      }
      if (isToken1New) {
        this._tokens.set(token1.id, token1);
        this._isTokensUpdated = true;
      }
    }
  }

  private async _handleUserMessageSentEvent(
    event: UserMessageSentEvent,
    common: BlockCommonData
  ) {
    if (isSailsEvent(event)) {
      const { service, method, payload } = this._pairDecoder.decodeEvent(event);

      this._ctx.log.info(
        { service, method, payload },
        `UserMessageSentEvent from ${this._pairInfo.address}`
      );

      if (service === "Pair") {
        await this._handlePairService(
          method,
          payload as PairEventPayload,
          common,
          event
        );
      }
    }
  }

  private async _handlePairService(
    method: string,
    payload: PairEventPayload,
    common: BlockCommonData,
    event: UserMessageSentEvent
  ) {
    switch (method) {
      case "LiquidityAdded": {
        const liquidityPayload = payload as LiquidityEventPayload;
        const transaction = this._createTransaction(
          event,
          common,
          TransactionType.ADD_LIQUIDITY,
          {
            amountA: BigInt(liquidityPayload.amount_a),
            amountB: BigInt(liquidityPayload.amount_b),
            liquidity: BigInt(liquidityPayload.liquidity),
          }
        );

        await this._processTransaction(transaction, liquidityPayload, common);
        this._ctx.log.info({ transaction }, "Processed LiquidityAdded event");
        break;
      }

      case "LiquidityRemoved": {
        const liquidityPayload = payload as LiquidityEventPayload;
        const transaction = this._createTransaction(
          event,
          common,
          TransactionType.REMOVE_LIQUIDITY,
          {
            amountA: BigInt(liquidityPayload.amount_a),
            amountB: BigInt(liquidityPayload.amount_b),
            liquidity: BigInt(liquidityPayload.liquidity),
          }
        );

        await this._processTransaction(transaction, liquidityPayload, common);
        this._ctx.log.info({ transaction }, "Processed LiquidityRemoved event");
        break;
      }

      case "Swap": {
        const swapPayload = payload as SwapEventPayload;

        // ! TODO: Update when new Swap event structure is implemented
        // For now, Swap event doesn't contain data, so we create a minimal transaction
        if (
          swapPayload.amount_in &&
          swapPayload.amount_out &&
          swapPayload.token_in &&
          swapPayload.token_out
        ) {
          // Future implementation when swap data is available
          const transaction = this._createTransaction(
            event,
            common,
            TransactionType.SWAP,
            {
              amountIn: BigInt(swapPayload.amount_in),
              amountOut: BigInt(swapPayload.amount_out),
              tokenIn: swapPayload.token_in,
              tokenOut: swapPayload.token_out,
            }
          );
          await this._processTransaction(
            transaction,
            swapPayload,
            common,
            true
          );
          this._ctx.log.info({ transaction }, "Processed Swap event with data");
        } else {
          // ! TODO: remove this once new Swap event structure is implemented
          // Current implementation - Swap event without data
          const transaction = this._createTransaction(
            event,
            common,
            TransactionType.SWAP,
            {
              // We'll need to get swap details from transaction input or query reserves
            }
          );
          await this._processTransaction(
            transaction,
            swapPayload,
            common,
            true
          );
          this._ctx.log.info(
            { transaction },
            "Processed Swap event (no data in event)"
          );
        }
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
   * Create a transaction object with common fields
   */
  private _createTransaction(
    event: UserMessageSentEvent,
    common: BlockCommonData,
    type: TransactionType,
    additionalFields: Partial<Transaction> = {}
  ): Transaction {
    return new Transaction({
      id: event.args.message.id,
      type,
      user: event.args.message.source,
      blockNumber: BigInt(common.blockNumber),
      timestamp: common.blockTimestamp,
      pair: { id: this._pair.id } as Pair,
      ...additionalFields,
    });
  }

  /**
   * Process transaction with common operations
   */
  private async _processTransaction(
    transaction: Transaction,
    payload: PairEventPayload,
    common: BlockCommonData,
    isSwap: boolean = false
  ): Promise<void> {
    // Calculate USD values
    await this._calculateTransactionUSDValues(transaction);

    // Update pair reserves
    await this._updatePairReserves(payload, common);

    // Update token prices and pair metrics
    await this._updateTokenPrices(
      common.blockTimestamp,
      BigInt(common.blockNumber)
    );
    await this._updatePairTVL();

    // Update volume metrics for swaps
    if (isSwap) {
      await this._updatePairVolumeMetrics();
    }

    // Store transaction
    this._transactions.set(transaction.id, transaction);
  }

  /**
   * Update pair reserves by querying current on-chain state
   */
  private async _updatePairReserves(
    payload: PairEventPayload,
    common: BlockCommonData
  ): Promise<void> {
    try {
      // Get current reserves from blockchain state via query
      const pairProgram = new PairProgram(this._api, this._pairInfo.address);

      const [reserve0, reserve1] = await pairProgram.pair.getReserves();

      // Update reserves with current on-chain values
      this._pair.reserve0 = BigInt(reserve0);
      this._pair.reserve1 = BigInt(reserve1);

      this._ctx.log.debug(
        {
          pairId: this._pairInfo.address,
          reserve0: this._pair.reserve0.toString(),
          reserve1: this._pair.reserve1.toString(),
        },
        "Updated pair reserves from on-chain query"
      );
    } catch (error) {
      this._ctx.log.error(
        { error, pairId: this._pairInfo.address },
        "Failed to query current reserves, keeping previous values"
      );
    }

    // Always update timestamp and mark as updated
    this._pair.updatedAt = common.blockTimestamp;
    this._isPairUpdated = true;
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
        transaction.amountAUsd = PriceUtils.calculateUSDValue(
          transaction.amountA,
          token0.decimals,
          token0.priceUsd
        );
      }

      if (token1?.priceUsd) {
        transaction.amountBUsd = PriceUtils.calculateUSDValue(
          transaction.amountB,
          token1.decimals,
          token1.priceUsd
        );
      }

      transaction.valueUsd =
        (transaction.amountAUsd || 0) + (transaction.amountBUsd || 0);
    }

    if (transaction.amountIn && transaction.tokenIn) {
      const tokenIn = await this._ctx.store.get(Token, transaction.tokenIn);
      if (tokenIn?.priceUsd) {
        transaction.amountInUsd = PriceUtils.calculateUSDValue(
          transaction.amountIn,
          tokenIn.decimals,
          tokenIn.priceUsd
        );
      }
    }

    if (transaction.amountOut && transaction.tokenOut) {
      const tokenOut = await this._ctx.store.get(Token, transaction.tokenOut);
      if (tokenOut?.priceUsd) {
        transaction.amountOutUsd = PriceUtils.calculateUSDValue(
          transaction.amountOut,
          tokenOut.decimals,
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
      this._tokens.get(this._pair.token0),
      timestamp,
      blockNumber
    );
    if (token0Metrics.token) {
      this._tokens.set(token0Metrics.token.id, token0Metrics.token);
    }
    if (token0Metrics.snapshot) {
      this._snapshotsToSave.set(
        token0Metrics.snapshot.id,
        token0Metrics.snapshot
      );
    }

    // Update token1 metrics
    const token1Metrics = await this._priceCalculator.prepareTokenMetrics(
      this._tokens.get(this._pair.token1),
      timestamp,
      blockNumber
    );
    if (token1Metrics.token) {
      this._tokens.set(token1Metrics.token.id, token1Metrics.token);
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

  private async _updatePairVolumeMetrics(): Promise<void> {
    // Get volume ONLY from swaps (trading volume)
    const newTradingVolume = Array.from(this._transactions.values())
      .filter((tx) => tx.type === TransactionType.SWAP)
      .reduce((sum, tx) => sum + (tx.valueUsd || 0), 0);

    if (newTradingVolume > 0) {
      const volumes = await this._volumeCalculator.updatePairVolumes(
        this._pair.id,
        newTradingVolume,
        new Date()
      );

      // Update pair fields
      this._pair.volume1h = volumes.volume1h;
      this._pair.volume24h = volumes.volume24h;
      this._pair.volume7d = volumes.volume7d;
      this._pair.volume30d = volumes.volume30d;
      this._pair.volume1y = volumes.volume1y;

      // Update total volume incrementally
      this._pair.volumeUsd = (this._pair.volumeUsd || 0) + newTradingVolume;

      this._ctx.log.info(
        {
          pairId: this._pair.id,
          newTradingVolume,
          volume1h: this._pair.volume1h,
          volume24h: this._pair.volume24h,
          volume7d: this._pair.volume7d,
          volume30d: this._pair.volume30d,
          volume1y: this._pair.volume1y,
          totalVolumeUsd: this._pair.volumeUsd,
        },
        "Updated pair trading volume efficiently"
      );
    }
  }
}
