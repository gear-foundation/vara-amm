import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { GaslessService } from './gasless.service';
import { VoucherService } from './voucher.service';
import { GaslessProgram, GaslessProgramStatus } from '../entities/gasless-program.entity';
import { Voucher } from '../entities/voucher.entity';
import { IpTrancheUsage } from '../entities/ip-tranche-usage.entity';

jest.mock('@gear-js/api', () => ({
  decodeAddress: jest.fn((addr: string) => {
    if (addr === 'invalid') throw new Error('Invalid address');
    return `0x${addr}`;
  }),
}));

const PROGRAM_A = '0x4d47cb784a0b1e3788181a6cedb52db11aad0cef';
const PROGRAM_B = '0xdeadbeef00000000000000000000000000000000';
const ACCOUNT = 'validaccount';
const DECODED = `0x${ACCOUNT}`;
const IP = '127.0.0.1';
const VOUCHER_AMOUNT_VARA = 10;
const VOUCHER_DURATION_SEC = 86400;
const MAX_NATIVE_BALANCE_VARA = 1;
const PLANCK_PER_VARA = 10n ** 12n;

function makeProgram(address: string, overrides: Partial<GaslessProgram> = {}): GaslessProgram {
  return {
    id: `p-${address.slice(0, 6)}`,
    name: 'TestProgram',
    address,
    varaToIssue: VOUCHER_AMOUNT_VARA,
    weight: 1,
    duration: VOUCHER_DURATION_SEC,
    status: GaslessProgramStatus.Enabled,
    oneTime: true,
    createdAt: new Date(),
    ...overrides,
  } as GaslessProgram;
}

function makeVoucher(overrides: Partial<Voucher> = {}): Voucher {
  return {
    id: 'v1',
    voucherId: '0xvoucher',
    account: DECODED,
    programs: [PROGRAM_A],
    varaToIssue: VOUCHER_AMOUNT_VARA,
    validUpToBlock: 1000n,
    validUpTo: new Date(Date.now() + VOUCHER_DURATION_SEC * 1000),
    lastRenewedAt: new Date(),
    revoked: false,
    ...overrides,
  } as Voucher;
}

describe('GaslessService (one-time onboarding model)', () => {
  let service: GaslessService;
  let voucherSvc: jest.Mocked<
    Pick<
      VoucherService,
      | 'getVoucher'
      | 'getAnyVoucher'
      | 'issue'
      | 'getNativeAccountState'
      | 'getVoucherBalance'
      | 'appendProgramsFreeOfCharge'
      | 'markRevokedLocally'
    >
  >;
  let programRepo: { findBy: jest.Mock };
  let ipUsageRepo: { query: jest.Mock };
  let ipRows: Map<string, number>;
  let perIpVouchersPerDay: number;

  beforeEach(async () => {
    ipRows = new Map<string, number>();
    perIpVouchersPerDay = 0;
    ipUsageRepo = {
      query: jest.fn().mockImplementation(async (sql: string, params: any[] = []) => {
        if (sql.includes('INSERT INTO ip_tranche_usage')) {
          const [ip, day] = params;
          const key = `${ip}|${day}`;
          const next = (ipRows.get(key) ?? 0) + 1;
          ipRows.set(key, next);
          return [{ count: next }];
        }
        return [];
      }),
    };
    programRepo = {
      findBy: jest.fn().mockImplementation(async ({ address }) => {
        const addrs: string[] = address._value ?? address.value ?? [];
        return addrs.map((a) => makeProgram(a));
      }),
    };
    const dataSource = {
      createQueryRunner: jest.fn().mockReturnValue({
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockImplementation(async (sql: string) => {
          if (sql === 'SELECT pg_try_advisory_xact_lock($1, $2) AS acquired') {
            return [{ acquired: true }];
          }
          return [];
        }),
        release: jest.fn().mockResolvedValue(undefined),
      }),
    };
    const config = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'voucherAmountVara') return VOUCHER_AMOUNT_VARA;
        if (key === 'perIpVouchersPerDay') return perIpVouchersPerDay;
        if (key === 'voucherDurationSec') return VOUCHER_DURATION_SEC;
        if (key === 'maxNativeBalanceVara') return MAX_NATIVE_BALANCE_VARA;
        return undefined;
      }),
    };
    voucherSvc = {
      getVoucher: jest.fn().mockResolvedValue(null),
      getAnyVoucher: jest.fn().mockResolvedValue(null),
      issue: jest.fn().mockResolvedValue('0xnewvoucher'),
      getNativeAccountState: jest.fn().mockResolvedValue({ balance: 0n, nonce: 0n }),
      getVoucherBalance: jest.fn().mockResolvedValue(0n),
      appendProgramsFreeOfCharge: jest.fn().mockResolvedValue(undefined),
      markRevokedLocally: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        GaslessService,
        { provide: VoucherService, useValue: voucherSvc },
        { provide: ConfigService, useValue: config },
        { provide: DataSource, useValue: dataSource },
        { provide: getRepositoryToken(GaslessProgram), useValue: programRepo },
        { provide: getRepositoryToken(IpTrancheUsage), useValue: ipUsageRepo },
      ],
    }).compile();

    service = module.get(GaslessService);
  });

  it('issues one voucher for a fresh account', async () => {
    const result = await service.requestVoucher(
      { account: ACCOUNT, programs: [PROGRAM_A, PROGRAM_B] },
      IP,
    );

    expect(result).toEqual({ status: 'ok', voucherId: '0xnewvoucher' });
    expect(voucherSvc.issue).toHaveBeenCalledWith(
      DECODED,
      [PROGRAM_A, PROGRAM_B],
      VOUCHER_AMOUNT_VARA,
      VOUCHER_DURATION_SEC,
    );
  });

  it('returns the existing active voucher without adding funds', async () => {
    voucherSvc.getAnyVoucher.mockResolvedValue(makeVoucher());

    const result = await service.requestVoucher({ account: ACCOUNT, programs: [PROGRAM_A] }, IP);

    expect(result).toEqual({ status: 'ok', voucherId: '0xvoucher' });
    expect(voucherSvc.issue).not.toHaveBeenCalled();
  });

  it('appends missing programs to an active voucher without adding funds', async () => {
    const existing = makeVoucher({ programs: [PROGRAM_A] });
    voucherSvc.getAnyVoucher.mockResolvedValue(existing);

    const result = await service.requestVoucher(
      { account: ACCOUNT, programs: [PROGRAM_A, PROGRAM_B] },
      IP,
    );

    expect(result).toEqual({ status: 'ok', voucherId: '0xvoucher' });
    expect(voucherSvc.appendProgramsFreeOfCharge).toHaveBeenCalledWith(existing, [PROGRAM_B]);
    expect(voucherSvc.issue).not.toHaveBeenCalled();
  });

  it('rejects a second voucher after the original was revoked', async () => {
    voucherSvc.getAnyVoucher.mockResolvedValue(makeVoucher({ revoked: true }));

    await expect(
      service.requestVoucher({ account: ACCOUNT, programs: [PROGRAM_A] }, IP),
    ).rejects.toThrow(ConflictException);
    expect(voucherSvc.issue).not.toHaveBeenCalled();
  });

  it('rejects a fresh account when it already has outgoing transactions', async () => {
    voucherSvc.getNativeAccountState.mockResolvedValue({ balance: 0n, nonce: 1n });

    await expect(
      service.requestVoucher({ account: ACCOUNT, programs: [PROGRAM_A] }, IP),
    ).rejects.toThrow(ForbiddenException);
    expect(voucherSvc.issue).not.toHaveBeenCalled();
  });

  it('rejects a fresh account when native balance is above the configured threshold', async () => {
    voucherSvc.getNativeAccountState.mockResolvedValue({
      balance: BigInt(MAX_NATIVE_BALANCE_VARA) * PLANCK_PER_VARA + 1n,
      nonce: 0n,
    });

    await expect(
      service.requestVoucher({ account: ACCOUNT, programs: [PROGRAM_A] }, IP),
    ).rejects.toThrow(ForbiddenException);
    expect(voucherSvc.issue).not.toHaveBeenCalled();
  });

  it('enforces the per-IP daily voucher ceiling for fresh accounts', async () => {
    perIpVouchersPerDay = 2;
    await service.requestVoucher({ account: 'fresh1', programs: [PROGRAM_A] }, IP);
    await service.requestVoucher({ account: 'fresh2', programs: [PROGRAM_A] }, IP);

    const result = await service.requestVoucher(
      { account: 'fresh3', programs: [PROGRAM_A] },
      IP,
    );

    expect(result.status).toBe('rate_limited');
    if (result.status === 'rate_limited') {
      expect(result.body.message).toMatch(/Daily onboarding voucher ceiling/);
    }
  });

  it('throws 400 for invalid account address', async () => {
    await expect(
      service.requestVoucher({ account: 'invalid', programs: [PROGRAM_A] }, IP),
    ).rejects.toThrow(BadRequestException);
  });
});
