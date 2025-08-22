/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class  $NAME1755680229685 {
    name = ' $NAME1755680229685'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "transaction" ("id" character varying NOT NULL, "type" character varying(16) NOT NULL, "user" text NOT NULL, "blockNumber" numeric NOT NULL, "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL, "amountA" numeric, "amountB" numeric, "liquidity" numeric, "amountIn" numeric, "amountOut" numeric, "tokenIn" text, "tokenOut" text, "pairId" character varying, CONSTRAINT "PK_89eadb93a89810556e1cbcd6ab9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_cce9f3db01ff7df5db4d337869" ON "transaction" ("type") `);
        await queryRunner.query(`CREATE INDEX "IDX_a3ef237837b7763dae293e465a" ON "transaction" ("pairId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1b1623f9a2de73adfc5e78ca51" ON "transaction" ("user") `);
        await queryRunner.query(`CREATE INDEX "IDX_b39efec8ac50249f9bd91bdbf3" ON "transaction" ("blockNumber") `);
        await queryRunner.query(`CREATE INDEX "IDX_87f2932d4a558d44a2915f849a" ON "transaction" ("timestamp") `);
        await queryRunner.query(`CREATE TABLE "pair" ("id" character varying NOT NULL, "token0" text NOT NULL, "token1" text NOT NULL, "token0Symbol" text, "token1Symbol" text, "reserve0" numeric NOT NULL, "reserve1" numeric NOT NULL, "totalSupply" numeric NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_3eaf216329c5c50aedb94fa797e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_750e22204daa7f64f144187a76" ON "pair" ("token0") `);
        await queryRunner.query(`CREATE INDEX "IDX_c4f41f20b6f10e5c4066d45f08" ON "pair" ("token1") `);
        await queryRunner.query(`CREATE INDEX "IDX_395db84e5369ffb3cf3121b301" ON "pair" ("createdAt") `);
        await queryRunner.query(`ALTER TABLE "transaction" ADD CONSTRAINT "FK_a3ef237837b7763dae293e465a3" FOREIGN KEY ("pairId") REFERENCES "pair"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "transaction" DROP CONSTRAINT "FK_a3ef237837b7763dae293e465a3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_395db84e5369ffb3cf3121b301"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c4f41f20b6f10e5c4066d45f08"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_750e22204daa7f64f144187a76"`);
        await queryRunner.query(`DROP TABLE "pair"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_87f2932d4a558d44a2915f849a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b39efec8ac50249f9bd91bdbf3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1b1623f9a2de73adfc5e78ca51"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a3ef237837b7763dae293e465a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cce9f3db01ff7df5db4d337869"`);
        await queryRunner.query(`DROP TABLE "transaction"`);
    }
}
