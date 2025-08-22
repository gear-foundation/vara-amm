import { GearApi } from "@gear-js/api";
import {
  getBlockCommonData,
  isSailsEvent,
  isUserMessageSentEvent,
} from "../helpers";
import { Pair, Transaction, TransactionType } from "../model";
import { ProcessorContext } from "../processor";
import { PairProgram, VftProgram } from "../services";
import { SailsDecoder } from "../sails-decoder";
import { BlockCommonData, UserMessageSentEvent, PairInfo } from "../types";
import { BaseHandler } from "./base";

export class PairHandler extends BaseHandler {
  private _pairDecoder: SailsDecoder;
  private _transactions: Map<string, Transaction>;
  private _pairInfo: PairInfo;
  private _pair: Pair;
  private _isPairUpdated: boolean;

  constructor(pairInfo: PairInfo) {
    super();
    this._pairInfo = pairInfo;
    this.userMessageSentProgramIds = [pairInfo.address];
    this.events = [];
    this.messageQueuedProgramIds = [];
    this._isPairUpdated = false;
  }

  public async init(api: GearApi): Promise<void> {
    this._pairDecoder = await SailsDecoder.new("assets/pair.idl");
    this._transactions = new Map();

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
      createdAt: new Date(),
    });
  }

  public async clear(): Promise<void> {
    this._transactions.clear();
  }

  public async save(): Promise<void> {
    if (this._isPairUpdated) {
      await this._ctx.store.save(this._pair);
      this._isPairUpdated = false;
    }

    const transactions = Array.from(this._transactions.values());
    this._ctx.log.info({ transactions }, "Saving transactions");
    await this._ctx.store.save(transactions);
  }

  public async process(ctx: ProcessorContext): Promise<void> {
    // Always call super.process(ctx) first
    await super.process(ctx);

    ctx.log.info(`Processing ${ctx.blocks.length} blocks`);

    for (const block of ctx.blocks) {
      const common = getBlockCommonData(block);

      for (const event of block.events) {
        this._ctx.log.info({ event }, "Event");

        if (
          isUserMessageSentEvent(event) &&
          event.args.message.source === this._pairInfo.address
        ) {
          this._handleUserMessageSentEvent(event, common);
        }
      }
    }
  }

  private _handleUserMessageSentEvent(
    event: UserMessageSentEvent,
    common: BlockCommonData
  ) {
    if (isSailsEvent(event)) {
      this._ctx.log.info({ event }, "SailsEvent!!!");
      const { service, method, payload } = this._pairDecoder.decodeEvent(event);

      this._ctx.log.info(
        { service, method, payload },
        ` UserMessageSentEvent from ${this._pairInfo.address}`
      );

      if (service === "Pair") {
        this._handlePairService(method, payload, common, event);
      }
    }
  }

  private _handlePairService(
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
          user: event.args.message.source,
          // user: event.call.args.message.source
          blockNumber: BigInt(common.blockNumber),
          timestamp: common.blockTimestamp,
          amountA: BigInt(payload.amount_a),
          amountB: BigInt(payload.amount_b),
          liquidity: BigInt(payload.liquidity),
          pair: { id: this._pair.id } as any,
        });

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

        this._transactions.set(event.args.message.id, transaction);
        this._ctx.log.info({ transaction }, "Processed LiquidityRemoved event");
        break;
      }

      default:
        this._ctx.log.debug(
          { method, payload },
          "Unhandled pair service method"
        );
    }
  }
}
