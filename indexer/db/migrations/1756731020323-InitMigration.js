/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class InitMigration1756731020323 {
  name = "InitMigration1756731020323";

  async up(queryRunner) {
    await queryRunner.query(
      `CREATE TABLE "token_price_snapshot" ("id" character varying NOT NULL, "price_usd" numeric NOT NULL, "fdv" numeric, "change1h" numeric, "change24h" numeric, "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL, "block_number" numeric NOT NULL, "token_id" character varying, CONSTRAINT "PK_394b30632e9dd0fafc1404d5413" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4ca4775fee31a10ab73b2acf2a" ON "token_price_snapshot" ("token_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bb8fe7c6e487f389942c773ef7" ON "token_price_snapshot" ("timestamp") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c6965633e42a5046488d235891" ON "token_price_snapshot" ("block_number") `
    );
    await queryRunner.query(
      `CREATE TABLE "token" ("id" character varying NOT NULL, "symbol" text NOT NULL, "name" text, "decimals" integer NOT NULL, "total_supply" numeric, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_82fae97f905930df5d62a702fc9" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_95d4beb28c1702ce48aa7f55e3" ON "token" ("created_at") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a6bb882b22a8299c9861615d14" ON "token" ("updated_at") `
    );
    await queryRunner.query(
      `CREATE TABLE "transaction" ("id" character varying NOT NULL, "type" character varying(16) NOT NULL, "user" text NOT NULL, "block_number" numeric NOT NULL, "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL, "amount_a" numeric, "amount_b" numeric, "liquidity" numeric, "amount_in" numeric, "amount_out" numeric, "token_in" text, "token_out" text, "amount_a_usd" numeric, "amount_b_usd" numeric, "amount_in_usd" numeric, "amount_out_usd" numeric, "value_usd" numeric, "pair_id" character varying, CONSTRAINT "PK_89eadb93a89810556e1cbcd6ab9" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cce9f3db01ff7df5db4d337869" ON "transaction" ("type") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_85120cbd934638c965d3a9bd27" ON "transaction" ("pair_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1b1623f9a2de73adfc5e78ca51" ON "transaction" ("user") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2d99bb5a0ab5fb8cf8b746eb39" ON "transaction" ("block_number") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_87f2932d4a558d44a2915f849a" ON "transaction" ("timestamp") `
    );
    await queryRunner.query(
      `CREATE TABLE "pair_volume_snapshot" ("id" character varying NOT NULL, "interval" character varying(7) NOT NULL, "volume_usd" numeric NOT NULL, "transaction_count" integer NOT NULL, "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "pair_id" character varying, CONSTRAINT "PK_79f780bbdffd0deecd0dd4d91e7" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2e027f22cb9dcc1b4d8d007d28" ON "pair_volume_snapshot" ("pair_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_056d7d01dbfcfe253d15be3b14" ON "pair_volume_snapshot" ("interval") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9a9a654d2c2faa0fed0f6360f6" ON "pair_volume_snapshot" ("timestamp") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f06f076d4c328258a9c3f3592a" ON "pair_volume_snapshot" ("created_at") `
    );
    await queryRunner.query(
      `CREATE TABLE "pair" ("id" character varying NOT NULL, "token0" text NOT NULL, "token1" text NOT NULL, "token0_symbol" text, "token1_symbol" text, "reserve0" numeric NOT NULL, "reserve1" numeric NOT NULL, "total_supply" numeric NOT NULL, "volume_usd" numeric, "volume1h" numeric, "volume24h" numeric, "volume7d" numeric, "volume30d" numeric, "volume1y" numeric, "tvl_usd" numeric, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_3eaf216329c5c50aedb94fa797e" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_750e22204daa7f64f144187a76" ON "pair" ("token0") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c4f41f20b6f10e5c4066d45f08" ON "pair" ("token1") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_45a50b5341f8c6f36d6710e15f" ON "pair" ("created_at") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2c895bc0145348c7c80b54748a" ON "pair" ("updated_at") `
    );
    await queryRunner.query(
      `ALTER TABLE "token_price_snapshot" ADD CONSTRAINT "FK_4ca4775fee31a10ab73b2acf2a8" FOREIGN KEY ("token_id") REFERENCES "token"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "transaction" ADD CONSTRAINT "FK_85120cbd934638c965d3a9bd271" FOREIGN KEY ("pair_id") REFERENCES "pair"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "pair_volume_snapshot" ADD CONSTRAINT "FK_2e027f22cb9dcc1b4d8d007d287" FOREIGN KEY ("pair_id") REFERENCES "pair"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  async down(queryRunner) {
    await queryRunner.query(
      `ALTER TABLE "pair_volume_snapshot" DROP CONSTRAINT "FK_2e027f22cb9dcc1b4d8d007d287"`
    );
    await queryRunner.query(
      `ALTER TABLE "transaction" DROP CONSTRAINT "FK_85120cbd934638c965d3a9bd271"`
    );
    await queryRunner.query(
      `ALTER TABLE "token_price_snapshot" DROP CONSTRAINT "FK_4ca4775fee31a10ab73b2acf2a8"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2c895bc0145348c7c80b54748a"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_45a50b5341f8c6f36d6710e15f"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c4f41f20b6f10e5c4066d45f08"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_750e22204daa7f64f144187a76"`
    );
    await queryRunner.query(`DROP TABLE "pair"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f06f076d4c328258a9c3f3592a"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9a9a654d2c2faa0fed0f6360f6"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_056d7d01dbfcfe253d15be3b14"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2e027f22cb9dcc1b4d8d007d28"`
    );
    await queryRunner.query(`DROP TABLE "pair_volume_snapshot"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_87f2932d4a558d44a2915f849a"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2d99bb5a0ab5fb8cf8b746eb39"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1b1623f9a2de73adfc5e78ca51"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_85120cbd934638c965d3a9bd27"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cce9f3db01ff7df5db4d337869"`
    );
    await queryRunner.query(`DROP TABLE "transaction"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a6bb882b22a8299c9861615d14"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_95d4beb28c1702ce48aa7f55e3"`
    );
    await queryRunner.query(`DROP TABLE "token"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c6965633e42a5046488d235891"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bb8fe7c6e487f389942c773ef7"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4ca4775fee31a10ab73b2acf2a"`
    );
    await queryRunner.query(`DROP TABLE "token_price_snapshot"`);
  }
};
