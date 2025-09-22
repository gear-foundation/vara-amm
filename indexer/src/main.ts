import { TypeormDatabase } from "@subsquid/typeorm-store";

import { BaseHandler } from "./handlers/base";
import { FactoryHandler } from "./handlers";
import { config } from "./config";
import { processor } from "./processor";
import { GearApi } from "@gear-js/api";

export class GearProcessor {
  private _handlers: BaseHandler[] = [];

  public addUserMessageSent(programIds: string[]) {
    for (const id of programIds) {
      console.log(`[*] Adding UserMessageSent events for programs ${id}`);
    }
    processor.addGearUserMessageSent({
      // Listen to all program's UserMessageSent events
      // because we can't add specific programIds while processing running
      programId: undefined,
      extrinsic: true,
      call: true,
    });
  }

  public registerHandler(handler: BaseHandler) {
    console.log(`[*] Registering  ${handler.constructor.name}`);
    this._handlers.push(handler);

    const userMessageSentProgramIds = handler.getUserMessageSentProgramIds();
    if (userMessageSentProgramIds.length > 0) {
      this.addUserMessageSent(userMessageSentProgramIds);
    }
  }

  public async run() {
    const db = new TypeormDatabase({
      supportHotBlocks: true,
      stateSchema: "gear_processor",
    });

    processor.run(db, async (ctx) => {
      ctx.log.info(`Processing ${ctx.blocks.length} blocks`);

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
  const api = await GearApi.create({ providerAddress: config.rpcUrl });
  const processor = new GearProcessor();

  // Create and register factory handler
  // Factory handler will load existing pairs from database during initialization
  const factoryHandler = new FactoryHandler(config.factoryProgramId);
  await factoryHandler.init(api);
  processor.registerHandler(factoryHandler);

  await processor.run();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
