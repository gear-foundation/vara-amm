import { config } from 'dotenv';

config();

const required = (name: string): string => {
  const val = process.env[name];
  if (!val) throw new Error(`${name} is not set`);
  return val;
};

/**
 * Parse a positive integer env var with a default. Fails fast on NaN, <=0,
 * or non-integer input so a typo crashes boot instead of silently running
 * with broken voucher economics.
 */
const posInt = (name: string, defaultValue: string): number => {
  const raw = process.env[name] ?? defaultValue;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new Error(
      `${name} must be a positive integer (got "${raw}"). Fix the env and redeploy.`,
    );
  }
  return n;
};

/**
 * Parse a non-negative integer env var (0 is a valid sentinel for "disabled").
 * Used for the per-IP ceiling — setting `PER_IP_VOUCHERS_PER_DAY=0` turns the
 * gate off for test/dev/internal environments. The service checks for
 * `ceiling <= 0` and short-circuits.
 */
const nonNegInt = (name: string, defaultValue: string): number => {
  const raw = process.env[name] ?? defaultValue;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new Error(
      `${name} must be a non-negative integer (got "${raw}"). Use 0 to disable, or a positive integer.`,
    );
  }
  return n;
};

export default () => {
  const voucherDurationSec = posInt('VOUCHER_DURATION_SEC', '86400');

  return {
    port: posInt('PORT', '3001'),
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: posInt('DB_PORT', '5432'),
      user: required('DB_USER'),
      password: required('DB_PASSWORD'),
      name: required('DB_NAME'),
    },
    nodeUrl: required('NODE_URL'),
    voucherAccount: required('VOUCHER_ACCOUNT'),
    // One-time onboarding voucher amount. This service does not top up.
    voucherAmountVara: posInt('VOUCHER_AMOUNT_VARA', '10'),
    // Max one-time vouchers per IP per UTC day. Disabled by default.
    perIpVouchersPerDay: nonNegInt('PER_IP_VOUCHERS_PER_DAY', '0'),
    // Eligibility gate: first-time wallet must have native balance <= this.
    maxNativeBalanceVara: posInt('MAX_NATIVE_BALANCE_VARA', '1'),
    // Voucher validity duration. Expired vouchers are revoked by cron, but the
    // account remains in DB history and cannot receive another onboarding voucher.
    voucherDurationSec,
    infoApiKey: process.env.INFO_API_KEY || '',
    corsOrigins: (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
};
