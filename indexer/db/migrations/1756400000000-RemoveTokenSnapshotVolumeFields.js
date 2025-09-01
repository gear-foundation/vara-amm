module.exports = class RemoveTokenSnapshotVolumeFields1756400000000 {
    name = 'RemoveTokenSnapshotVolumeFields1756400000000'

    async up(db) {
        await db.query(`ALTER TABLE "token_price_snapshot" DROP COLUMN IF EXISTS "volume1h"`)
        await db.query(`ALTER TABLE "token_price_snapshot" DROP COLUMN IF EXISTS "volume24h"`)
        await db.query(`ALTER TABLE "token_price_snapshot" DROP COLUMN IF EXISTS "volume7d"`)
        await db.query(`ALTER TABLE "token_price_snapshot" DROP COLUMN IF EXISTS "volume30d"`)
        await db.query(`ALTER TABLE "token_price_snapshot" DROP COLUMN IF EXISTS "volume1y"`)
    }

    async down(db) {
        await db.query(`ALTER TABLE "token_price_snapshot" ADD COLUMN "volume1h" numeric`)
        await db.query(`ALTER TABLE "token_price_snapshot" ADD COLUMN "volume24h" numeric`)
        await db.query(`ALTER TABLE "token_price_snapshot" ADD COLUMN "volume7d" numeric`)
        await db.query(`ALTER TABLE "token_price_snapshot" ADD COLUMN "volume30d" numeric`)
        await db.query(`ALTER TABLE "token_price_snapshot" ADD COLUMN "volume1y" numeric`)
    }
}
