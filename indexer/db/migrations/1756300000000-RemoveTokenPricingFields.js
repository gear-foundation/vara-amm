/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * Migration to remove pricing fields from Token table since they are now stored in TokenPriceSnapshot
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class RemoveTokenPricingFields1756300000000 {
    name = 'RemoveTokenPricingFields1756300000000'

    async up(queryRunner) {
        // Check if token table exists and has the pricing fields
        const tokenTable = await queryRunner.getTable("token");
        
        if (tokenTable) {
            // Remove pricing fields from token table as they are now stored in token_price_snapshot
            const fieldsToRemove = ["price_usd", "volume24h", "volume7d", "volume30d", "fdv"];
            
            for (const field of fieldsToRemove) {
                const column = tokenTable.findColumnByName(field);
                if (column) {
                    await queryRunner.query(`ALTER TABLE "token" DROP COLUMN "${field}"`);
                }
            }
        }
        
        // Ensure TokenPriceSnapshot table has the fdv field (if not already added)
        const snapshotTable = await queryRunner.getTable("token_price_snapshot");
        if (snapshotTable && !snapshotTable.findColumnByName("fdv")) {
            await queryRunner.query(`ALTER TABLE "token_price_snapshot" ADD "fdv" numeric`);
        }
    }

    async down(queryRunner) {
        // Re-add the pricing fields to token table
        const tokenTable = await queryRunner.getTable("token");
        
        if (tokenTable) {
            const fieldsToAdd = [
                { name: "price_usd", type: "numeric" },
                { name: "volume24h", type: "numeric" },
                { name: "volume7d", type: "numeric" },
                { name: "volume30d", type: "numeric" },
                { name: "fdv", type: "numeric" }
            ];
            
            for (const field of fieldsToAdd) {
                const column = tokenTable.findColumnByName(field.name);
                if (!column) {
                    await queryRunner.query(`ALTER TABLE "token" ADD "${field.name}" ${field.type}`);
                }
            }
        }
        
        // Remove fdv field from token_price_snapshot if it was added by this migration
        const snapshotTable = await queryRunner.getTable("token_price_snapshot");
        if (snapshotTable) {
            const fdvColumn = snapshotTable.findColumnByName("fdv");
            if (fdvColumn) {
                await queryRunner.query(`ALTER TABLE "token_price_snapshot" DROP COLUMN "fdv"`);
            }
        }
    }
}
