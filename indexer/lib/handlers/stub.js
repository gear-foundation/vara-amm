"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StubHandler = void 0;
const helpers_1 = require("../helpers");
const model_1 = require("../model");
const sails_decoder_1 = require("../sails-decoder");
const base_1 = require("./base");
class StubHandler extends base_1.BaseHandler {
    _decoder;
    _factoryDecoder;
    _transfers;
    _pairProgramIds;
    constructor() {
        super();
        this.userMessageSentProgramIds = [
            "0x9b68b7183bfc3f74cbbf19434277b4906280efe619a7fe0911699f0fde524c93",
        ];
        this.events = [];
        this.messageQueuedProgramIds = [];
    }
    async init() {
        this._decoder = await sails_decoder_1.SailsDecoder.new("assets/extended_vft.idl");
        this._transfers = new Map();
    }
    async clear() {
        this._transfers.clear();
    }
    async save() {
        const transfers = Array.from(this._transfers.values());
        this._ctx.log.info({ transfers }, "Saving transfers");
        await this._ctx.store.save(transfers);
    }
    async process(ctx) {
        await super.process(ctx);
        ctx.log.info(`Processing ${ctx.blocks.length} blocks`);
        for (const block of ctx.blocks) {
            const common = (0, helpers_1.getBlockCommonData)(block);
            for (const event of block.events) {
                if (event.args.message.source !==
                    "0x9b68b7183bfc3f74cbbf19434277b4906280efe619a7fe0911699f0fde524c93") {
                    continue;
                }
                if ((0, helpers_1.isUserMessageSentEvent)(event)) {
                    this._handleUserMessageSentEvent(event, common);
                }
            }
        }
    }
    _handleUserMessageSentEvent(event, common) {
        if ((0, helpers_1.isSailsEvent)(event)) {
            this._ctx.log.info({ event }, "SailsEvent!!!");
            const { service, method, payload } = this._decoder.decodeEvent(event);
            this._ctx.log.info({ service, method, payload }, "SAILS UserMessageSentEvent");
            if (service === "Vft") {
                this._handleVftService(method, payload, common, event);
            }
        }
    }
    _handleVftService(method, payload, common, event) {
        console.log("🚀 ~ StubHandler ~ _handleVftService ~ method:", method);
        switch (method) {
            case "Transfer": {
                const transfer = new model_1.VftTransfer({
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
exports.StubHandler = StubHandler;
