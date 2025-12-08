# Vara AMM Frontend

Modern React-based web interface for the Vara AMM decentralized exchange, providing intuitive trading and liquidity management tools.

## 🚀 Features

### 💱 **Trading Interface**
- **Token Swapping**: Seamless token-to-token exchanges with real-time price updates
- **Multiple Trading Modes**: Swap, Buy, and Sell interfaces
- **Slippage Protection**: Configurable slippage tolerance and deadline settings
- **Price Impact Calculation**: Real-time price impact display for informed trading

### 💰 **Liquidity Management**
- **Add/Remove Liquidity**: Easy liquidity provision with automatic ratio calculations
- **LP Token Management**: View and manage your liquidity provider positions
- **Pool Statistics**: Real-time pool reserves, volume, and TVL data
- **Fee Earnings**: Track your accumulated trading fees (0.3% fee tier)

### 📊 **Analytics & Monitoring**
- **Pool Explorer**: Browse all available trading pairs and statistics
- **Transaction History**: Complete audit trail of your DEX activities
- **Price Charts**: Historical price data and volume analytics
- **Portfolio Tracking**: Monitor your positions and earnings

### 🔗 **Vara Network Integration**
- **Wallet Connection**: Seamless integration with Vara-compatible wallets
- **Native VARA Support**: Direct integration with Vara's native token
- **VFT Compatibility**: Support for all Vara Fungible Tokens
- **Real-time Updates**: Live synchronization with blockchain state

## 🛠 Tech Stack

- **React 19** + **TypeScript** for modern, type-safe development
- **Vite** for fast development and optimized builds
- **Tailwind CSS** + **Radix UI** for beautiful, accessible components
- **React Hook Form** + **Zod** for robust form validation
- **TanStack Query** for efficient data fetching and caching
- **Gear-JS SDK** for seamless blockchain integration
- **GraphQL** for efficient data querying from indexer

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and **Yarn**
- **Vara-compatible wallet** (SubWallet, Polkadot.js, etc.)

### Installation

```bash
# Install dependencies
yarn install

# Start development server
yarn start
```

The application will be available at `http://localhost:3000`

### Build for Production

```bash
# Build optimized production bundle
yarn build

# Preview production build locally
yarn preview
```

## 🔧 Configuration

### Environment Variables

Copy the example environment file and configure as needed:

```bash
cp .env.example .env.local
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

