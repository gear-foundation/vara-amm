import { DataSource } from "typeorm";
import dotenv from "dotenv";
import { VftTransfer } from "./entities";

dotenv.config();

const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASS || "postgres",
  database: process.env.DB_NAME || "gear_monitoring",
  synchronize: true,
  migrationsRun: true,
  logging: process.env.NODE_ENV === "development",
  entities: [VftTransfer], // TODO: Specify all other entities here
  migrations: ["db/migrations/*.js"],
});

export default AppDataSource;
