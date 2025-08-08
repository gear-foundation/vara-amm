"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GearProcessor = void 0;
const typeorm_store_1 = require("@subsquid/typeorm-store");
const base_1 = require("./handlers/base");
const handlers = __importStar(require("./handlers"));
const processor_1 = require("./processor");
class GearProcessor {
    _handlers = [];
    addEvents(events) {
        for (const event of events) {
            console.log(`[*] Adding event ${event}`);
        }
        processor_1.processor.addEvent({ name: events, call: true, extrinsic: true });
    }
    addUserMessageSent(programIds) {
        for (const id of programIds) {
            console.log(`[*] Adding UserMessageSent events for programs ${id}`);
        }
        processor_1.processor.addGearUserMessageSent({
            programId: programIds,
            extrinsic: true,
            call: true,
        });
    }
    addMessageQueued(programIds) {
        for (const id of programIds) {
            console.log(`[*] Adding MessageQueued events for programs ${id}`);
        }
        processor_1.processor.addGearMessageQueued({
            programId: programIds,
            extrinsic: true,
            call: true,
        });
    }
    registerHandler(handler) {
        console.log("Handler", `Registering ${handler.constructor.name}`);
        this._handlers.push(handler);
        const events = handler.getEvents();
        if (events.length > 0) {
            this.addEvents(events);
        }
        const userMessageSentProgramIds = handler.getUserMessageSentProgramIds();
        if (userMessageSentProgramIds.length > 0) {
            this.addUserMessageSent(userMessageSentProgramIds);
        }
        const messageQueuedProgramIds = handler.getMessageQueuedProgramIds();
        if (messageQueuedProgramIds.length > 0) {
            this.addMessageQueued(messageQueuedProgramIds);
        }
    }
    async run() {
        const db = new typeorm_store_1.TypeormDatabase({
            supportHotBlocks: true,
            stateSchema: "gear_processor",
        });
        processor_1.processor.run(db, async (ctx) => {
            for (const handler of this._handlers) {
                try {
                    await handler.process(ctx);
                }
                catch (error) {
                    ctx.log.error({
                        error: error instanceof Error ? error.message : String(error),
                        handler: handler.constructor.name,
                        stack: error instanceof Error ? error.stack : undefined,
                    }, "Error processing handler");
                    if (process.env.NODE_ENV === "development") {
                        ctx.log.error("Exiting due to handler error in development mode");
                        process.exit(1);
                    }
                }
            }
            for (const handler of this._handlers) {
                await handler.save();
            }
        });
    }
}
exports.GearProcessor = GearProcessor;
async function main() {
    const processor = new GearProcessor();
    for (const [name, Handler] of Object.entries(handlers)) {
        if (Handler.prototype instanceof base_1.BaseHandler) {
            const handler = new Handler();
            console.log(`[*] Initializing handler: ${name}`);
            await handler.init();
            console.log(`[*] Registering new handler: ${name}`);
            processor.registerHandler(handler);
        }
    }
    await processor.run();
}
main().catch((error) => {
    console.error(error);
    process.exit(1);
});
