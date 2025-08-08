"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const typeorm_1 = require("typeorm");
const dotenv_1 = __importDefault(require("dotenv"));
const entities_1 = require("./entities");
dotenv_1.default.config();
const AppDataSource = new typeorm_1.DataSource({
    type: "postgres",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    username: process.env.DB_USER || "postgres",
    password: process.env.DB_PASS || "postgres",
    database: process.env.DB_NAME || "gear_monitoring",
    synchronize: true,
    migrationsRun: true,
    logging: process.env.NODE_ENV === "development",
    entities: [entities_1.VftTransfer],
    migrations: ["db/migrations/*.js"],
});
exports.default = AppDataSource;
