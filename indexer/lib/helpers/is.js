"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUserMessageSentEvent = isUserMessageSentEvent;
exports.isMessageQueuedEvent = isMessageQueuedEvent;
exports.isProgramChangedEvent = isProgramChangedEvent;
exports.isSailsEvent = isSailsEvent;
function isUserMessageSentEvent(event) {
    if (event.name === "Gear.UserMessageSent") {
        return true;
    }
    return false;
}
function isMessageQueuedEvent(event) {
    if (event.name === "Gear.MessageQueued") {
        return true;
    }
    return false;
}
function isProgramChangedEvent(event) {
    if (event.name === "Gear.ProgramChanged") {
        return true;
    }
    return false;
}
function isSailsEvent(event) {
    return !Boolean(event.args.message.details);
}
