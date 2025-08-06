/* eslint-disable */
// @ts-nocheck
import { GearApi, HexString, decodeAddress } from '@gear-js/api';
import { TypeRegistry } from '@polkadot/types';
import {
  TransactionBuilder,
  CodeId,
  ActorId,
  throwOnErrorReply,
  getServiceNamePrefix,
  getFnNamePrefix,
  ZERO_ADDRESS,
} from 'sails-js';

import { FactoryConfig } from './types';

export class Program {
  public readonly registry: TypeRegistry;
  public readonly factory: Factory;

  constructor(
    public api: GearApi,
    private _programId?: `0x${string}`,
  ) {
    const types: Record<string, any> = {
      Config: {
        gas_for_token_ops: 'u64',
        gas_for_reply_deposit: 'u64',
        reply_timeout: 'u32',
        gas_for_pair_creation: 'u64',
      },
    };

    this.registry = new TypeRegistry();
    this.registry.setKnownTypes({ types });
    this.registry.register(types);

    this.factory = new Factory(this);
  }

  public get programId(): `0x${string}` {
    if (!this._programId) throw new Error(`Program ID is not set`);
    return this._programId;
  }

  newCtorFromCode(
    code: Uint8Array | Buffer | HexString,
    pair_id: CodeId,
    admin: ActorId,
    fee_to: ActorId,
    config: FactoryConfig,
  ): TransactionBuilder<null> {
    const builder = new TransactionBuilder<null>(
      this.api,
      this.registry,
      'upload_program',
      ['New', pair_id, admin, fee_to, config],
      '(String, [u8;32], [u8;32], [u8;32], Config)',
      'String',
      code,
    );

    this._programId = builder.programId;
    return builder;
  }

  newCtorFromCodeId(codeId: `0x${string}`, pair_id: CodeId, admin: ActorId, fee_to: ActorId, config: FactoryConfig) {
    const builder = new TransactionBuilder<null>(
      this.api,
      this.registry,
      'create_program',
      ['New', pair_id, admin, fee_to, config],
      '(String, [u8;32], [u8;32], [u8;32], Config)',
      'String',
      codeId,
    );

    this._programId = builder.programId;
    return builder;
  }
}

export class Factory {
  constructor(private _program: Program) {}

  public changeFeeTo(fee_to: ActorId): TransactionBuilder<null> {
    if (!this._program.programId) throw new Error('Program ID is not set');
    return new TransactionBuilder<null>(
      this._program.api,
      this._program.registry,
      'send_message',
      ['Factory', 'ChangeFeeTo', fee_to],
      '(String, String, [u8;32])',
      'Null',
      this._program.programId,
    );
  }

  public createPair(token0: ActorId, token1: ActorId): TransactionBuilder<null> {
    if (!this._program.programId) throw new Error('Program ID is not set');
    return new TransactionBuilder<null>(
      this._program.api,
      this._program.registry,
      'send_message',
      ['Factory', 'CreatePair', token0, token1],
      '(String, String, [u8;32], [u8;32])',
      'Null',
      this._program.programId,
    );
  }

  public async feeTo(
    originAddress?: string,
    value?: number | string | bigint,
    atBlock?: `0x${string}`,
  ): Promise<ActorId> {
    const payload = this._program.registry.createType('(String, String)', ['Factory', 'FeeTo']).toHex();
    const reply = await this._program.api.message.calculateReply({
      destination: this._program.programId,
      origin: originAddress ? decodeAddress(originAddress) : ZERO_ADDRESS,
      payload,
      value: value || 0,
      gasLimit: this._program.api.blockGasLimit.toBigInt(),
      at: atBlock,
    });
    throwOnErrorReply(reply.code, reply.payload.toU8a(), this._program.api.specVersion, this._program.registry);
    const result = this._program.registry.createType('(String, String, [u8;32])', reply.payload);
    return result[2].toJSON() as unknown as ActorId;
  }

  public async getPair(
    token0: ActorId,
    token1: ActorId,
    originAddress?: string,
    value?: number | string | bigint,
    atBlock?: `0x${string}`,
  ): Promise<ActorId> {
    const payload = this._program.registry
      .createType('(String, String, [u8;32], [u8;32])', ['Factory', 'GetPair', token0, token1])
      .toHex();
    const reply = await this._program.api.message.calculateReply({
      destination: this._program.programId,
      origin: originAddress ? decodeAddress(originAddress) : ZERO_ADDRESS,
      payload,
      value: value || 0,
      gasLimit: this._program.api.blockGasLimit.toBigInt(),
      at: atBlock,
    });
    throwOnErrorReply(reply.code, reply.payload.toU8a(), this._program.api.specVersion, this._program.registry);
    const result = this._program.registry.createType('(String, String, [u8;32])', reply.payload);
    return result[2].toJSON() as unknown as ActorId;
  }

  public async pairs(
    originAddress?: string,
    value?: number | string | bigint,
    atBlock?: `0x${string}`,
  ): Promise<Array<[[ActorId, ActorId], ActorId]>> {
    const payload = this._program.registry.createType('(String, String)', ['Factory', 'Pairs']).toHex();
    const reply = await this._program.api.message.calculateReply({
      destination: this._program.programId,
      origin: originAddress ? decodeAddress(originAddress) : ZERO_ADDRESS,
      payload,
      value: value || 0,
      gasLimit: this._program.api.blockGasLimit.toBigInt(),
      at: atBlock,
    });
    throwOnErrorReply(reply.code, reply.payload.toU8a(), this._program.api.specVersion, this._program.registry);
    const result = this._program.registry.createType(
      '(String, String, Vec<(([u8;32], [u8;32]), [u8;32])>)',
      reply.payload,
    );
    return result[2].toJSON() as unknown as Array<[[ActorId, ActorId], ActorId]>;
  }

  public subscribeToPairCreatedEvent(
    callback: (data: { token0: ActorId; token1: ActorId; pair_address: ActorId }) => void | Promise<void>,
  ): Promise<() => void> {
    return this._program.api.gearEvents.subscribeToGearEvent('UserMessageSent', ({ data: { message } }) => {
      if (!message.source.eq(this._program.programId) || !message.destination.eq(ZERO_ADDRESS)) {
        return;
      }

      const payload = message.payload.toHex();
      if (getServiceNamePrefix(payload) === 'Factory' && getFnNamePrefix(payload) === 'PairCreated') {
        callback(
          this._program.registry
            .createType(
              '(String, String, {"token0":"[u8;32]","token1":"[u8;32]","pair_address":"[u8;32]"})',
              message.payload,
            )[2]
            .toJSON() as unknown as {
            token0: ActorId;
            token1: ActorId;
            pair_address: ActorId;
          },
        );
      }
    });
  }
}
