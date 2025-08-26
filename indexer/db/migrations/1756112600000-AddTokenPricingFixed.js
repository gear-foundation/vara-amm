/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class AddTokenPricingFixed1756112600000 {
    name = 'AddTokenPricingFixed1756112600000'

    async up(queryRunner) {
        // Check if token table exists, if not create it
        const tokenTableExists = await queryRunner.hasTable("token");
        if (!tokenTableExists) {
            await queryRunner.query(`CREATE TABLE "token" ("id" character varying NOT NULL, "symbol" text NOT NULL, "name" text, "decimals" integer NOT NULL, "total_supply" numeric, "price_usd" numeric, "volume24h" numeric, "volume7d" numeric, "volume30d" numeric, "fdv" numeric, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_82fae97f905930df5d62a702fc9" PRIMARY KEY ("id"))`);
            await queryRunner.query(`CREATE INDEX "IDX_95d4beb28c1702ce48aa7f55e3" ON "token" ("created_at") `);
            await queryRunner.query(`CREATE INDEX "IDX_a6bb882b22a8299c9861615d14" ON "token" ("updated_at") `);
        }
        
        // Check if token_price_snapshot table exists, if not create it
        const snapshotTableExists = await queryRunner.hasTable("token_price_snapshot");
        if (!snapshotTableExists) {
            await queryRunner.query(`CREATE TABLE "token_price_snapshot" ("id" character varying NOT NULL, "price_usd" numeric NOT NULL, "volume1h" numeric, "volume24h" numeric, "volume7d" numeric, "volume30d" numeric, "volume1y" numeric, "change1h" numeric, "change24h" numeric, "change7d" numeric, "change30d" numeric, "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL, "block_number" numeric NOT NULL, "token_id" character varying, CONSTRAINT "PK_394b30632e9dd0fafc1404d5413" PRIMARY KEY ("id"))`);
            await queryRunner.query(`CREATE INDEX "IDX_4ca4775fee31a10ab73b2acf2a" ON "token_price_snapshot" ("token_id") `);
            await queryRunner.query(`CREATE INDEX "IDX_bb8fe7c6e487f389942c773ef7" ON "token_price_snapshot" ("timestamp") `);
            await queryRunner.query(`CREATE INDEX "IDX_c6965633e42a5046488d235891" ON "token_price_snapshot" ("block_number") `);
            
            // Add foreign key constraint
            await queryRunner.query(`ALTER TABLE "token_price_snapshot" ADD CONSTRAINT "FK_4ca4775fee31a10ab73b2acf2a8" FOREIGN KEY ("token_id") REFERENCES "token"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        }
        
        // Add USD columns to transaction table (check if they don't exist)
        const transactionColumns = await queryRunner.getTable("transaction");
        if (!transactionColumns.findColumnByName("amount_a_usd")) {
            await queryRunner.query(`ALTER TABLE "transaction" ADD "amount_a_usd" numeric`);
        }
        if (!transactionColumns.findColumnByName("amount_b_usd")) {
            await queryRunner.query(`ALTER TABLE "transaction" ADD "amount_b_usd" numeric`);
        }
        if (!transactionColumns.findColumnByName("amount_in_usd")) {
            await queryRunner.query(`ALTER TABLE "transaction" ADD "amount_in_usd" numeric`);
        }
        if (!transactionColumns.findColumnByName("amount_out_usd")) {
            await queryRunner.query(`ALTER TABLE "transaction" ADD "amount_out_usd" numeric`);
        }
        if (!transactionColumns.findColumnByName("value_usd")) {
            await queryRunner.query(`ALTER TABLE "transaction" ADD "value_usd" numeric`);
        }
        
        // Add volume and TVL columns to pair table (check if they don't exist)
        const pairColumns = await queryRunner.getTable("pair");
        if (!pairColumns.findColumnByName("volume_usd")) {
            await queryRunner.query(`ALTER TABLE "pair" ADD "volume_usd" numeric`);
        }
        if (!pairColumns.findColumnByName("volume24h")) {
            await queryRunner.query(`ALTER TABLE "pair" ADD "volume24h" numeric`);
        }
        if (!pairColumns.findColumnByName("volume7d")) {
            await queryRunner.query(`ALTER TABLE "pair" ADD "volume7d" numeric`);
        }
        if (!pairColumns.findColumnByName("tvl_usd")) {
            await queryRunner.query(`ALTER TABLE "pair" ADD "tvl_usd" numeric`);
        }
        
        // Add updated_at column to pair table (with proper NULL handling)
        if (!pairColumns.findColumnByName("updated_at")) {
            await queryRunner.query(`ALTER TABLE "pair" ADD "updated_at" TIMESTAMP WITH TIME ZONE`);
            // Set default value for existing records (use created_at if available, otherwise current timestamp)
            await queryRunner.query(`UPDATE "pair" SET "updated_at" = COALESCE("created_at", NOW()) WHERE "updated_at" IS NULL`);
            // Now make it NOT NULL
            await queryRunner.query(`ALTER TABLE "pair" ALTER COLUMN "updated_at" SET NOT NULL`);
            await queryRunner.query(`CREATE INDEX "IDX_2c895bc0145348c7c80b54748a" ON "pair" ("updated_at") `);
        }
    }

    async down(queryRunner) {
        // Remove foreign key constraint
        await queryRunner.query(`ALTER TABLE "token_price_snapshot" DROP CONSTRAINT "FK_4ca4775fee31a10ab73b2acf2a8"`);
        
        // Drop pair columns
        await queryRunner.query(`DROP INDEX "public"."IDX_2c895bc0145348c7c80b54748a"`);
        await queryRunner.query(`ALTER TABLE "pair" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "pair" DROP COLUMN "tvl_usd"`);
        await queryRunner.query(`ALTER TABLE "pair" DROP COLUMN "volume7d"`);
        await queryRunner.query(`ALTER TABLE "pair" DROP COLUMN "volume24h"`);
        await queryRunner.query(`ALTER TABLE "pair" DROP COLUMN "volume_usd"`);
        
        // Drop transaction columns
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "value_usd"`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "amount_out_usd"`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "amount_in_usd"`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "amount_b_usd"`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "amount_a_usd"`);
        
        // Drop token_price_snapshot table
        await queryRunner.query(`DROP INDEX "public"."IDX_c6965633e42a5046488d235891"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bb8fe7c6e487f389942c773ef7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4ca4775fee31a10ab73b2acf2a"`);
        await queryRunner.query(`DROP TABLE "token_price_snapshot"`);
        
        // Drop token table
        await queryRunner.query(`DROP INDEX "public"."IDX_a6bb882b22a8299c9861615d14"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_95d4beb28c1702ce48aa7f55e3"`);
        await queryRunner.query(`DROP TABLE "token"`);
    }
}
