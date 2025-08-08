/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class  $NAME1754490405703 {
    name = ' $NAME1754490405703'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "vft_transfer" ("id" character varying NOT NULL, "block_number" bigint NOT NULL, "timestamp" TIMESTAMP NOT NULL, "extrinsic_hash" character varying, "amount" bigint NOT NULL, "fee" bigint NOT NULL, "fromId" character varying, "toId" character varying, CONSTRAINT "PK_09db29edc9e8705b61dcb499ce0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "account" ("id" character varying NOT NULL, CONSTRAINT "PK_54115ee388cdb6d86bb4bf5b2ea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "vft_transfer" ADD CONSTRAINT "FK_f002c2573fd0e57a7e67cef67cc" FOREIGN KEY ("fromId") REFERENCES "account"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vft_transfer" ADD CONSTRAINT "FK_8a1f74adfaa716a5227a29f668d" FOREIGN KEY ("toId") REFERENCES "account"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "vft_transfer" DROP CONSTRAINT "FK_8a1f74adfaa716a5227a29f668d"`);
        await queryRunner.query(`ALTER TABLE "vft_transfer" DROP CONSTRAINT "FK_f002c2573fd0e57a7e67cef67cc"`);
        await queryRunner.query(`DROP TABLE "account"`);
        await queryRunner.query(`DROP TABLE "vft_transfer"`);
    }
}
