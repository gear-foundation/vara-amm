import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, Index as Index_, ManyToOne as ManyToOne_, StringColumn as StringColumn_, BigIntColumn as BigIntColumn_, DateTimeColumn as DateTimeColumn_, FloatColumn as FloatColumn_} from "@subsquid/typeorm-store"
import {TransactionType} from "./_transactionType"
import {Pair} from "./pair.model"

@Entity_()
export class Transaction {
    constructor(props?: Partial<Transaction>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @Column_("varchar", {length: 16, nullable: false})
    type!: TransactionType

    @Index_()
    @ManyToOne_(() => Pair, {nullable: true})
    pair!: Pair

    @Index_()
    @StringColumn_({nullable: false})
    user!: string

    @Index_()
    @BigIntColumn_({nullable: false})
    blockNumber!: bigint

    @Index_()
    @DateTimeColumn_({nullable: false})
    timestamp!: Date

    @BigIntColumn_({nullable: true})
    amountA!: bigint | undefined | null

    @BigIntColumn_({nullable: true})
    amountB!: bigint | undefined | null

    @BigIntColumn_({nullable: true})
    liquidity!: bigint | undefined | null

    @BigIntColumn_({nullable: true})
    amountIn!: bigint | undefined | null

    @BigIntColumn_({nullable: true})
    amountOut!: bigint | undefined | null

    @StringColumn_({nullable: true})
    tokenIn!: string | undefined | null

    @StringColumn_({nullable: true})
    tokenOut!: string | undefined | null

    @FloatColumn_({nullable: true})
    amountAUsd!: number | undefined | null

    @FloatColumn_({nullable: true})
    amountBUsd!: number | undefined | null

    @FloatColumn_({nullable: true})
    amountInUsd!: number | undefined | null

    @FloatColumn_({nullable: true})
    amountOutUsd!: number | undefined | null

    @FloatColumn_({nullable: true})
    valueUsd!: number | undefined | null
}
