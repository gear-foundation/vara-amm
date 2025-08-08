"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseHandler = void 0;
class BaseHandler {
    events;
    userMessageSentProgramIds;
    messageQueuedProgramIds;
    _logger;
    _ctx;
    constructor() { }
    getEvents() {
        return this.events;
    }
    getUserMessageSentProgramIds() {
        return this.userMessageSentProgramIds;
    }
    getMessageQueuedProgramIds() {
        return this.messageQueuedProgramIds;
    }
    init() {
        return Promise.resolve();
    }
    async process(ctx) {
        this._ctx = ctx;
        this.clear();
    }
}
exports.BaseHandler = BaseHandler;
