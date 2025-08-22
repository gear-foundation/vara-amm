import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, Index as Index_, BigIntColumn as BigIntColumn_, DateTimeColumn as DateTimeColumn_, OneToMany as OneToMany_} from "@subsquid/typeorm-store"
import {Transaction} from "./transaction.model"

@Entity_()
export class Pair {
    constructor(props?: Partial<Pair>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @StringColumn_({nullable: false})
    token0!: string

    @Index_()
    @StringColumn_({nullable: false})
    token1!: string

    @StringColumn_({nullable: true})
    token0Symbol!: string | undefined | null

    @StringColumn_({nullable: true})
    token1Symbol!: string | undefined | null

    @BigIntColumn_({nullable: false})
    reserve0!: bigint

    @BigIntColumn_({nullable: false})
    reserve1!: bigint

    @BigIntColumn_({nullable: false})
    totalSupply!: bigint

    @Index_()
    @DateTimeColumn_({nullable: false})
    createdAt!: Date

    @OneToMany_(() => Transaction, e => e.pair)
    transactions!: Transaction[]
}
