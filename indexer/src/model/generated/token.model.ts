import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, IntColumn as IntColumn_, BigIntColumn as BigIntColumn_, FloatColumn as FloatColumn_, OneToMany as OneToMany_, DateTimeColumn as DateTimeColumn_, Index as Index_} from "@subsquid/typeorm-store"
import {TokenPriceSnapshot} from "./tokenPriceSnapshot.model"

@Entity_()
export class Token {
    constructor(props?: Partial<Token>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @StringColumn_({nullable: false})
    symbol!: string

    @StringColumn_({nullable: true})
    name!: string | undefined | null

    @IntColumn_({nullable: false})
    decimals!: number

    @BigIntColumn_({nullable: true})
    totalSupply!: bigint | undefined | null

    @OneToMany_(() => TokenPriceSnapshot, e => e.token)
    priceHistory!: TokenPriceSnapshot[]

    @Index_()
    @DateTimeColumn_({nullable: false})
    createdAt!: Date

    @Index_()
    @DateTimeColumn_({nullable: false})
    updatedAt!: Date
}
