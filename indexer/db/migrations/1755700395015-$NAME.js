/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class  $NAME1755700395015 {
    name = ' $NAME1755700395015'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "transaction" DROP CONSTRAINT "FK_a3ef237837b7763dae293e465a3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a3ef237837b7763dae293e465a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b39efec8ac50249f9bd91bdbf3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_395db84e5369ffb3cf3121b301"`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "blockNumber"`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "amountA"`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "amountB"`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "amountIn"`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "amountOut"`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "tokenIn"`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "tokenOut"`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "pairId"`);
        await queryRunner.query(`ALTER TABLE "pair" DROP COLUMN "token0Symbol"`);
        await queryRunner.query(`ALTER TABLE "pair" DROP COLUMN "token1Symbol"`);
        await queryRunner.query(`ALTER TABLE "pair" DROP COLUMN "totalSupply"`);
        await queryRunner.query(`ALTER TABLE "pair" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "transaction" ADD "block_number" numeric NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transaction" ADD "amount_a" numeric`);
        await queryRunner.query(`ALTER TABLE "transaction" ADD "amount_b" numeric`);
        await queryRunner.query(`ALTER TABLE "transaction" ADD "amount_in" numeric`);
        await queryRunner.query(`ALTER TABLE "transaction" ADD "amount_out" numeric`);
        await queryRunner.query(`ALTER TABLE "transaction" ADD "token_in" text`);
        await queryRunner.query(`ALTER TABLE "transaction" ADD "token_out" text`);
        await queryRunner.query(`ALTER TABLE "transaction" ADD "pair_id" character varying`);
        await queryRunner.query(`ALTER TABLE "pair" ADD "token0_symbol" text`);
        await queryRunner.query(`ALTER TABLE "pair" ADD "token1_symbol" text`);
        await queryRunner.query(`ALTER TABLE "pair" ADD "total_supply" numeric NOT NULL`);
        await queryRunner.query(`ALTER TABLE "pair" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_85120cbd934638c965d3a9bd27" ON "transaction" ("pair_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_2d99bb5a0ab5fb8cf8b746eb39" ON "transaction" ("block_number") `);
        await queryRunner.query(`CREATE INDEX "IDX_45a50b5341f8c6f36d6710e15f" ON "pair" ("created_at") `);
        await queryRunner.query(`ALTER TABLE "transaction" ADD CONSTRAINT "FK_85120cbd934638c965d3a9bd271" FOREIGN KEY ("pair_id") REFERENCES "pair"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "transaction" DROP CONSTRAINT "FK_85120cbd934638c965d3a9bd271"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_45a50b5341f8c6f36d6710e15f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2d99bb5a0ab5fb8cf8b746eb39"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_85120cbd934638c965d3a9bd27"`);
        await queryRunner.query(`ALTER TABLE "pair" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "pair" DROP COLUMN "total_supply"`);
        await queryRunner.query(`ALTER TABLE "pair" DROP COLUMN "token1_symbol"`);
        await queryRunner.query(`ALTER TABLE "pair" DROP COLUMN "token0_symbol"`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "pair_id"`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "token_out"`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "token_in"`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "amount_out"`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "amount_in"`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "amount_b"`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "amount_a"`);
        await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "block_number"`);
        await queryRunner.query(`ALTER TABLE "pair" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL`);
        await queryRunner.query(`ALTER TABLE "pair" ADD "totalSupply" numeric NOT NULL`);
        await queryRunner.query(`ALTER TABLE "pair" ADD "token1Symbol" text`);
        await queryRunner.query(`ALTER TABLE "pair" ADD "token0Symbol" text`);
        await queryRunner.query(`ALTER TABLE "transaction" ADD "pairId" character varying`);
        await queryRunner.query(`ALTER TABLE "transaction" ADD "tokenOut" text`);
        await queryRunner.query(`ALTER TABLE "transaction" ADD "tokenIn" text`);
        await queryRunner.query(`ALTER TABLE "transaction" ADD "amountOut" numeric`);
        await queryRunner.query(`ALTER TABLE "transaction" ADD "amountIn" numeric`);
        await queryRunner.query(`ALTER TABLE "transaction" ADD "amountB" numeric`);
        await queryRunner.query(`ALTER TABLE "transaction" ADD "amountA" numeric`);
        await queryRunner.query(`ALTER TABLE "transaction" ADD "blockNumber" numeric NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_395db84e5369ffb3cf3121b301" ON "pair" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_b39efec8ac50249f9bd91bdbf3" ON "transaction" ("blockNumber") `);
        await queryRunner.query(`CREATE INDEX "IDX_a3ef237837b7763dae293e465a" ON "transaction" ("pairId") `);
        await queryRunner.query(`ALTER TABLE "transaction" ADD CONSTRAINT "FK_a3ef237837b7763dae293e465a3" FOREIGN KEY ("pairId") REFERENCES "pair"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }
}
