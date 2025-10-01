import { isSailsEvent, isUserMessageSentEvent } from "../helpers";
import { ProcessorContext } from "../processor";
import { FactoryEventPayload, PairCreatedEventPayload } from "../services";
import { SailsDecoder } from "../sails-decoder";
import { UserMessageSentEvent, PairInfo } from "../types";
import { BaseHandler } from "./base";
import { PairsHandler } from "./pair";

export class FactoryHandler extends BaseHandler {
  private _factoryDecoder: SailsDecoder;
  private _existingPairsLoaded: boolean;

  constructor(
    private _factoryProgramId: string,
    private _pairsHandler: PairsHandler
  ) {
    super();
    this._existingPairsLoaded = false;
    this.userMessageSentProgramIds = [_factoryProgramId];
    this.events = [];
    this.messageQueuedProgramIds = [];
  }

  public async init(): Promise<void> {
    this._factoryDecoder = await SailsDecoder.new("assets/factory.idl");
  }

  public async clear(): Promise<void> {}

  public async save(): Promise<void> {
    const pairsToSave = this._pairsHandler.getPairsToSave();

    if (pairsToSave.length > 0) {
      this._ctx.log.info({ count: pairsToSave.length }, "Factory saving pairs");
      await this._ctx.store.save(pairsToSave);
    }
  }

  public async process(ctx: ProcessorContext): Promise<void> {
    // Always call super.process(ctx) first
    await super.process(ctx);

    // Load existing pairs from database on first run
    if (!this._existingPairsLoaded) {
      await this._pairsHandler.loadExistingPairs(ctx);
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
