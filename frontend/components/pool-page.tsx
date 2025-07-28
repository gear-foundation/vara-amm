"use client"

import { useState } from "react"
import { Plus, ChevronDown, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TokenSelector } from "./token-selector"

interface Token {
  symbol: string
  name: string
  address: string
  decimals: number
  logoURI: string
  balance?: string
}

interface Network {
  id: string
  name: string
  chainId: number
  logoURI: string
  tokens: Token[]
}

const userPositions = [
  {
    pool: "ETH/VARA",
    token0: { symbol: "ETH", logoURI: "/tokens/eth.png" },
    token1: { symbol: "VARA", logoURI: "/tokens/vara.png" },
    liquidity: "$2,450.67",
    rewards: "12.34 VARA",
    share: "0.12%",
  },
  {
    pool: "VARA/USDC",
    token0: { symbol: "VARA", logoURI: "/tokens/vara.png" },
    token1: { symbol: "USDC", logoURI: "/tokens/usdc.png" },
    liquidity: "$1,234.89",
    rewards: "5.67 VARA",
    share: "0.08%",
  },
]

export function PoolPage() {
  const [token0, setToken0] = useState<Token>({
    symbol: "ETH",
    name: "Ethereum",
    address: "0x...",
    decimals: 18,
    logoURI: "/tokens/eth.png",
    balance: "2.5",
  })
  const [token1, setToken1] = useState<Token>({
    symbol: "VARA",
    name: "Vara Token",
    address: "0x...",
    decimals: 18,
    logoURI: "/tokens/vara.png",
    balance: "0.0",
  })
  const [amount0, setAmount0] = useState("")
  const [amount1, setAmount1] = useState("")
  const [showToken0Selector, setShowToken0Selector] = useState(false)
  const [showToken1Selector, setShowToken1Selector] = useState(false)

  const handleToken0Select = (token: Token, network: Network) => {
    setToken0(token)
  }

  const handleToken1Select = (token: Token, network: Network) => {
    setToken1(token)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Tabs defaultValue="positions" className="w-full">
        <TabsList className="card p-1 mb-8">
          <TabsTrigger
            value="positions"
            className="data-[state=active]:bg-[#00FF85] data-[state=active]:text-black font-bold uppercase"
          >
            YOUR POSITIONS
          </TabsTrigger>
          <TabsTrigger
            value="new"
            className="data-[state=active]:bg-[#00FF85] data-[state=active]:text-black font-bold uppercase"
          >
            NEW POSITION
          </TabsTrigger>
        </TabsList>

        <TabsContent value="positions">
          {userPositions.length > 0 ? (
            <div className="grid gap-6">
              {userPositions.map((position, index) => (
                <Card key={index} className="card">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex -space-x-2">
                        <img
                          src={position.token0.logoURI || "/placeholder.svg"}
                          alt={position.token0.symbol}
                          className="w-8 h-8 rounded-full border-2 border-gray-500/20"
                        />
                        <img
                          src={position.token1.logoURI || "/placeholder.svg"}
                          alt={position.token1.symbol}
                          className="w-8 h-8 rounded-full border-2 border-gray-500/20"
                        />
                      </div>
                      <CardTitle className="mono theme-text">{position.pool}</CardTitle>
                    </div>
                    <div className="flex space-x-2">
                      <Button className="btn-secondary">REMOVE</Button>
                      <Button className="btn-primary">ADD MORE</Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm text-gray-400 uppercase">LIQUIDITY</div>
                        <div className="text-lg font-medium mono theme-text">{position.liquidity}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400 uppercase">REWARDS</div>
                        <div className="text-lg font-medium mono theme-text">{position.rewards}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400 uppercase">POOL SHARE</div>
                        <div className="text-lg font-medium mono theme-text">{position.share}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="card">
              <CardContent className="text-center py-12">
                <div className="text-gray-400 mb-4">No liquidity positions found</div>
                <Button className="btn-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  CREATE FIRST POSITION
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="new">
          <Card className="card max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="text-lg font-bold uppercase theme-text">ADD LIQUIDITY</CardTitle>
              <div className="text-sm text-gray-400">Fixed fee tier: 0.3%</div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Token 0 */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>TOKEN 1</span>
                  <span>
                    Balance: {token0.balance} {token0.symbol}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Input
                    value={amount0}
                    onChange={(e) => setAmount0(e.target.value)}
                    placeholder="0.0"
                    className="input-field flex-1 text-xl"
                  />
                  <Button
                    onClick={() => setShowToken0Selector(true)}
                    className="btn-secondary flex items-center space-x-2 min-w-[120px]"
                  >
                    <img
                      src={token0.logoURI || "/placeholder.svg"}
                      alt={token0.name}
                      className="w-5 h-5 rounded-full"
                    />
                    <span>{token0.symbol}</span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex justify-center">
                <Plus className="w-6 h-6 text-gray-400" />
              </div>

              {/* Token 1 */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>TOKEN 2</span>
                  <span>
                    Balance: {token1.balance} {token1.symbol}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Input
                    value={amount1}
                    onChange={(e) => setAmount1(e.target.value)}
                    placeholder="0.0"
                    className="input-field flex-1 text-xl"
                  />
                  <Button
                    onClick={() => setShowToken1Selector(true)}
                    className="btn-secondary flex items-center space-x-2 min-w-[120px]"
                  >
                    <img
                      src={token1.logoURI || "/placeholder.svg"}
                      alt={token1.name}
                      className="w-5 h-5 rounded-full"
                    />
                    <span>{token1.symbol}</span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Pool Info */}
              <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Pool Share</span>
                  <span className="theme-text">0.12%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Fee Tier</span>
                  <span className="theme-text">0.3%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">LP Tokens</span>
                  <div className="flex items-center space-x-1">
                    <span className="theme-text">1,234.56</span>
                    <Info className="w-3 h-3 text-gray-400" />
                  </div>
                </div>
              </div>

              <Button className="btn-primary w-full py-4 text-lg">ADD LIQUIDITY</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Token Selectors */}
      <TokenSelector
        isOpen={showToken0Selector}
        onClose={() => setShowToken0Selector(false)}
        onSelectToken={handleToken0Select}
        selectedToken={token0}
        title="Select first token"
      />

      <TokenSelector
        isOpen={showToken1Selector}
        onClose={() => setShowToken1Selector(false)}
        onSelectToken={handleToken1Select}
        selectedToken={token1}
        title="Select second token"
      />
    </div>
  )
}
