import type { GearApi } from '@gear-js/api';
import type { SubmittableExtrinsic } from '@polkadot/api/types';
import type { ISubmittableResult } from '@polkadot/types/types';

type Extrinsic = SubmittableExtrinsic<'promise', ISubmittableResult>;

const normalizeVoucherPayload = (payload: unknown): string | number[] => {
  if (payload && typeof payload === 'object') {
    const codec = payload as { toHex?: () => string; toU8a?: (isBare?: boolean) => Uint8Array };
    if (typeof codec.toHex === 'function') {
      return codec.toHex();
    }
    if (typeof codec.toU8a === 'function') {
      return Array.from(codec.toU8a(true));
    }
  }

  if (payload instanceof Uint8Array) {
    return Array.from(payload);
  }

  if (Array.isArray(payload) || typeof payload === 'string') {
    return payload as string | number[];
  }

  throw new Error('Could not normalize voucher message payload.');
};

export const wrapGearSendMessageWithVoucher = (api: GearApi, extrinsic: Extrinsic, voucherId: string): Extrinsic => {
  const method = extrinsic.method;
  if (method.section !== 'gear' || method.method !== 'sendMessage') {
    throw new Error(`Voucher can only wrap gear.sendMessage, got ${method.section}.${method.method}.`);
  }

  const [destination, payload, gasLimit, value, keepAlive] = method.args;
  return api.tx.gearVoucher.call(voucherId as `0x${string}`, {
    SendMessage: {
      destination,
      payload: normalizeVoucherPayload(payload),
      gasLimit,
      value,
      keepAlive,
    },
  }) as Extrinsic;
};
