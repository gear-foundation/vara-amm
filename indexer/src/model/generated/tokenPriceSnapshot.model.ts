import {
  Entity as Entity_,
  Column as Column_,
  PrimaryColumn as PrimaryColumn_,
  ManyToOne as ManyToOne_,
  Index as Index_,
  FloatColumn as FloatColumn_,
  DateTimeColumn as DateTimeColumn_,
  BigIntColumn as BigIntColumn_,
} from "@subsquid/typeorm-store";
import { Token } from "./token.model";

@Entity_()
export class TokenPriceSnapshot {
  constructor(props?: Partial<TokenPriceSnapshot>) {
    Object.assign(this, props);
  }

  @PrimaryColumn_()
  id!: string;

  @Index_()
  @ManyToOne_(() => Token, { nullable: true })
  token!: Token;

  @FloatColumn_({ nullable: false })
  priceUsd!: number;

  @FloatColumn_({ nullable: true })
  fdv!: number | undefined | null;

  @FloatColumn_({ nullable: true })
  change1h!: number | undefined | null;

  @FloatColumn_({ nullable: true })
  change24h!: number | undefined | null;

  @Index_()
  @DateTimeColumn_({ nullable: false })
  timestamp!: Date;

  @Index_()
  @BigIntColumn_({ nullable: false })
  blockNumber!: bigint;
}
