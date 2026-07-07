import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import {
  GaslessProgram,
  GaslessProgramStatus,
} from './entities/gasless-program.entity';
import { Voucher } from './entities/voucher.entity';
import { IpTrancheUsage } from './entities/ip-tranche-usage.entity';

config();

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value.toLowerCase();
};

const voucherAmountVara = Number(process.env.VOUCHER_AMOUNT_VARA || '10');

const PROGRAMS = [
  {
    name: 'vUSDT',
    address: required('VUSDT_TOKEN_PROGRAM_ID'),
  },
  {
    name: 'vUSDT/VARA Pair',
    address: required('VUSDT_VARA_PAIR_PROGRAM_ID'),
  },
  {
    name: 'VARA Native Exchange',
    address: required('VARA_TOKEN_PROGRAM_ID'),
  },
];

async function seed() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [GaslessProgram, Voucher, IpTrancheUsage],
    synchronize: true,
  });

  await ds.initialize();
  const repo = ds.getRepository(GaslessProgram);

  console.log(`[seed-config] VOUCHER_AMOUNT_VARA=${voucherAmountVara}`);

  for (const program of PROGRAMS) {
    const existing = await repo.findOneBy({ address: program.address });
    if (existing) {
      existing.name = program.name;
      existing.varaToIssue = voucherAmountVara;
      existing.weight = 1;
      existing.duration = Number(process.env.VOUCHER_DURATION_SEC || '86400');
      existing.status = GaslessProgramStatus.Enabled;
      existing.oneTime = true;
      await repo.save(existing);
      console.log(`[update] ${program.name} ${program.address.slice(0, 12)}...`);
      continue;
    }

    await repo.save({
      name: program.name,
      address: program.address,
      varaToIssue: voucherAmountVara,
      weight: 1,
      duration: Number(process.env.VOUCHER_DURATION_SEC || '86400'),
      status: GaslessProgramStatus.Enabled,
      oneTime: true,
      createdAt: new Date(),
    });
    console.log(`[seed] ${program.name} ${program.address.slice(0, 12)}...`);
  }

  console.log('Seed complete.');
  await ds.destroy();
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
