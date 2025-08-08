import {
  getBlockCommonData,
  isSailsEvent,
  isUserMessageSentEvent,
} from "../helpers";
import { VftTransfer } from "../model";
import { ProcessorContext } from "../processor";
import { SailsDecoder } from "../sails-decoder";
import { BlockCommonData, UserMessageSentEvent } from "../types";
import { BaseHandler } from "./base";

export class StubHandler extends BaseHandler {
  private _decoder: SailsDecoder;
  private _factoryDecoder: SailsDecoder;
  // TODO: replace with necessary data structures
  private _transfers: Map<string, VftTransfer>;
  private _pairProgramIds: string[];

  constructor() {
    super();
    // Listen to events from your specific program
    this.userMessageSentProgramIds = [
      "0x9b68b7183bfc3f74cbbf19434277b4906280efe619a7fe0911699f0fde524c93",
    ];
    this.events = [];
    this.messageQueuedProgramIds = [
      // "0x9b68b7183bfc3f74cbbf19434277b4906280efe619a7fe0911699f0fde524c93",
    ];
  }

  public async init(): Promise<void> {
    // TODO: Implement if any initial setup is required
    // Otherwise just remove this method
    this._decoder = await SailsDecoder.new("assets/extended_vft.idl");
    this._transfers = new Map();
    // this._factoryDecoder = await SailsDecoder.new("assets/factory.idl");
  }

  public async clear(): Promise<void> {
    // TODO: Implement cleanup logic here
    this._transfers.clear();
  }

  public async save(): Promise<void> {
    // TODO: Implement save logic here
    const transfers = Array.from(this._transfers.values());
    this._ctx.log.info({ transfers }, "Saving transfers");
    await this._ctx.store.save(transfers);
  }

  public async process(ctx: ProcessorContext): Promise<void> {
    // Always call super.process(ctx) first
    await super.process(ctx);

    ctx.log.info(`Processing ${ctx.blocks.length} blocks`);

    for (const block of ctx.blocks) {
      const common = getBlockCommonData(block);

      for (const event of block.events) {
        if (
          event.args.message.source !==
          "0x9b68b7183bfc3f74cbbf19434277b4906280efe619a7fe0911699f0fde524c93"
        ) {
          continue;
        }

        // this._ctx.log.info({ event }, "Event");

        if (isUserMessageSentEvent(event)) {
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
      const { service, method, payload } = this._decoder.decodeEvent(event);
      this._ctx.log.info(
        { service, method, payload },
        "SAILS UserMessageSentEvent"
      );
      // Decode a payload of message sent to program
      // const result = this._decoder.decodeInput(messageQueuedEvent);
      // Decode a message program replied with
      // const reply = decoder.decodeOutput(userMessagSentEvent);
      if (service === "Vft") {
        this._handleVftService(method, payload, common, event);
      }
    }
  }

  private _handleVftService(
    method: string,
    payload: any,
    common: BlockCommonData,
    event: UserMessageSentEvent
  ) {
    console.log("🚀 ~ StubHandler ~ _handleVftService ~ method:", method);
    switch (method) {
      case "Transfer": {
        const transfer = new VftTransfer({
          id: event.args.message.id,
          blockNumber: BigInt(common.blockNumber),
          timestamp: common.blockTimestamp,
          from: payload.from,
          to: payload.to,
          amount: BigInt(payload.value),
          fee: 0n,
        });
        this._transfers.set(event.args.message.id, transfer);
      }
    }
  }
}
