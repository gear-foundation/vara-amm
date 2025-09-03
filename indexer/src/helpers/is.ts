import {
  MessageQueuedEvent,
  ProgramChangedEvent,
  UserMessageSentEvent,
} from "../types";
import { Event } from "../processor";

export function isUserMessageSentEvent(
  event: Event
): event is UserMessageSentEvent {
  if (event.name === "Gear.UserMessageSent") {
    return true;
  }
  return false;
}

export function isMessageQueuedEvent(
  event: Event
): event is MessageQueuedEvent {
  if (event.name === "Gear.MessageQueued") {
    return true;
  }
  return false;
}

export function isProgramChangedEvent(
  event: Event
): event is ProgramChangedEvent {
  if (event.name === "Gear.ProgramChanged") {
    return true;
  }
  return false;
}

export function isSailsEvent(event: UserMessageSentEvent): boolean {
  return !Boolean(event.args.message.details);
}
