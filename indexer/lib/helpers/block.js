"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlockCommonData = getBlockCommonData;
function getBlockCommonData(block) {
    const header = block.header;
    return {
        blockNumber: BigInt(header.height),
        blockHash: header.hash,
        blockTimestamp: new Date(header.timestamp),
    };
}
