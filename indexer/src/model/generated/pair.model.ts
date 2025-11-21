import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, Index as Index_, BigIntColumn as BigIntColumn_, FloatColumn as FloatColumn_, DateTimeColumn as DateTimeColumn_, BooleanColumn as BooleanColumn_, OneToMany as OneToMany_} from "@subsquid/typeorm-store"
import {Transaction} from "./transaction.model"
import {PairVolumeSnapshot} from "./pairVolumeSnapshot.model"

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

    @FloatColumn_({nullable: true})
    volumeUsd!: number | undefined | null

    @FloatColumn_({nullable: true})
    volume1h!: number | undefined | null

    @FloatColumn_({nullable: true})
    volume24h!: number | undefined | null

    @FloatColumn_({nullable: true})
    volume7d!: number | undefined | null

    @FloatColumn_({nullable: true})
    volume30d!: number | undefined | null

    @FloatColumn_({nullable: true})
    volume1y!: number | undefined | null

    @FloatColumn_({nullable: true})
    tvlUsd!: number | undefined | null

    @Index_()
    @BooleanColumn_({nullable: false})
    isActive!: boolean

    @Index_()
    @DateTimeColumn_({nullable: false})
    createdAt!: Date

    @Index_()
    @DateTimeColumn_({nullable: false})
    updatedAt!: Date

    @OneToMany_(() => Transaction, e => e.pair)
    transactions!: Transaction[]

    @OneToMany_(() => PairVolumeSnapshot, e => e.pair)
    volumeSnapshots!: PairVolumeSnapshot[]
}
