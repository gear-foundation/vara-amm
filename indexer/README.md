# Vara AMM Indexer

Blockchain data indexing service for the Vara AMM decentralized exchange. Built with Subsquid framework, this service processes AMM events from the Vara Network and provides a GraphQL API for analytics and real-time data.

## Overview

The Vara AMM Indexer tracks and processes all AMM-related activities on the Vara Network:

- **AMM Event Processing**: Indexes swaps, liquidity additions/removals, and pair creation events
- **Price Calculation**: Real-time token price tracking and historical data
- **Volume Analytics**: Trading volume aggregation across multiple time intervals
- **TVL Tracking**: Total Value Locked monitoring for all liquidity pools
- **GraphQL API**: Efficient data querying for frontend applications
- **Real-time Updates**: Live synchronization with Vara Network blockchain state

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and **Yarn**
- **PostgreSQL** database
- **Vara Network** access (testnet or mainnet)

### 1. Install Dependencies

```bash
yarn install
```

### 2. Database Setup

Install and configure PostgreSQL:

- [PostgreSQL Download](https://www.postgresql.org/download/)
- Create a database for the indexer

### 3. Environment Configuration

Copy and configure the environment file:

```bash
cp .env.example .env
```

Key configuration options:

- `VARA_ARCHIVE_URL`: Subsquid archive endpoint
- `VARA_RPC_URL`: Vara Network RPC endpoint
- `FACTORY_PROGRAM_ID`: AMM Factory contract address
- Database connection settings

### 4. Build and Run

```bash
# Build the project
yarn build

# Run database migrations
yarn migration:run

# Start the indexer
yarn start

# Start the GraphQL API
yarn serve
```

The GraphQL playground will be available at `http://localhost:4350/graphql`

## 📁 Project Structure

```
src/
├── handlers/           # Event handlers for AMM contracts
│   ├── base.ts        # Abstract base handler class
│   ├── factory.ts     # Factory contract event handler
│   ├── pair.ts        # Pair contract event handler
│   └── index.ts       # Handler exports
├── helpers/           # Utility functions and type guards
├── model/             # Database entities (TypeORM)
│   ├── generated/     # Auto-generated entity classes
│   └── index.ts       # Entity exports
├── services/          # Business logic services
│   ├── price-calculator.ts    # Token price calculations
│   ├── volume-calculator.ts   # Trading volume aggregation
│   ├── token-manager.ts       # Token metadata management
│   └── vft-cache.ts          # VFT token caching
├── types/             # TypeScript type definitions
├── config.ts          # Configuration management
├── main.ts            # Application entry point
├── processor.ts       # Subsquid processor setup
└── sails-decoder.ts   # SAILS message decoder

schema.graphql         # GraphQL schema definition
assets/                # SAILS IDL files (factory.idl, pair.idl, etc.)
db/migrations/         # Database migration files
```

## 🏗 Architecture

### Data Models

The indexer tracks the following key entities:

#### **Tokens**

- Token metadata (symbol, name, decimals)
- Price history and market data
- Total supply tracking

#### **Trading Pairs**

- Token pair information (token0, token1)
- Reserve amounts and liquidity data
- Volume statistics across time intervals
- TVL (Total Value Locked) calculations

#### **Transactions**

- Swap transactions with amounts and prices
- Liquidity provision/removal events
- Price impact and slippage data

#### **Volume Snapshots**

- Aggregated trading volume by time intervals (1h, 24h, 7d, 30d, 1y)
- Transaction count statistics
- Historical volume trends

### Event Processing

The indexer processes events from two main contract types:

#### **Factory Handler** (`src/handlers/factory.ts`)

- **PairCreated**: New trading pair creation events
- Maintains registry of all AMM pairs
- Initializes pair tracking and metadata

#### **Pair Handler** (`src/handlers/pair.ts`)

- **Swap**: Token swap transactions
- **LiquidityAdded**: Liquidity provision events with amounts and LP tokens minted
- **LiquidityRemoved**: Liquidity removal events with amounts and LP tokens burned

### Services

#### **Price Calculator** (`src/services/price-calculator.ts`)

- Real-time token price calculations using reserve ratios
- USD price derivation through stablecoin pairs
- Historical price tracking and snapshots

#### **Volume Calculator** (`src/services/volume-calculator.ts`)

- Trading volume aggregation across time intervals
- Volume snapshots for analytics
- Transaction count tracking

#### **Token Manager** (`src/services/token-manager.ts`)

- VFT token metadata management
- Token symbol and decimal resolution
- Custom token import handling

## 📊 GraphQL API

The indexer provides a comprehensive GraphQL API for querying AMM data including tokens, trading pairs, transactions, and volume analytics.

### Schema

See [schema.graphql](schema.graphql) for the complete GraphQL schema definition with all available types, queries, and subscriptions.

### Key Features

- **Token Data**: Price history, metadata, and market statistics
- **Trading Pairs**: Reserves, volume, TVL, and transaction history
- **Volume Analytics**: Time-based volume snapshots and aggregations
- **Real-time Subscriptions**: Live updates for pair data and transactions

The GraphQL playground is available at `http://localhost:4350/graphql` when running the API server.

## 🔧 Development

### Database Operations

#### **Migrations**

```bash
# Generate a new migration after schema changes
yarn migration:generate --name MigrationName

# Apply pending migrations
yarn migration:run

# Revert last migration
yarn migration:revert
```

## ⚙️ Configuration

### Environment Variables

| Variable              | Description                  | Default              |
| --------------------- | ---------------------------- | -------------------- |
| `VARA_ARCHIVE_URL`    | Subsquid archive endpoint    | Vara testnet archive |
| `VARA_RPC_URL`        | Vara Network RPC endpoint    | Vara testnet RPC     |
| `VARA_RPC_RATE_LIMIT` | RPC request rate limit       | 20                   |
| `VARA_FROM_BLOCK`     | Starting block number        | 0                    |
| `FACTORY_PROGRAM_ID`  | AMM Factory contract address | -                    |
| `DB_*`                | Database connection settings | PostgreSQL defaults  |

### Network Configuration

#### **Vara Testnet**

```bash
VARA_ARCHIVE_URL=https://v2.archive.subsquid.io/network/vara-testnet
VARA_RPC_URL=wss://testnet-archive.vara.network
```

#### **Vara Mainnet**

```bash
VARA_ARCHIVE_URL=https://v2.archive.subsquid.io/network/vara
VARA_RPC_URL=wss://rpc.vara.network
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.
