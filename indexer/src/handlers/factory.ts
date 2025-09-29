import { GearApi, HexString } from "@gear-js/api";
import { isSailsEvent, isUserMessageSentEvent } from "../helpers";
import { Pair } from "../model";
import { ProcessorContext } from "../processor";
import { FactoryEventPayload, PairCreatedEventPayload } from "../services";
import { SailsDecoder } from "../sails-decoder";
import { UserMessageSentEvent, PairInfo } from "../types";
import { BaseHandler } from "./base";
import { PairsHandler } from "./pair";

export class FactoryHandler extends BaseHandler {
  private _factoryDecoder: SailsDecoder;
  private _factoryProgramId: string;
  private _pairsHandler: PairsHandler;
  private _existingPairsLoaded: boolean;

  constructor(factoryProgramId: string) {
    super();
    this._factoryProgramId = factoryProgramId;
    this._pairsHandler = new PairsHandler();
    this._existingPairsLoaded = false;
    this.userMessageSentProgramIds = [factoryProgramId];
    this.events = [];
    this.messageQueuedProgramIds = [];
  }

  public async init(api: GearApi): Promise<void> {
    this._factoryDecoder = await SailsDecoder.new("assets/factory.idl");
    await this._pairsHandler.init(api);
  }

  /**
   * Load existing pairs from database and create handlers for them
   * This should be called after the context is available (during first process call)
   */
  private async _loadExistingPairs(): Promise<void> {
    if (!this._ctx) {
      throw new Error(
        "Context not available. This method should be called during processing."
      );
    }

    const existingPairs = await this._ctx.store.find(Pair);

    this._ctx.log.info(
      { count: existingPairs.length },
      "Loading existing pairs from database"
    );

    for (const pair of existingPairs) {
      const pairInfo: PairInfo = {
        address: pair.id as HexString,
        tokens: [pair.token0 as HexString, pair.token1 as HexString],
      };

      this._ctx.log.info(
        {
          pairAddress: pair.id,
          token0: pair.token0,
          token1: pair.token1,
          symbols: `${pair.token0Symbol || "Unknown"} / ${
            pair.token1Symbol || "Unknown"
          }`,
        },
        "Registering existing pair"
      );

      this._pairsHandler.registerExistingPair(pair);
      this._pairsHandler.registerPair(pairInfo);
    }

    this._ctx.log.info(
      { totalPairs: existingPairs.length },
      "Successfully loaded existing pairs into memory"
    );
  }

  public async clear(): Promise<void> {
    await this._pairsHandler.clear();
  }

  public async save(): Promise<void> {
    await this._pairsHandler.save();
  }

  public async process(ctx: ProcessorContext): Promise<void> {
    // Always call super.process(ctx) first
    await super.process(ctx);

    // Load existing pairs from database on first run
    if (!this._existingPairsLoaded) {
      await this._loadExistingPairs();
      this._existingPairsLoaded = true;
    }

    for (const block of ctx.blocks) {
      for (const event of block.events) {
        if (
          isUserMessageSentEvent(event) &&
          event.args.message.source === this._factoryProgramId
        ) {
          await this._handleUserMessageSentEvent(event);
        }
      }
    }

    await this._pairsHandler.process(ctx);
  }

  private async _handleUserMessageSentEvent(event: UserMessageSentEvent) {
    if (isSailsEvent(event)) {
      const { service, method, payload } =
        this._factoryDecoder.decodeEvent(event);

      this._ctx.log.info(
        { service, method, payload },
        `UserMessageSentEvent from factory ${this._factoryProgramId}`
      );

      if (service === "Factory") {
        await this._handleFactoryService(
          method,
          payload as FactoryEventPayload
        );
      }
    }
  }

  private async _handleFactoryService(
    method: string,
    payload: FactoryEventPayload
  ) {
    switch (method) {
      case "PairCreated": {
        const pairCreatedPayload = payload as PairCreatedEventPayload;
        await this._handlePairCreated(pairCreatedPayload);
        this._ctx.log.info(
          {
            token0: pairCreatedPayload.token0,
            token1: pairCreatedPayload.token1,
            pairAddress: pairCreatedPayload.pair_address,
          },
          "New pair created"
        );
        break;
      }

      default:
        this._ctx.log.debug(
          { method, payload },
          "Unhandled factory service method"
        );
    }
  }

  private async _handlePairCreated(
    payload: PairCreatedEventPayload
  ): Promise<void> {
    const pairInfo: PairInfo = {
      address: payload.pair_address,
      tokens: [payload.token0, payload.token1],
    };

    if (this._pairsHandler) {
      this._pairsHandler.registerPair(pairInfo);
      this._ctx.log.info(
        {
          pairAddress: pairInfo.address,
          token0: pairInfo.tokens[0],
          token1: pairInfo.tokens[1],
        },
        "Registered new pair"
      );
    }
  }
}
