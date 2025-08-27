module.exports = class AddVolumeOptimizations1756200000000 {
    name = 'AddVolumeOptimizations1756200000000'

    async up(db) {
        // Add new volume fields to Pair table
        await db.query(`ALTER TABLE "pair" ADD COLUMN "volume1h" numeric`)
        await db.query(`ALTER TABLE "pair" ADD COLUMN "volume30d" numeric`)
        await db.query(`ALTER TABLE "pair" ADD COLUMN "volume1y" numeric`)

        // Create PairVolumeSnapshot table
        await db.query(`CREATE TABLE "pair_volume_snapshot" (
            "id" character varying NOT NULL, 
            "interval" character varying(7) NOT NULL, 
            "volume_usd" numeric NOT NULL, 
            "transaction_count" integer NOT NULL, 
            "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL, 
            "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, 
            "pair_id" character varying, 
            CONSTRAINT "PK_pair_volume_snapshot" PRIMARY KEY ("id")
        )`)

        // Create indexes for efficient queries
        await db.query(`CREATE INDEX "IDX_pair_volume_snapshot_pair_id" ON "pair_volume_snapshot" ("pair_id")`)
        await db.query(`CREATE INDEX "IDX_pair_volume_snapshot_interval" ON "pair_volume_snapshot" ("interval")`)
        await db.query(`CREATE INDEX "IDX_pair_volume_snapshot_timestamp" ON "pair_volume_snapshot" ("timestamp")`)
        await db.query(`CREATE INDEX "IDX_pair_volume_snapshot_created_at" ON "pair_volume_snapshot" ("created_at")`)

        // Create composite index for efficient range queries
        await db.query(`CREATE INDEX "IDX_pair_volume_snapshot_pair_interval_timestamp" ON "pair_volume_snapshot" ("pair_id", "interval", "timestamp")`)

        // Add foreign key constraint
        await db.query(`ALTER TABLE "pair_volume_snapshot" ADD CONSTRAINT "FK_pair_volume_snapshot_pair_id" FOREIGN KEY ("pair_id") REFERENCES "pair"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`)
        
        // Create index for efficient queries on volume1h
        await db.query(`CREATE INDEX "IDX_pair_volume1h" ON "pair" ("volume1h")`)
    }

    async down(db) {
        // Drop index for volume1h
        await db.query(`DROP INDEX "IDX_pair_volume1h"`)
        
        // Drop foreign key constraint
        await db.query(`ALTER TABLE "pair_volume_snapshot" DROP CONSTRAINT "FK_pair_volume_snapshot_pair_id"`)

        // Drop indexes
        await db.query(`DROP INDEX "IDX_pair_volume_snapshot_pair_interval_timestamp"`)
        await db.query(`DROP INDEX "IDX_pair_volume_snapshot_created_at"`)
        await db.query(`DROP INDEX "IDX_pair_volume_snapshot_timestamp"`)
        await db.query(`DROP INDEX "IDX_pair_volume_snapshot_interval"`)
        await db.query(`DROP INDEX "IDX_pair_volume_snapshot_pair_id"`)

        // Drop table
        await db.query(`DROP TABLE "pair_volume_snapshot"`)

        // Remove new volume fields from Pair table
        await db.query(`ALTER TABLE "pair" DROP COLUMN "volume1y"`)
        await db.query(`ALTER TABLE "pair" DROP COLUMN "volume30d"`)
        await db.query(`ALTER TABLE "pair" DROP COLUMN "volume1h"`)
    }
}
