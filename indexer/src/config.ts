import dotenv from "dotenv";

dotenv.config();

const getEnv = (key: string, _default?: string): string => {
  const value = process.env[key] || _default;
  if (!value) {
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
};

export const config = {
  archiveUrl: getEnv(
    "VARA_ARCHIVE_URL",
    "https://v2.archive.subsquid.io/network/vara-testnet",
  ),
  rpcUrl: getEnv("VARA_RPC_URL", "wss://testnet-archive.vara.network"),
  rateLimit: Number(getEnv("VARA_RPC_RATE_LIMIT", "20")),
  fromBlock: Number(getEnv("VARA_FROM_BLOCK", "0")),
};
