"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const getEnv = (key, _default) => {
    const value = process.env[key] || _default;
    if (!value) {
        throw new Error(`Environment variable ${key} is not set`);
    }
    return value;
};
exports.config = {
    archiveUrl: getEnv("VARA_ARCHIVE_URL", "https://v2.archive.subsquid.io/network/vara-testnet"),
    rpcUrl: getEnv("VARA_RPC_URL", "wss://testnet-archive.vara.network"),
    rateLimit: Number(getEnv("VARA_RPC_RATE_LIMIT", "20")),
    fromBlock: Number(getEnv("VARA_FROM_BLOCK", "0")),
};
