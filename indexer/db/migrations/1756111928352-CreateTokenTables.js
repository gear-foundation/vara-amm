/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class CreateTokenTables1756111928352 {
    name = 'CreateTokenTables1756111928352'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "token" ("id" character varying NOT NULL, "symbol" character varying NOT NULL, "name" character varying, "decimals" integer NOT NULL, "total_supply" numeric, "price_usd" numeric, "volume24h" numeric, "volume7d" numeric, "volume30d" numeric, "fdv" numeric, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_82fae97f905930df5d62a373e5d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c4b5c6e8d5c9e5b7b3b3b3b3b3" ON "token" ("created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_c4b5c6e8d5c9e5b7b3b3b3b3b4" ON "token" ("updated_at") `);
        
        await queryRunner.query(`CREATE TABLE "token_price_snapshot" ("id" character varying NOT NULL, "price_usd" numeric NOT NULL, "volume1h" numeric, "volume24h" numeric, "volume7d" numeric, "volume30d" numeric, "volume1y" numeric, "change1h" numeric, "change24h" numeric, "change7d" numeric, "change30d" numeric, "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL, "block_number" numeric NOT NULL, "token_id" character varying, CONSTRAINT "PK_token_price_snapshot_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_token_price_snapshot_token_id" ON "token_price_snapshot" ("token_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_token_price_snapshot_timestamp" ON "token_price_snapshot" ("timestamp") `);
        await queryRunner.query(`CREATE INDEX "IDX_token_price_snapshot_block_number" ON "token_price_snapshot" ("block_number") `);
        
        await queryRunner.query(`ALTER TABLE "token_price_snapshot" ADD CONSTRAINT "FK_token_price_snapshot_token" FOREIGN KEY ("token_id") REFERENCES "token"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "token_price_snapshot" DROP CONSTRAINT "FK_token_price_snapshot_token"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_token_price_snapshot_block_number"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_token_price_snapshot_timestamp"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_token_price_snapshot_token_id"`);
        await queryRunner.query(`DROP TABLE "token_price_snapshot"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c4b5c6e8d5c9e5b7b3b3b3b3b4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c4b5c6e8d5c9e5b7b3b3b3b3b3"`);
        await queryRunner.query(`DROP TABLE "token"`);
    }
}
