"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const postgraphile_1 = require("postgraphile");
const dotenv_1 = __importDefault(require("dotenv"));
const postgraphile_plugin_connection_filter_1 = __importDefault(require("postgraphile-plugin-connection-filter"));
const node_http_1 = require("node:http");
const pg_1 = require("pg");
dotenv_1.default.config();
const isDev = process.env.NODE_ENV === "development";
async function main() {
    const dbPool = new pg_1.Pool({
        connectionString: process.env.DATABASE_URL || "postgres://indexer",
    });
    const database = process.env.DATABASE_URL || "indexer";
    const options = {
        watchPg: isDev,
        graphiql: true,
        enhanceGraphiql: isDev,
        subscriptions: true,
        dynamicJson: true,
        setofFunctionsContainNulls: false,
        disableDefaultMutations: true,
        ignoreRBAC: false,
        showErrorStack: isDev ? "json" : true,
        extendedErrors: ["hint", "detail", "errcode"],
        allowExplain: isDev,
        legacyRelations: "omit",
        exportGqlSchemaPath: `${__dirname}/schema.graphql`,
        sortExport: true,
        appendPlugins: [postgraphile_plugin_connection_filter_1.default],
    };
    const middleware = (0, postgraphile_1.postgraphile)(database, "public", options);
    const app = (0, express_1.default)();
    app.use(middleware);
    const server = (0, node_http_1.createServer)(app);
    const port = process.env.GQL_PORT || 4350;
    server.listen({ host: "0.0.0.0", port }, () => {
        const address = server.address();
        if (typeof address !== "string") {
            const href = `http://${address.address}:${address.port}${options.graphiqlRoute || "/graphiql"}`;
            console.log(`PostGraphiQL available at ${href} 🚀`);
        }
        else {
            console.log(`PostGraphile listening on ${address} 🚀`);
        }
    });
}
main().catch((error) => {
    console.error(error);
    process.exit(1);
});
