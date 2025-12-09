<h3 align="center">
    Vara AMM
</h3>

<h1 align="center">Overview</h1>

<p align="center">
A decentralized Automated Market Maker (AMM) reference implementation for Vara Network. This project provides a complete DeFi trading platform with liquidity provision, token swapping, and automated fee distribution powered by Gear Protocol smart contracts. Ready to deploy by anyone on Vara Network.
</p>

## 🏗 Architecture

### Smart Contracts (`/contracts`)

| Contract | Description |
|----------|-------------|
| **Factory** | Creates and manages trading pairs, handles pair registry |
| **Pair** | Individual AMM pools with swap logic and liquidity management |

### Frontend Application (`/frontend`)

Modern React-based web interface for interacting with the AMM, providing intuitive trading and liquidity management tools.

### Indexer Service (`/indexer`)

Blockchain data indexing service that processes AMM events and provides GraphQL API for analytics and real-time data.

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and **Yarn**
- **PostgreSQL** database
- **Rust** toolchain for smart contract development

### 1. Clone Repository

```bash
git clone https://github.com/gear-tech/vara-amm.git
cd vara-amm
```

### 2. Smart Contracts

```bash
cd contracts
cargo build --release
```

### 3. Indexer Setup

See [indexer/README.md](indexer/README.md) for detailed setup instructions.

### 4. Frontend Development

See [frontend/README.md](frontend/README.md) for detailed setup instructions.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

<p align="center">
    <a href="https://twitter.com/gear_techs">
        <img src="https://raw.githubusercontent.com/gear-tech/gear/master/images/social-icon-1.svg" alt="twit" style="vertical-align:middle" >
    </a>
    <a href="https://github.com/gear-tech">
        <img src="https://raw.githubusercontent.com/gear-tech/gear/master/images/social-icon-2.svg" alt="github" style="vertical-align:middle" >
    </a>
    <a href="https://discord.gg/7BQznC9uD9">
        <img src="https://raw.githubusercontent.com/gear-tech/gear/master/images/social-icon-3.svg" alt="discord" style="vertical-align:middle" >
    </a>
    <a href="https://medium.com/@gear_techs">
        <img src="https://raw.githubusercontent.com/gear-tech/gear/master/images/social-icon-4.svg" alt="medium" style="vertical-align:middle" >
    </a>
    <a href="https://t.me/gear_tech">
        <img src="https://raw.githubusercontent.com/gear-tech/gear/master/images/social-icon-5.svg" alt="medium" style="vertical-align:middle" >
   </a>
</p>
