import { Column, Entity, PrimaryColumn } from "typeorm";
import { StringColumn } from "@subsquid/typeorm-store";

// !Always specify name of the entity in snake_case!
@Entity({ name: "vft_transfer" })
export class VftTransfer {
  constructor(props: Partial<VftTransfer>) {
    Object.assign(this, props);
  }

  @PrimaryColumn()
  id: string;

  @Column("bigint", { name: "block_number" })
  blockNumber: bigint;

  @Column("timestamp", { name: "timestamp" })
  timestamp: Date;

  @Column({ name: "extrinsic_hash", nullable: true })
  extrinsicHash?: string;

  @StringColumn({ name: "from" })
  from: string;

  @StringColumn({ name: "to" })
  to: string;

  @Column("bigint")
  amount: bigint;

  @Column("bigint")
  fee: bigint;
}
