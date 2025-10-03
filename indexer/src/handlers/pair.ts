import { GearApi, HexString } from "@gear-js/api";
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
  PairVolumeSnapshot,
  VolumeInterval,
} from "../model";
import { ProcessorContext } from "../processor";
import {
  PairProgram,
  PriceCalculator,
  TokenManager,
  VolumeCalculator,
  VftProgramCache,
  PriceUtils,
  TimeUtils,
} from "../services";
import { SailsDecoder } from "../sails-decoder";
import {
  BlockCommonData,
  UserMessageSentEvent,
  PairInfo,
  VolumePeriods,
} from "../types";
import { MoreThanOrEqual } from "typeorm";
import { BaseHandler } from "./base";
import {
  PairEventPayload,
  LiquidityEventPayload,
  SwapEventPayload,
} from "../services/sails";

interface PairState {
  info: PairInfo;
  pair: Pair | null;
  pairProgram: PairProgram;
  transactions: Map<string, Transaction>;
  volumeSnapshots: Map<string, PairVolumeSnapshot>;
  isPairUpdated: boolean;
  isVolumeSnapshotsUpdated: boolean;
  lastPriceAndVolumeUpdate: Date | null;
}

export class PairsHandler extends BaseHandler {
  private _pairDecoder: SailsDecoder;
  private _pairs: Map<string, PairState>;
  private _priceCalculator: PriceCalculator;
  private _tokenManager: TokenManager;
  private _vftCache: VftProgramCache;
  private _tokens: Map<string, Token>;
  private _tokenPrices: Map<string, number>;
  private _tokensToSave: Set<string>;
  private _priceSnapshots: Map<string, TokenPriceSnapshot>;
  private _api: GearApi;
  private _existingPairsLoaded: boolean;

  constructor() {
    super();
    this._pairs = new Map();
    this._tokens = new Map();
    this._tokenPrices = new Map();
    this._tokensToSave = new Set();
    this._priceSnapshots = new Map();
    this._existingPairsLoaded = false;
    this.userMessageSentProgramIds = [];
    this.events = [];
    this.messageQueuedProgramIds = [];
  }

  public async init(api: GearApi): Promise<void> {
    this._api = api;
    this._vftCache = new VftProgramCache(api);
    this._pairDecoder = await SailsDecoder.new("assets/pair.idl");
  }

  public async loadExistingPairs(ctx: ProcessorContext): Promise<void> {
    const existingPairs = await ctx.store.find(Pair);

    ctx.log.info(
      { count: existingPairs.length },
      "Loading existing pairs from database"
    );

    for (const pair of existingPairs) {
      ctx.log.info({ pair }, "Registering existing pair");

      const info: PairInfo = {
        address: pair.id as HexString,
        tokens: [pair.token0 as HexString, pair.token1 as HexString],
      };

      const state = this._getOrCreateState(info);
      state.pair = pair;
    }

    ctx.log.info(
      { totalPairs: existingPairs.length },
      "Successfully loaded existing pairs into memory"
    );
  }

  public registerPair(pairInfo: PairInfo): void {
    this._getOrCreateState(pairInfo);
  }

  public getPairsToSave(): Pair[] {
    const pairsToSave: Pair[] = [];
    for (const state of this._pairs.values()) {
      if (state.isPairUpdated && state.pair) {
        pairsToSave.push(state.pair);
      }
    }

    return pairsToSave;
  }

  public async clear(): Promise<void> {
    this._priceSnapshots.clear();
    this._tokensToSave.clear();

    for (const state of this._pairs.values()) {
      state.transactions.clear();
      state.isPairUpdated = false;
      state.isVolumeSnapshotsUpdated = false;
    }
  }

  public async save(): Promise<void> {
    for (const state of this._pairs.values()) {
      if (state.isVolumeSnapshotsUpdated) {
        const volumeSnapshots = Array.from(state.volumeSnapshots.values());
        if (volumeSnapshots.length > 0) {
          this._ctx.log.info(
            { count: volumeSnapshots.length },
            "Saving volume snapshots"
          );
          await this._ctx.store.save(volumeSnapshots);
        }
      }

      const transactions = Array.from(state.transactions.values());
      if (transactions.length > 0) {
        this._ctx.log.info(
          { count: transactions.length },
          "Saving transactions"
        );
        await this._ctx.store.save(transactions);
      }
    }

    if (this._tokensToSave.size > 0) {
      const tokens = Array.from(this._tokensToSave)
        .map((tokenId) => this._tokens.get(tokenId))
        .filter((token): token is Token => token !== undefined);

      if (tokens.length > 0) {
        this._ctx.log.info({ count: tokens.length }, "Saving tokens");
        await this._ctx.store.save(tokens);
      }
    }

    if (this._priceSnapshots.size > 0) {
      const priceSnapshots = Array.from(this._priceSnapshots.values());
      this._ctx.log.info(
        { count: priceSnapshots.length },
        "Saving price snapshots"
      );
      await this._ctx.store.save(priceSnapshots);
    }
  }

  public async process(ctx: ProcessorContext): Promise<void> {
    await super.process(ctx);

    // Load existing pairs from database on first run
    if (!this._existingPairsLoaded) {
      await this.loadExistingPairs(ctx);
      this._existingPairsLoaded = true;
    }

    if (!this._pairs.size) {
      return;
    }

    // Recreate per batch to avoid holding a stale ctx across mapping runs
    this._priceCalculator = new PriceCalculator(ctx);
    this._tokenManager = new TokenManager(ctx, this._vftCache);

    const firstBlock = ctx.blocks[0];
    const firstCommon = getBlockCommonData(firstBlock);

    for (const state of this._pairs.values()) {
      await this._ensurePair(state);
      await this._initTokens(state);
      await this._initSnapshots(state, firstCommon.blockTimestamp);
    }

    for (const block of ctx.blocks) {
      const common = getBlockCommonData(block);
      const { blockTimestamp, blockNumber } = common;

      for (const state of this._pairs.values()) {
        if (
          state.pair &&
          this._shouldPerformHourlyUpdates(state, blockTimestamp)
        ) {
          await this._performHourlyUpdates(
            state,
            blockTimestamp,
            BigInt(blockNumber)
          );
        }
      }

      for (const event of block.events) {
        if (isUserMessageSentEvent(event)) {
          const source = event.args.message.source;
          const state = this._pairs.get(source);

          if (state) {
            await this._handleUserMessageSentEvent(state, event, common);
          }
        }
      }
    }

    for (const state of this._pairs.values()) {
      if (state.isVolumeSnapshotsUpdated && state.pair) {
        const lastBlock = ctx.blocks[ctx.blocks.length - 1];
        const { blockTimestamp } = getBlockCommonData(lastBlock);
        await this._updatePairVolumes(state, blockTimestamp);
        VolumeCalculator.clearOldSnapshots(
          state.volumeSnapshots,
          blockTimestamp
        );
      }

      if (state.pair) {
        this._updatePairTVL(state);
      }
    }
  }

  private _getOrCreateState(info: PairInfo): PairState {
    let state = this._pairs.get(info.address);

    if (!state) {
      state = {
        info,
        pair: null,
        pairProgram: new PairProgram(this._api, info.address),
        transactions: new Map(),
        volumeSnapshots: new Map(),
        isPairUpdated: false,
        isVolumeSnapshotsUpdated: false,
        lastPriceAndVolumeUpdate: null,
      };
      this._pairs.set(info.address, state);
    }

    return state;
  }

  private async _ensurePair(state: PairState): Promise<void> {
    if (state.pair) {
      return;
    }

    const token0Program = this._vftCache.getOrCreate(state.info.tokens[0]);
    const token1Program = this._vftCache.getOrCreate(state.info.tokens[1]);

    const token0Symbol = await token0Program.vft.symbol();
    const token1Symbol = await token1Program.vft.symbol();
    const [reserve0, reserve1] = await state.pairProgram.pair.getReserves();
    const totalSupply = await state.pairProgram.vft.totalSupply();

    const pair = new Pair({
      id: state.info.address,
      token0: state.info.tokens[0],
      token1: state.info.tokens[1],
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

    this._ctx.log.info({ pair }, "Created new pair");

    state.pair = pair;
    state.isPairUpdated = true;
  }

  private async _initTokens(state: PairState): Promise<void> {
    const pair = state.pair;
    if (!pair) {
      return;
    }

    const ensureToken = async (tokenId: string) => {
      const token = this._tokens.get(tokenId);

      if (!token) {
        const token = await this._tokenManager.createTokenFromContract(tokenId);
        this._tokens.set(token.id, token);
        this._tokensToSave.add(token.id);
      }

      if (token && !this._tokenPrices.has(tokenId)) {
        await this._initTokenPrices(token);
      }
    };

    await Promise.all([ensureToken(pair.token0), ensureToken(pair.token1)]);
  }

  private async _initTokenPrices(token: Token): Promise<void> {
    const latestSnapshot = await this._ctx.store.findOne(TokenPriceSnapshot, {
      where: {
        token: { id: token.id },
      },
      order: { timestamp: "DESC" },
    });

    if (latestSnapshot) {
      this._tokenPrices.set(token.id, latestSnapshot.priceUsd);
      this._ctx.log.debug(
        {
          tokenId: token.id,
          price: latestSnapshot.priceUsd,
          timestamp: latestSnapshot.timestamp,
        },
        "Initialized token price from latest snapshot"
      );
    } else if (PriceUtils.isStablecoin(token.symbol)) {
      this._tokenPrices.set(token.id, 1);
    }
  }

  private async _handleUserMessageSentEvent(
    state: PairState,
    event: UserMessageSentEvent,
    common: BlockCommonData
  ) {
    if (!isSailsEvent(event)) {
      return;
    }

    const { service, method, payload } = this._pairDecoder.decodeEvent(event);

    this._ctx.log.info(
      { service, method, payload },
      `UserMessageSentEvent from ${state.info.address}`
    );

    if (service === "Pair") {
      await this._handlePairService(
        state,
        method,
        payload as PairEventPayload,
        common,
        event
      );
    }
  }

  private async _handlePairService(
    state: PairState,
    method: string,
    payload: PairEventPayload,
    common: BlockCommonData,
    event: UserMessageSentEvent
  ) {
    switch (method) {
      case "LiquidityAdded": {
        const liquidityPayload = payload as LiquidityEventPayload;
        const transaction = this._createTransaction(
          state,
          event,
          common,
          TransactionType.ADD_LIQUIDITY,
          {
            user: liquidityPayload.user_id,
            amountA: BigInt(liquidityPayload.amount_a),
            amountB: BigInt(liquidityPayload.amount_b),
            liquidity: BigInt(liquidityPayload.liquidity),
          }
        );

        await this._processTransaction(
          state,
          transaction,
          liquidityPayload,
          common
        );
        this._ctx.log.info({ transaction }, "Processed LiquidityAdded event");
        break;
      }

      case "LiquidityRemoved": {
        const liquidityPayload = payload as LiquidityEventPayload;
        const transaction = this._createTransaction(
          state,
          event,
          common,
          TransactionType.REMOVE_LIQUIDITY,
          {
            user: liquidityPayload.user_id,
            amountA: BigInt(liquidityPayload.amount_a),
            amountB: BigInt(liquidityPayload.amount_b),
            liquidity: BigInt(liquidityPayload.liquidity),
          }
        );

        await this._processTransaction(
          state,
          transaction,
          liquidityPayload,
          common
        );
        this._ctx.log.info({ transaction }, "Processed LiquidityRemoved event");
        break;
      }

      case "Swap": {
        const swapPayload = payload as SwapEventPayload;
        const transaction = this._createTransaction(
          state,
          event,
          common,
          TransactionType.SWAP,
          {
            user: swapPayload.user_id,
            amountIn: BigInt(swapPayload.amount_in),
            amountOut: BigInt(swapPayload.amount_out),
            tokenIn: swapPayload.is_token0_to_token1
              ? state.pair?.token0
              : state.pair?.token1,
            tokenOut: swapPayload.is_token0_to_token1
              ? state.pair?.token1
              : state.pair?.token0,
          }
        );

        await this._processTransaction(state, transaction, swapPayload, common);
        this._ctx.log.info({ transaction }, "Processed Swap event with data");
        break;
      }

      default:
        this._ctx.log.debug(
          { method, payload },
          "Unhandled pair service method"
        );
    }
  }

  private _createTransaction(
    state: PairState,
    event: UserMessageSentEvent,
    common: BlockCommonData,
    type: TransactionType,
    additionalFields: Partial<Transaction> = {}
  ): Transaction {
    if (!state.pair) {
      throw new Error("Pair is not initialized for transaction creation");
    }

    return new Transaction({
      id: event.args.message.id,
      type,
      blockNumber: BigInt(common.blockNumber),
      timestamp: common.blockTimestamp,
      pair: { id: state.pair.id } as Pair,
      ...additionalFields,
    });
  }

  private async _processTransaction(
    state: PairState,
    transaction: Transaction,
    payload: PairEventPayload,
    common: BlockCommonData
  ): Promise<void> {
    await this._calculateTransactionUSDValues(transaction);
    await this._updatePairReserves(state, payload, common);

    if (
      transaction.type === TransactionType.SWAP ||
      transaction.type === TransactionType.ADD_LIQUIDITY
    ) {
      await this._updateTokenPrices(
        state,
        common.blockTimestamp,
        BigInt(common.blockNumber)
      );
      state.lastPriceAndVolumeUpdate = common.blockTimestamp;
    }
    if (transaction.type === TransactionType.SWAP) {
      this._updatePairVolumeMetrics(state, transaction);
      state.isVolumeSnapshotsUpdated = true;
    }

    state.transactions.set(transaction.id, transaction);
    state.isPairUpdated = true;
  }

  private async _updatePairReserves(
    state: PairState,
    _payload: PairEventPayload,
    common: BlockCommonData
  ): Promise<void> {
    if (!state.pair) {
      return;
    }

    try {
      const [reserve0, reserve1] = await state.pairProgram.pair.getReserves();
      const totalSupply = await state.pairProgram.vft.totalSupply();

      state.pair.reserve0 = BigInt(reserve0);
      state.pair.reserve1 = BigInt(reserve1);
      state.pair.totalSupply = BigInt(totalSupply);

      this._ctx.log.debug(
        {
          pairId: state.info.address,
          reserve0: state.pair.reserve0.toString(),
          reserve1: state.pair.reserve1.toString(),
          totalSupply: state.pair.totalSupply.toString(),
        },
        "Updated pair reserves and totalSupply from on-chain query"
      );
    } catch (error) {
      this._ctx.log.error(
        { error, pairId: state.info.address },
        "Failed to query current reserves and totalSupply, keeping previous values"
      );
    }

    state.pair.updatedAt = common.blockTimestamp;
  }

  private async _calculateTransactionUSDValues(
    transaction: Transaction
  ): Promise<void> {
    if (transaction.amountA && transaction.amountB && transaction.pair?.id) {
      const pair = this._pairs.get(transaction.pair.id)?.pair;
      if (pair) {
        const token0 = this._tokens.get(pair.token0);
        const token1 = this._tokens.get(pair.token1);
        const token0Price = this._tokenPrices.get(pair.token0);
        const token1Price = this._tokenPrices.get(pair.token1);

        if (token0 && token0Price) {
          transaction.amountAUsd = PriceUtils.calculateUSDValue(
            transaction.amountA,
            token0.decimals,
            token0Price
          );
        }

        if (token1 && token1Price) {
          transaction.amountBUsd = PriceUtils.calculateUSDValue(
            transaction.amountB,
            token1.decimals,
            token1Price
          );
        }

        transaction.valueUsd =
          (transaction.amountAUsd || 0) + (transaction.amountBUsd || 0);
      }
    }

    if (transaction.amountIn && transaction.tokenIn) {
      const tokenIn = this._tokens.get(transaction.tokenIn);
      const tokenInPrice = this._tokenPrices.get(transaction.tokenIn);
      if (tokenIn && tokenInPrice) {
        transaction.amountInUsd = PriceUtils.calculateUSDValue(
          transaction.amountIn,
          tokenIn.decimals,
          tokenInPrice
        );
      }
    }

    if (transaction.amountOut && transaction.tokenOut) {
      const tokenOut = this._tokens.get(transaction.tokenOut);
      const tokenOutPrice = this._tokenPrices.get(transaction.tokenOut);
      if (tokenOut && tokenOutPrice) {
        transaction.amountOutUsd = PriceUtils.calculateUSDValue(
          transaction.amountOut,
          tokenOut.decimals,
          tokenOutPrice
        );
      }
    }

    if (transaction.type === TransactionType.SWAP) {
      transaction.valueUsd = transaction.amountInUsd || 0;
    }
  }

  private async _updateTokenPrices(
    state: PairState,
    timestamp: Date,
    blockNumber: bigint
  ): Promise<void> {
    if (!state.pair) {
      return;
    }

    const token0 = this._tokens.get(state.pair.token0);
    if (token0) {
      const token0Snapshot =
        await this._priceCalculator.prepareTokenPriceSnapshot(
          token0,
          timestamp,
          blockNumber,
          this._getPairsForToken(token0.id),
          this._tokens
        );

      if (token0Snapshot.snapshot) {
        this._tokenPrices.set(
          state.pair.token0,
          token0Snapshot.snapshot.priceUsd
        );
        this._priceSnapshots.set(
          token0Snapshot.snapshot.id,
          token0Snapshot.snapshot
        );
      }
    }

    const token1 = this._tokens.get(state.pair.token1);
    if (token1) {
      const token1Snapshot =
        await this._priceCalculator.prepareTokenPriceSnapshot(
          token1,
          timestamp,
          blockNumber,
          this._getPairsForToken(token1.id),
          this._tokens
        );

      if (token1Snapshot.snapshot) {
        this._tokenPrices.set(
          state.pair.token1,
          token1Snapshot.snapshot.priceUsd
        );
        this._priceSnapshots.set(
          token1Snapshot.snapshot.id,
          token1Snapshot.snapshot
        );
      }
    }
  }

  private _getPairsForToken(tokenId: string): Pair[] {
    const pairs: Pair[] = [];
    for (const state of this._pairs.values()) {
      if (!state.pair) continue;
      if (state.pair.token0 === tokenId || state.pair.token1 === tokenId) {
        pairs.push(state.pair);
      }
    }
    return pairs;
  }

  private _updatePairTVL(state: PairState): void {
    if (!state.pair) {
      return;
    }

    const token0 = this._tokens.get(state.pair.token0);
    const token1 = this._tokens.get(state.pair.token1);
    const token0Price = this._tokenPrices.get(state.pair.token0);
    const token1Price = this._tokenPrices.get(state.pair.token1);

    state.pair.tvlUsd = this._priceCalculator.calculatePairTVL(
      state.pair,
      token0,
      token1,
      token0Price,
      token1Price
    );
  }

  private _updatePairVolumeMetrics(
    state: PairState,
    transaction: Transaction
  ): void {
    if (!state.pair) {
      return;
    }

    const newTradingVolume = transaction.valueUsd;
    if (newTradingVolume > 0) {
      const timestamp = transaction.timestamp;

      const hourlySnapshot = VolumeCalculator.createOrUpdateHourlySnapshot(
        state.volumeSnapshots,
        state.pair.id,
        newTradingVolume,
        timestamp
      );

      state.volumeSnapshots.set(hourlySnapshot.id, hourlySnapshot);
      state.pair.volumeUsd = (state.pair.volumeUsd || 0) + newTradingVolume;
    }
  }

  private _shouldPerformHourlyUpdates(
    state: PairState,
    currentTime: Date
  ): boolean {
    const oneHourMs = 60 * 60 * 1000;
    return (
      !state.lastPriceAndVolumeUpdate ||
      currentTime.getTime() - state.lastPriceAndVolumeUpdate.getTime() >=
        oneHourMs
    );
  }

  private async _performHourlyUpdates(
    state: PairState,
    timestamp: Date,
    blockNumber: bigint
  ): Promise<void> {
    await this._updateTokenPrices(state, timestamp, blockNumber);

    if (!state.pair) {
      return;
    }

    const hourlySnapshot = VolumeCalculator.createEmptyHourlySnapshot(
      state.pair.id,
      timestamp
    );

    state.volumeSnapshots.set(hourlySnapshot.id, hourlySnapshot);
    state.lastPriceAndVolumeUpdate = timestamp;
    state.isVolumeSnapshotsUpdated = true;
    state.isPairUpdated = true;
  }

  private async _calculateCurrentVolumes(
    state: PairState,
    currentTime: Date
  ): Promise<VolumePeriods> {
    if (!state.pair) {
      return {
        volume1h: 0,
        volume24h: 0,
        volume7d: 0,
        volume30d: 0,
        volume1y: 0,
      };
    }

    const { oneYearAgo } = TimeUtils.getTimePeriods(currentTime);

    const dbSnapshots = await this._ctx.store.find(PairVolumeSnapshot, {
      where: {
        pair: { id: state.pair.id },
        interval: VolumeInterval.HOURLY,
        timestamp: MoreThanOrEqual(oneYearAgo),
      },
      order: { timestamp: "DESC" },
    });

    const pendingSnapshots = Array.from(state.volumeSnapshots.values());
    const allSnapshots = [...dbSnapshots, ...pendingSnapshots];

    return VolumeCalculator.calculateVolumesFromSnapshots(
      allSnapshots,
      currentTime
    );
  }

  private async _updatePairVolumes(
    state: PairState,
    timestamp: Date
  ): Promise<void> {
    if (!state.pair) {
      return;
    }

    const volumes = await this._calculateCurrentVolumes(state, timestamp);
    state.pair.volume1h = volumes.volume1h;
    state.pair.volume24h = volumes.volume24h;
    state.pair.volume7d = volumes.volume7d;
    state.pair.volume30d = volumes.volume30d;
    state.pair.volume1y = volumes.volume1y;
  }

  private async _initSnapshots(
    state: PairState,
    timestamp: Date
  ): Promise<void> {
    if (!state.pair || state.volumeSnapshots.size > 0) {
      return;
    }

    const latestSnapshot = await this._ctx.store.findOne(PairVolumeSnapshot, {
      where: { pair: { id: state.pair.id }, interval: VolumeInterval.HOURLY },
      order: { timestamp: "DESC" },
    });

    if (latestSnapshot) {
      state.volumeSnapshots.set(latestSnapshot.id, latestSnapshot);
      state.lastPriceAndVolumeUpdate = latestSnapshot.timestamp;
    } else {
      const hourlySnapshot = VolumeCalculator.createEmptyHourlySnapshot(
        state.pair.id,
        timestamp
      );
      state.volumeSnapshots.set(hourlySnapshot.id, hourlySnapshot);
      state.lastPriceAndVolumeUpdate = timestamp;
    }
  }
}
