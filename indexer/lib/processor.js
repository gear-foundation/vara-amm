"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processor = void 0;
const substrate_processor_1 = require("@subsquid/substrate-processor");
const node_os_1 = require("node:os");
const config_1 = require("./config");
exports.processor = new substrate_processor_1.SubstrateBatchProcessor()
    .setGateway(config_1.config.archiveUrl)
    .setRpcEndpoint({
    url: config_1.config.rpcUrl,
    rateLimit: config_1.config.rateLimit,
    headers: {
        'User-Agent': (0, node_os_1.hostname)(),
    },
})
    .setBlockRange({ from: config_1.config.fromBlock })
    .setFields({
    event: {
        args: true,
        extrinsic: true,
        call: true,
    },
    extrinsic: {
        hash: true,
        fee: true,
        signature: true,
    },
    call: {
        args: true,
    },
    block: {
        timestamp: true,
    },
});
