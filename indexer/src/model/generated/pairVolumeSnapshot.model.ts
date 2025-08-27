import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, FloatColumn as FloatColumn_, IntColumn as IntColumn_, DateTimeColumn as DateTimeColumn_} from "@subsquid/typeorm-store"
import {Pair} from "./pair.model"
import {VolumeInterval} from "./_volumeInterval"

@Entity_()
export class PairVolumeSnapshot {
    constructor(props?: Partial<PairVolumeSnapshot>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => Pair, {nullable: true})
    pair!: Pair

    @Index_()
    @Column_("varchar", {length: 7, nullable: false})
    interval!: VolumeInterval

    @FloatColumn_({nullable: false})
    volumeUsd!: number

    @IntColumn_({nullable: false})
    transactionCount!: number

    @Index_()
    @DateTimeColumn_({nullable: false})
    timestamp!: Date

    @Index_()
    @DateTimeColumn_({nullable: false})
    createdAt!: Date
}
