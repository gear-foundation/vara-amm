import { isHex } from "@subsquid/util-internal-hex";
import { existsSync, readFileSync } from "node:fs";
import { getFnNamePrefix, getServiceNamePrefix, Sails } from "sails-js";
import { SailsIdlParser } from "sails-js-parser";
import { MessageQueuedEvent, UserMessageSentEvent } from "./types";

interface Message {
  service: string;
  method: string;
}

interface InputMessage<T> extends Message {
  params: T;
}

interface OutputMessage<T> extends Message {
  payload: T;
}

type EventMessage<T> = OutputMessage<T>;

export class SailsDecoder {
  constructor(private _program: Sails) {}

  static async new(idlPath: string) {
    if (!existsSync(idlPath)) {
      throw new Error(`File ${idlPath} does not exist`);
    }

    const idlcontent = readFileSync(idlPath, "utf8");

    const parser = await SailsIdlParser.new();
    const sails = new Sails(parser);

    sails.parseIdl(idlcontent);

    return new SailsDecoder(sails);
  }

  service(data: string): string {
    if (!isHex(data)) {
      throw new Error(`Invalid hex string: ${data}`);
    }
    return getServiceNamePrefix(data as `0x${string}`);
  }

  method(data: string): string {
    if (!isHex(data)) {
      throw new Error(`Invalid hex string: ${data}`);
    }
    return getFnNamePrefix(data as `0x${string}`);
  }

  decodeInput<T>({
    call: {
      args: { payload },
    },
  }: MessageQueuedEvent): InputMessage<T> {
    const service = this.service(payload);
    const method = this.method(payload);
    const params =
      this._program.services[service].functions[method].decodePayload<T>(
        payload
      );

    return {
      service,
      method,
      params,
    };
  }

  decodeOutput<T>({
    args: {
      message: { payload },
    },
  }: UserMessageSentEvent): OutputMessage<T> {
    const service = this.service(payload);
    const method = this.method(payload);
    const _payload =
      this._program.services[service].functions[method].decodeResult<T>(
        payload
      );

    return {
      service,
      method,
      payload: _payload,
    };
  }

  decodeEvent<T>({
    args: {
      message: { payload },
    },
  }: UserMessageSentEvent): EventMessage<T> {
    const service = this.service(payload);
    const method = this.method(payload);
    const _payload =
      this._program.services[service].events[method]?.decode(payload);

    return {
      service,
      method,
      payload: _payload,
    };
  }

  encodeQueryInput(service: string, fn: string, data: any[]): `0x${string}` {
    return this._program.services[service].queries[fn].encodePayload(...data);
  }

  decodeQueryOutput<T>(service: string, fn: string, data: string): T {
    return this._program.services[service].queries[fn].decodeResult<T>(
      data as `0x${string}`
    );
  }
}
