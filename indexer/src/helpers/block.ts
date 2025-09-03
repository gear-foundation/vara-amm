import { Block } from '@subsquid/substrate-processor';
import { BlockCommonData } from '../types';
import { BlockHeader } from '../processor';

export function getBlockCommonData(block: Block): BlockCommonData {
  const header = block.header as BlockHeader;

  return {
    blockNumber: BigInt(header.height),
    blockHash: header.hash,
    blockTimestamp: new Date(header.timestamp),
  };
}
