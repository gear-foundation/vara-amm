import { DataSource } from "typeorm";
import { DefaultNamingStrategy } from "typeorm";
import dotenv from "dotenv";
import { Pair, Token, TokenPriceSnapshot, Transaction, PairVolumeSnapshot } from "./generated";

class SnakeNamingStrategy extends DefaultNamingStrategy {
  columnName(
    propertyName: string,
    customName?: string,
    embeddedPrefixes: string[] = []
  ): string {
    const defaultName = super.columnName(
      propertyName,
      customName,
      embeddedPrefixes
    );
    const snakeCasedName = defaultName.replace(/([A-Z])/g, "_$1").toLowerCase();
    return snakeCasedName;
  }
}

dotenv.config();

const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASS || "postgres",
  database: process.env.DB_NAME || "gear_monitoring",
  synchronize: false,
  migrationsRun: false,
  logging: process.env.NODE_ENV === "development",
  entities: [Pair, Transaction, Token, TokenPriceSnapshot, PairVolumeSnapshot],
  migrations: ["db/migrations/*.js"],
  namingStrategy: new SnakeNamingStrategy(),
});

export default AppDataSource;
