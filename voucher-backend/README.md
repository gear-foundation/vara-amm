# Vara AMM Voucher Backend

One-time gas voucher service for the `vUSDT -> native VARA` onboarding swap.

The service issues a single funded voucher per wallet. If the voucher later
expires or is revoked, the DB history still blocks another automatic issue for
that wallet. The default voucher lifetime is 24 hours; the hourly revoke task
reclaims the unused remainder after expiry.

## API

### `POST /voucher`

```json
{
  "account": "0x...",
  "programs": ["0x<vUSDT>", "0x<vUSDT/VARA pair>", "0x<VARA native exchange>"]
}
```

Success:

```json
{ "voucherId": "0x..." }
```

Rules:

- `programs` must all be present in the `gasless_program` whitelist.
- a wallet with no voucher history receives one voucher funded with
  `VOUCHER_AMOUNT_VARA`.
- the wallet must be first-use: account nonce is `0` and native VARA balance is
  `<= MAX_NATIVE_BALANCE_VARA`.
- an active existing voucher is returned as-is.
- missing programs can be appended to an active voucher without adding funds.
- a revoked/expired voucher history returns `409`; automatic second issue is
  intentionally blocked.
- `PER_IP_VOUCHERS_PER_DAY` can limit many-wallet farming from one IP per UTC
  day, but it is disabled by default.

### `GET /voucher/:account`

Returns the active voucher state if one exists:

```json
{
  "voucherId": "0x...",
  "programs": ["0x..."],
  "validUpTo": "2026-07-07T12:00:00.000Z",
  "varaBalance": "10000000000000",
  "balanceKnown": true,
  "issuedAt": "2026-07-07T11:00:00.000Z",
  "oneTimeUsed": true
}
```

No active voucher returns `voucherId: null`. If the backend cannot read voucher
balance from the node, `balanceKnown` is `false` and `varaBalance` is `null`.

### `GET /info`

Issuer account and balance. Requires `x-api-key: <INFO_API_KEY>`.

## Environment

| Var | Description |
| --- | --- |
| `NODE_URL` | Vara RPC endpoint |
| `VOUCHER_ACCOUNT` | Sponsor seed phrase, URI, or hex seed |
| `VOUCHER_AMOUNT_VARA` | VARA funded into each one-time voucher |
| `VOUCHER_DURATION_SEC` | Voucher lifetime before cron can revoke it |
| `MAX_NATIVE_BALANCE_VARA` | Max native balance for eligibility; default `1` |
| `PER_IP_VOUCHERS_PER_DAY` | Max fresh vouchers per IP per UTC day, default `0` disables |
| `VUSDT_TOKEN_PROGRAM_ID` | vUSDT token program allowed for `Approve` |
| `VUSDT_VARA_PAIR_PROGRAM_ID` | AMM pair program allowed for `Swap` |
| `VARA_TOKEN_PROGRAM_ID` | native exchange program allowed for `Burn` |
| `CORS_ORIGINS` | Comma-separated frontend origins |
| `INFO_API_KEY` | API key for `GET /info` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Postgres connection |

## Setup

```bash
cp .env.example .env
npm install
npm run seed
npm run start:dev
```

`npm run seed` upserts the three allowed AMM programs into Postgres.
