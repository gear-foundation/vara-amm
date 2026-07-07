import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  ServiceUnavailableException,
  HttpException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { decodeAddress, HexString } from '@gear-js/api';
import { AdvisoryLockTimeoutError, withAdvisoryLock } from './advisory-lock';
import { getWalletLockKey } from './wallet-lock';
import {
  GaslessProgram,
  GaslessProgramStatus,
} from '../entities/gasless-program.entity';
import { Voucher } from '../entities/voucher.entity';
import { IpTrancheUsage } from '../entities/ip-tranche-usage.entity';
import { VoucherService } from './voucher.service';
import { ConfigService } from '@nestjs/config';

const PLANCK_PER_VARA = BigInt(1e12);

/**
 * One-time onboarding voucher model:
 *   - POST /voucher accepts `programs: string[]` and batch-registers them.
 *   - The first successful POST for a wallet issues one voucher funded with
 *     `VOUCHER_AMOUNT_VARA`.
 *   - A wallet with any voucher history cannot receive a second funded voucher,
 *     even after the first voucher expires and the cron revokes it.
 *   - While the original voucher is still active, missing programs can be
 *     appended without adding VARA. This keeps the system recoverable if a
 *     frontend release forgot to request all required AMM programs at once.
 *
 * Abuse gates:
 *   1. Per-account advisory lock for TOCTOU-safe one-time checks.
 *   2. DB voucher history as the wallet-level one-time source of truth.
 *   3. Optional per-IP daily voucher ceiling for many-wallet farming.
 */
export interface VoucherResult {
  voucherId: string;
}

export interface RateLimitedBody {
  statusCode: 429;
  error: 'Too Many Requests';
  message: string;
  nextEligibleAt: string;
  retryAfterSec: number;
}

export interface RateLimitedResult {
  status: 'rate_limited';
  body: RateLimitedBody;
  retryAfterSec: number;
}

export type RequestVoucherResult =
  | { status: 'ok'; voucherId: string }
  | RateLimitedResult;

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ? `${error.name}: ${error.message}\n${error.stack}` : `${error.name}: ${error.message}`;
  }
  if (typeof error === 'string') return error;

  try {
    return JSON.stringify(error, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    );
  } catch {
    return String(error);
  }
}

function isStaleOnChainVoucherError(error: unknown): boolean {
  const message = formatUnknownError(error).toLowerCase();
  return (
    message.includes('inexistentvoucher') ||
    message.includes('voucherexpired') ||
    message.includes("doesn't exist") ||
    message.includes('does not exist') ||
    message.includes('voucher has expired')
  );
}

@Injectable()
export class GaslessService implements OnModuleInit {
  private logger = new Logger(GaslessService.name);

  constructor(
    private readonly voucherService: VoucherService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(GaslessProgram)
    private readonly programRepo: Repository<GaslessProgram>,
    @InjectRepository(IpTrancheUsage)
    private readonly ipUsageRepo: Repository<IpTrancheUsage>,
  ) {}

  /**
   * Ensure the ip_tranche_usage table exists on boot. Production runs with
   * `synchronize: false` (app.module.ts), so new entities do NOT auto-create.
   * This self-healing DDL avoids a hand-run migration step — the first voucher
   * request after deploy would otherwise fail with "relation does not exist".
   *
   * CREATE TABLE IF NOT EXISTS is safe to run on every startup (idempotent).
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.ipUsageRepo.query(`
        CREATE TABLE IF NOT EXISTS ip_tranche_usage (
          ip varchar(64) NOT NULL,
          utc_day date NOT NULL,
          count int NOT NULL DEFAULT 0,
          PRIMARY KEY (ip, utc_day)
        )
      `);
      this.logger.log('ip_tranche_usage table ensured');
    } catch (e) {
      this.logger.error(`Failed to ensure ip_tranche_usage table: ${formatUnknownError(e)}`);
      throw e; // Fail boot — ceiling is a hard gate, we must not run without it.
    }
  }

  private getTodayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Seconds until next UTC midnight — used as `Retry-After` when the per-IP
   * ceiling is hit (reset happens at 00:00 UTC).
   */
  private secondsUntilUtcMidnight(): number {
    const now = new Date();
    const nextMidnight = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0, 0, 0, 0,
    ));
    return Math.max(1, Math.ceil((nextMidnight.getTime() - now.getTime()) / 1000));
  }

  /**
   * Atomically increment the per-IP per-UTC-day voucher counter via a single
   * SQL statement (`INSERT ... ON CONFLICT DO UPDATE ... RETURNING count`).
   * No read-then-write race, no process-local state, cluster-wide correct.
   *
   * Returns `null` when the reservation succeeds. Returns a `rate_limited`
   * shape when the IP would exceed the ceiling so the caller can surface a
   * consistent 429 response (same body + Retry-After header as the per-wallet
   * path).
   *
   * Reservation is NOT refunded on downstream failure (signAndSend timeout
   * may have landed the tx on-chain; refunding would let retries re-issue).
   */
  private async reserveIpVoucherCount(ip: string): Promise<RateLimitedResult | null> {
    const ceiling = this.configService.get<number>('perIpVouchersPerDay');
    if (!ceiling || ceiling <= 0) return null; // disabled

    const today = this.getTodayIsoDate();

    // Atomic increment: the ON CONFLICT branch returns the post-increment count.
    // Use a raw query so the increment + return happens in one round-trip with
    // no read-modify-write race between concurrent requests from the same IP.
    const rows: Array<{ count: number | string }> = await this.ipUsageRepo.query(
      `INSERT INTO ip_tranche_usage (ip, utc_day, count)
       VALUES ($1, $2, 1)
       ON CONFLICT (ip, utc_day) DO UPDATE SET count = ip_tranche_usage.count + 1
       RETURNING count`,
      [ip, today],
    );
    const newCount = Number(rows[0]?.count ?? 0);

    if (newCount > ceiling) {
      this.logger.warn(
        `Per-IP voucher ceiling hit for ${ip}: ${newCount} > ${ceiling}`,
      );
      const retryAfterSec = this.secondsUntilUtcMidnight();
      const nextEligibleAt = new Date(Date.now() + retryAfterSec * 1000).toISOString();
      return {
        status: 'rate_limited',
        retryAfterSec,
        body: {
          statusCode: 429,
          error: 'Too Many Requests',
          message: `Daily onboarding voucher ceiling exceeded for this IP. Limit: ${ceiling} vouchers/UTC-day.`,
          nextEligibleAt,
          retryAfterSec,
        },
      };
    }

    return null;
  }

  async getVoucherInfo() {
    return {
      address: this.voucherService.account?.address,
      balance: await this.voucherService
        .getAccountBalance()
        .then((r) => r.toString(10)),
    };
  }

  /**
   * Read-only voucher state. No ceiling charge.
   */
  async getVoucherState(account: string) {
    let address: HexString;
    try {
      address = decodeAddress(account);
    } catch {
      throw new BadRequestException('Invalid account address');
    }

    const voucher = await this.voucherService.getVoucher(address);

    if (!voucher) {
      return {
        voucherId: null,
        programs: [],
        validUpTo: null,
        varaBalance: '0',
        balanceKnown: true,
        issuedAt: null,
        nextTopUpEligibleAt: null,
        canTopUpNow: false,
        oneTimeUsed: false,
      };
    }

    let balance: bigint | null = null;
    let balanceKnown = true;
    try {
      balance = await this.voucherService.getVoucherBalance(voucher.voucherId);
    } catch (e) {
      // RPC failure — do NOT fabricate a zero balance. Returning "0" would
      // make the starter prompt's drained-voucher STOP rule trigger during
      // a transient Gear node outage, aborting live agents with full vouchers.
      this.logger.warn(`getVoucherBalance failed for ${voucher.voucherId}: ${e}`);
      balanceKnown = false;
    }

    return {
      voucherId: voucher.voucherId,
      programs: voucher.programs,
      validUpTo: voucher.validUpTo,
      varaBalance: balance === null ? null : balance.toString(10),
      balanceKnown,
      issuedAt: voucher.createdAt?.toISOString?.() ?? null,
      lastRenewedAt: voucher.lastRenewedAt.toISOString(),
      nextTopUpEligibleAt: null,
      canTopUpNow: false,
      oneTimeUsed: true,
    };
  }

  /**
   * Process a one-time voucher request. Returns `{status: 'ok', voucherId}` on
   * success or a 429 shape when the per-IP ceiling is exceeded.
   */
  async requestVoucher(
    body: { account: string; programs?: string[]; program?: string },
    ip: string,
  ): Promise<RequestVoucherResult> {
    // Shape validation FIRST — before any logging or processing that would
    // assume `programs` is an array. DTO layer catches this normally, but
    // the guard here keeps the service safe if the ValidationPipe is ever
    // bypassed (tests, custom decorators, future refactors).
    if (body.programs !== undefined && !Array.isArray(body.programs)) {
      throw new BadRequestException('programs must be an array of contract program IDs');
    }

    // Backward-compat hint: old clients sent { account, program: string }.
    // DTO validation rejects that payload with a generic "programs must be
    // an array" error; this check surfaces a specific migration message.
    if (body.program && (body.programs === undefined || body.programs === null)) {
      throw new BadRequestException(
        'API change: `program: string` was renamed to `programs: string[]`. Send `{ account, programs: [<address>, ...] }` instead.',
      );
    }

    this.logger.log(
      `Voucher request for programs [${body.programs?.join(', ') ?? ''}] from ip ${ip}`,
    );

    let address: HexString;
    try {
      address = decodeAddress(body.account);
    } catch {
      throw new BadRequestException('Invalid account address');
    }

    // Normalize + dedupe program addresses.
    const programs = Array.from(
      new Set((body.programs ?? []).map((p) => p.toLowerCase())),
    );

    if (programs.length === 0) {
      throw new BadRequestException('programs must be a non-empty array');
    }

    // Batch whitelist lookup. Every requested program must exist + be Enabled.
    const programRows = await this.programRepo.findBy({ address: In(programs) });
    if (programRows.length !== programs.length) {
      const foundAddrs = new Set(programRows.map((r) => r.address));
      const missing = programs.filter((p) => !foundAddrs.has(p));
      throw new BadRequestException(
        `Program(s) not whitelisted: ${missing.join(', ')}`,
      );
    }
    const disabled = programRows.filter(
      (r) => r.status !== GaslessProgramStatus.Enabled,
    );
    if (disabled.length > 0) {
      throw new BadRequestException(
        `Program(s) disabled: ${disabled.map((r) => r.address).join(', ')}`,
      );
    }

    const voucherAmountVara = this.configService.get<number>('voucherAmountVara');
    const voucherDurationSec = this.configService.get<number>('voucherDurationSec');
    const maxNativeBalanceVara = this.configService.get<number>('maxNativeBalanceVara');

    const [lockKey1, lockKey2] = getWalletLockKey(address);

    try {
      return await withAdvisoryLock(
        this.dataSource,
        [lockKey1, lockKey2],
        `voucher request ${address}`,
        async () => {
          const existing = await this.voucherService.getAnyVoucher(address);

      if (!existing) {
        const accountState = await this.voucherService.getNativeAccountState(address);
        if (accountState.nonce > 0n) {
          throw new ForbiddenException(
            'Onboarding voucher is only available for accounts with no prior transactions.',
          );
        }
        const maxNativeBalance = BigInt(maxNativeBalanceVara) * PLANCK_PER_VARA;
        if (accountState.balance > maxNativeBalance) {
          throw new ForbiddenException(
            `Onboarding voucher is only available when native VARA balance is <= ${maxNativeBalanceVara}.`,
          );
        }

        const ipLimit = await this.reserveIpVoucherCount(ip);
        if (ipLimit) return ipLimit;
        const voucherId = await this.voucherService.issue(
          address,
          programs as HexString[],
          voucherAmountVara,
          voucherDurationSec,
        );
        return { status: 'ok', voucherId };
      }

      const missingPrograms = programs.filter(
        (p) => !existing.programs.includes(p),
      );

      if (existing.revoked) {
        throw new ConflictException(
          'One-time onboarding voucher was already used for this account.',
        );
      }

      if (missingPrograms.length > 0) {
        try {
          await this.voucherService.appendProgramsFreeOfCharge(
            existing,
            missingPrograms as HexString[],
          );
        } catch (error) {
          if (!isStaleOnChainVoucherError(error)) throw error;

          this.logger.warn(
            `Voucher ${existing.voucherId} for account=${address} is stale on-chain (${formatUnknownError(error)})`,
          );
          await this.voucherService.markRevokedLocally(
            existing,
            `stale on-chain during append: ${formatUnknownError(error)}`,
          );
          throw new ConflictException(
            'One-time onboarding voucher already exists but is no longer usable.',
          );
        }
      }

      return { status: 'ok', voucherId: existing.voucherId };
        },
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error instanceof AdvisoryLockTimeoutError) {
        this.logger.warn(
          `Voucher request for account=${address} ip=${ip} timed out waiting for advisory lock`,
        );
        throw new ServiceUnavailableException('Voucher service is busy — please retry');
      }
      this.logger.error(
        `Failed to process voucher request for account=${address} ip=${ip}: ${formatUnknownError(error)}`,
      );
      throw new InternalServerErrorException('Voucher processing failed — please retry');
    }
  }
}
