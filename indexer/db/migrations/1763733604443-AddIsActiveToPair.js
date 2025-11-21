/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class  AddIsActiveToPair1763733604443 {
    name = 'AddIsActiveToPair1763733604443'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "pair" ADD "is_active" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`CREATE INDEX "IDX_3b88ea7c1e2112290f822540fd" ON "pair" ("is_active") `);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX "public"."IDX_3b88ea7c1e2112290f822540fd"`);
        await queryRunner.query(`ALTER TABLE "pair" DROP COLUMN "is_active"`);
    }
}
