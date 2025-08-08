/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class  $NAME1754647538930 {
    name = ' $NAME1754647538930'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "vft_transfer" DROP CONSTRAINT "FK_f002c2573fd0e57a7e67cef67cc"`);
        await queryRunner.query(`ALTER TABLE "vft_transfer" DROP CONSTRAINT "FK_8a1f74adfaa716a5227a29f668d"`);
        await queryRunner.query(`ALTER TABLE "vft_transfer" DROP COLUMN "fromId"`);
        await queryRunner.query(`ALTER TABLE "vft_transfer" DROP COLUMN "toId"`);
        await queryRunner.query(`ALTER TABLE "vft_transfer" ADD "from" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "vft_transfer" ADD "to" text NOT NULL`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "vft_transfer" DROP COLUMN "to"`);
        await queryRunner.query(`ALTER TABLE "vft_transfer" DROP COLUMN "from"`);
        await queryRunner.query(`ALTER TABLE "vft_transfer" ADD "toId" character varying`);
        await queryRunner.query(`ALTER TABLE "vft_transfer" ADD "fromId" character varying`);
        await queryRunner.query(`ALTER TABLE "vft_transfer" ADD CONSTRAINT "FK_8a1f74adfaa716a5227a29f668d" FOREIGN KEY ("toId") REFERENCES "account"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vft_transfer" ADD CONSTRAINT "FK_f002c2573fd0e57a7e67cef67cc" FOREIGN KEY ("fromId") REFERENCES "account"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }
}
