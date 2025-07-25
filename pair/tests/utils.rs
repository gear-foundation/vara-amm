use sails_rs::{
    calls::*,
    gtest::{calls::*, System},
    prelude::*,
    U256,
};

use extended_vft_client::traits::*;
use pair_client::{traits::Vft as LpVft, traits::*, Config};

// Helper struct for tracking expected calculations
#[derive(Debug, Clone)]
pub struct PoolCalculator {
    reserve0: U256,
    reserve1: U256,
    total_supply: U256,
    k_last: U256,
    fee_bps: u64,
    accumulated_fees_a: U256,
    accumulated_fees_b: U256,
}

impl PoolCalculator {
    pub fn new() -> Self {
        Self {
            reserve0: U256::zero(),
            reserve1: U256::zero(),
            total_supply: U256::zero(),
            k_last: U256::zero(),
            fee_bps: 3, // 0.3% = 3/1000
            accumulated_fees_a: U256::zero(),
            accumulated_fees_b: U256::zero(),
        }
    }

    // Calculate expected liquidity for first addition
    pub fn calculate_initial_liquidity(&mut self, amount_a: U256, amount_b: U256) -> U256 {
        let minimum_liquidity = U256::from(1000);
        let liquidity = (amount_a * amount_b).integer_sqrt();

        self.reserve0 = amount_a;
        self.reserve1 = amount_b;
        self.total_supply = liquidity;
        self.k_last = amount_a * amount_b;

        liquidity - minimum_liquidity // User gets total - minimum_liquidity
    }

    // Calculate expected liquidity for subsequent additions
    pub fn calculate_additional_liquidity(
        &mut self,
        amount_a_desired: U256,
        amount_b_desired: U256,
    ) -> (U256, U256, U256) {
        // STEP 1: First calculate and mint protocol fees (like mint_fee() in contract)
        self.mint_protocol_fees();

        // STEP 2: Calculate optimal amounts based on current reserves
        let current_ratio = self.reserve0 * U256::from(10000) / self.reserve1; // Higher precision
        let desired_ratio = amount_a_desired * U256::from(10000) / amount_b_desired;

        let (optimal_a, optimal_b) = if current_ratio == desired_ratio {
            // Perfect ratio
            (amount_a_desired, amount_b_desired)
        } else {
            // Calculate optimal amounts
            let amount_b_optimal = amount_a_desired * self.reserve1 / self.reserve0;
            let amount_a_optimal = amount_b_desired * self.reserve0 / self.reserve1;

            if amount_b_optimal <= amount_b_desired {
                (amount_a_desired, amount_b_optimal)
            } else {
                (amount_a_optimal, amount_b_desired)
            }
        };

        // STEP 3: Calculate liquidity to mint (using updated total_supply after fees)
        let liquidity_a = optimal_a * self.total_supply / self.reserve0;
        let liquidity_b = optimal_b * self.total_supply / self.reserve1;
        let liquidity = liquidity_a.min(liquidity_b);

        // STEP 4: Update state
        self.reserve0 += optimal_a;
        self.reserve1 += optimal_b;
        self.total_supply += liquidity;
        self.k_last = self.reserve0 * self.reserve1;

        (optimal_a, optimal_b, liquidity)
    }

    // Helper method to calculate and mint protocol fees (simulates mint_fee())
    fn mint_protocol_fees(&mut self) -> U256 {
        if self.k_last == U256::zero() {
            // No previous k_last, set it now
            self.k_last = self.reserve0 * self.reserve1;
            return U256::zero();
        }

        let current_k = self.reserve0 * self.reserve1;

        if current_k <= self.k_last {
            return U256::zero();
        }

        let root_k = current_k.integer_sqrt();
        let root_k_last = self.k_last.integer_sqrt();

        if root_k <= root_k_last {
            return U256::zero();
        }

        // Protocol fee formula: total_supply * (sqrt(k) - sqrt(k_last)) / (5 * sqrt(k) + sqrt(k_last))
        let numerator = self.total_supply * (root_k - root_k_last);
        let denominator = root_k * U256::from(5) + root_k_last;

        let protocol_fees = numerator / denominator;

        if protocol_fees > U256::zero() {
            // Mint fees to protocol (increases total_supply)
            self.total_supply += protocol_fees;
            println!("🏦 Calculator minted {} protocol fees", protocol_fees);
        }
        protocol_fees
    }

    // Calculate expected output for exact input swap
    pub fn calculate_swap_output(&mut self, amount_in: U256, is_token0_to_token1: bool) -> U256 {
        let fee = U256::from(self.fee_bps);
        let thousand = U256::from(1000);

        let (reserve_in, reserve_out) = if is_token0_to_token1 {
            (self.reserve0, self.reserve1)
        } else {
            (self.reserve1, self.reserve0)
        };

        // Calculate amount_in_with_fee = amount_in * 997
        let amount_in_with_fee = amount_in * (thousand - fee);

        // Calculate numerator = amount_in_with_fee * reserve_out
        let numerator = amount_in_with_fee * reserve_out;

        // Calculate denominator = reserve_in * 1000 + amount_in_with_fee
        let denominator = reserve_in * thousand + amount_in_with_fee;

        let amount_out = numerator / denominator;

        // Track fees (approximate)
        let fee_amount = amount_in * fee / thousand;
        if is_token0_to_token1 {
            self.accumulated_fees_a += fee_amount;
            self.reserve0 += amount_in;
            self.reserve1 -= amount_out;
        } else {
            self.accumulated_fees_b += fee_amount;
            self.reserve1 += amount_in;
            self.reserve0 -= amount_out;
        }

        amount_out
    }

    // Calculate expected protocol fees
    fn calculate_protocol_fees(&self) -> U256 {
        if self.k_last == U256::zero() {
            return U256::zero();
        }

        let current_k = self.reserve0 * self.reserve1;
        if current_k <= self.k_last {
            return U256::zero();
        }

        let root_k = current_k.integer_sqrt();
        let root_k_last = self.k_last.integer_sqrt();

        if root_k <= root_k_last {
            return U256::zero();
        }

        let numerator = self.total_supply * (root_k - root_k_last);
        let denominator = root_k * U256::from(5) + root_k_last;

        numerator / denominator
    }

    // Calculate expected amounts for liquidity removal
    pub fn calculate_removal_amounts(&mut self, liquidity_to_remove: U256) -> (U256, U256, U256) {
        let protocol_fees_minted = self.mint_protocol_fees();

        let amount_a = liquidity_to_remove * self.reserve0 / self.total_supply;
        let amount_b = liquidity_to_remove * self.reserve1 / self.total_supply;

        // Update state
        self.reserve0 -= amount_a;
        self.reserve1 -= amount_b;
        self.total_supply -= liquidity_to_remove;

        (amount_a, amount_b, protocol_fees_minted)
    }

    pub fn print_expectations(&self, title: &str) {
        println!(
            "🧮 Expected {}: Reserve0={}, Reserve1={}, TotalSupply={}",
            title, self.reserve0, self.reserve1, self.total_supply
        );
    }
}

pub async fn setup_tokens_and_pair(
    remoting: &GTestRemoting,
    fee_to: ActorId,
) -> (ActorId, ActorId, ActorId) {
    let token_code_id = remoting
        .system()
        .submit_code_file("../target/wasm32-gear/release/extended_vft.opt.wasm");

    let token_factory = extended_vft_client::ExtendedVftFactory::new(remoting.clone());

    let token_a = token_factory
        .new("TokenA".to_string(), "TokenA".to_string(), 18)
        .send_recv(token_code_id, b"salt1")
        .await
        .unwrap();

    let token_b = token_factory
        .new("TokenB".to_string(), "TokenB".to_string(), 18)
        .send_recv(token_code_id, b"salt2")
        .await
        .unwrap();

    let program_code_id = remoting.system().submit_code(pair::WASM_BINARY);
    let program_factory = pair_client::PairFactory::new(remoting.clone());

    let config = Config {
        gas_for_token_ops: 5_000_000_000,
        gas_for_reply_deposit: 5_000_000_000,
        reply_timeout: 50,
    };

    let pair_id = program_factory
        .new(config, token_a, token_b, fee_to)
        .send_recv(program_code_id, b"salt")
        .await
        .unwrap();

    (token_a, token_b, pair_id)
}

pub async fn mint_and_approve_tokens(
    remoting: &GTestRemoting,
    user: ActorId,
    token_a: ActorId,
    token_b: ActorId,
    pair_id: ActorId,
    amount: U256,
) {
    let mut token_client = extended_vft_client::Vft::new(remoting.clone());

    // Mint tokens to user
    token_client
        .mint(user.into(), amount)
        .send_recv(token_a)
        .await
        .unwrap();
    token_client
        .mint(user.into(), amount)
        .send_recv(token_b)
        .await
        .unwrap();

    // Approve pair to spend tokens
    token_client
        .approve(pair_id, amount)
        .with_args(|args| args.with_actor_id(user))
        .send_recv(token_a)
        .await
        .unwrap();
    token_client
        .approve(pair_id, amount)
        .with_args(|args| args.with_actor_id(user))
        .send_recv(token_b)
        .await
        .unwrap();
}

pub struct LiquidityAddition {
    amount_a_desired: U256,
    amount_b_desired: U256,
    amount_a_min: U256,
    amount_b_min: U256,
}

impl LiquidityAddition {
    pub fn new(amount_a: U256, amount_b: U256, min_a: U256, min_b: U256) -> Self {
        Self {
            amount_a_desired: amount_a,
            amount_b_desired: amount_b,
            amount_a_min: min_a,
            amount_b_min: min_b,
        }
    }

    pub fn balanced(amount: U256) -> Self {
        Self {
            amount_a_desired: amount,
            amount_b_desired: amount,
            amount_a_min: amount,
            amount_b_min: amount,
        }
    }
}

pub struct PairState {
    pub reserve0: U256,
    pub reserve1: U256,
    pub total_supply: U256,
}

impl PairState {
    pub async fn fetch(
        pair_client: &pair_client::Pair<GTestRemoting>,
        lp_vft_client: &pair_client::Vft<GTestRemoting>,
        pair_id: ActorId,
    ) -> Self {
        let reserves = pair_client.get_reserves().recv(pair_id).await.unwrap();
        let total_supply = lp_vft_client.total_supply().recv(pair_id).await.unwrap();

        Self {
            reserve0: reserves.0,
            reserve1: reserves.1,
            total_supply,
        }
    }

    pub fn print(&self, title: &str) {
        println!("\n=== {} ===", title);
        println!("Reserve0 (TokenA): {}", self.reserve0);
        println!("Reserve1 (TokenB): {}", self.reserve1);
        println!("Total Supply: {}", self.total_supply);
    }

    fn assert_equals(
        &self,
        expected_reserve0: U256,
        expected_reserve1: U256,
        expected_total_supply: U256,
    ) {
        assert_eq!(self.reserve0, expected_reserve0, "Reserve0 mismatch");
        assert_eq!(self.reserve1, expected_reserve1, "Reserve1 mismatch");
        assert_eq!(
            self.total_supply, expected_total_supply,
            "Total supply mismatch"
        );
    }
}

pub async fn add_liquidity_and_verify(
    pair_client: &mut pair_client::Pair<GTestRemoting>,
    lp_vft_client: &mut pair_client::Vft<GTestRemoting>,
    pair_id: ActorId,
    liquidity: LiquidityAddition,
    expected_state: PairState,
    expected_user_balance: U256,
    user: ActorId,
    deadline: u64,
    test_name: &str,
) {
    pair_client
        .add_liquidity(
            liquidity.amount_a_desired,
            liquidity.amount_b_desired,
            liquidity.amount_a_min,
            liquidity.amount_b_min,
            deadline,
        )
        .with_args(|args| args.with_actor_id(user))
        .send_recv(pair_id)
        .await
        .unwrap();

    let actual_state = PairState::fetch(pair_client, lp_vft_client, pair_id).await;
    actual_state.print(&format!("RESULTS AFTER {}", test_name.to_uppercase()));

    let user_lp_balance = lp_vft_client
        .balance_of(user.into())
        .recv(pair_id)
        .await
        .unwrap();
    println!("User LP Balance: {}", user_lp_balance);

    // Verify results
    actual_state.assert_equals(
        expected_state.reserve0,
        expected_state.reserve1,
        expected_state.total_supply,
    );
    assert_eq!(
        user_lp_balance, expected_user_balance,
        "User LP balance mismatch"
    );
}
