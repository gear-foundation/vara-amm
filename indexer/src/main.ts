import { TypeormDatabase } from "@subsquid/typeorm-store";

import { BaseHandler } from "./handlers/base";
import * as handlers from "./handlers";
import { processor } from "./processor";

export class GearProcessor {
  private _handlers: BaseHandler[] = [];

  public addEvents(events: string[]) {
    for (const event of events) {
      console.log(`[*] Adding event ${event}`);
    }
    processor.addEvent({ name: events, call: true, extrinsic: true });
  }

  public addUserMessageSent(programIds: string[]) {
    for (const id of programIds) {
      console.log(`[*] Adding UserMessageSent events for programs ${id}`);
    }
    processor.addGearUserMessageSent({
      programId: programIds,
      extrinsic: true,
      call: true,
    });
  }

  public addMessageQueued(programIds: string[]) {
    for (const id of programIds) {
      console.log(`[*] Adding MessageQueued events for programs ${id}`);
    }
    processor.addGearMessageQueued({
      programId: programIds,
      extrinsic: true,
      call: true,
    });
  }

  public registerHandler(handler: BaseHandler) {
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

  public async run() {
    const db = new TypeormDatabase({
      supportHotBlocks: true,
      stateSchema: "gear_processor",
    });

    processor.run(db, async (ctx) => {
      for (const handler of this._handlers) {
        try {
          await handler.process(ctx);
        } catch (error) {
          ctx.log.error(
            {
              error: error instanceof Error ? error.message : String(error),
              handler: handler.constructor.name,
              stack: error instanceof Error ? error.stack : undefined,
            },
            "Error processing handler"
          );
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

async function main() {
  const processor = new GearProcessor();

  for (const [name, Handler] of Object.entries(handlers)) {
    if (Handler.prototype instanceof BaseHandler) {
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
