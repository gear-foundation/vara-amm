import { Logger } from '@subsquid/logger';
import { ProcessorContext } from '../processor';

export abstract class BaseHandler {
  protected events: string[];
  protected userMessageSentProgramIds: string[];
  protected messageQueuedProgramIds: string[];
  protected _logger: Logger;
  protected _ctx: ProcessorContext;

  constructor() {}

  public getEvents(): string[] {
    return this.events;
  }

  public getUserMessageSentProgramIds(): string[] {
    return this.userMessageSentProgramIds;
  }

  public getMessageQueuedProgramIds(): string[] {
    return this.messageQueuedProgramIds;
  }

  public init(): Promise<void> {
    // Override this method to perform any necessary initialization
    return Promise.resolve();
  }

  abstract clear(): void;

  async process(ctx: ProcessorContext): Promise<void> {
    this._ctx = ctx;
    this.clear();
  }

  abstract save(): Promise<void>;
}
