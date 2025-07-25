#![allow(static_mut_refs)]

use sails_rs::{gstd::msg, prelude::*};
mod amm_math;
mod funcs;
mod token_operations;
use crate::services::lp_token::ExtendedService as VftService;
pub struct PairService(());

#[derive(Debug, Default)]
struct State {
    token0: ActorId,
    token1: ActorId,
    reserve0: U256,
    reserve1: U256,
    fee_to: ActorId,
    factory_id: ActorId,
    k_last: U256,
    config: Config,
}
static mut STATE: Option<State> = None;

#[derive(Debug)]
pub enum PairEvent {
    LiquidityAdded {
        amount_a: U256,
        amount_b: U256,
        liquidity: U256,
    },
    Swap,
    LiquidityRemoved {
        amount_a: U256,
        amount_b: U256,
        liquidity: U256,
    },
}

#[derive(Debug)]
pub enum PairError {
    InsufficientLiquidity,
    Overflow,
    DeadlineExpired,
    InsufficientAmountA,
    InsufficientAmountB,
    SendFailure,
    ReplyTimeout,
    ReplyFailure,
    InsufficientLiquidityMinted,
    InsufficientAmount,
    InvariantViolation,
    ExcessiveInputAmount,
}

/// Config that will be used to send messages to the other programs.
#[derive(Default, Debug, Decode, Encode, TypeInfo, Clone)]
pub struct Config {
    /// Gas limit for token operations. Token operations include:
    /// - Mint
    /// - Burn
    /// - TransferFrom
    gas_for_token_ops: u64,
    /// Gas to reserve for reply processing.
    gas_for_reply_deposit: u64,
    /// Timeout in blocks that current program will wait for reply from
    /// the other programs such as VFT
    reply_timeout: u32,
}

impl PairService {
    pub fn init(config: Config, token0: ActorId, token1: ActorId, fee_to: ActorId) -> Self {
        unsafe {
            STATE = Some(State {
                token0,
                token1,
                config,
                fee_to,
                factory_id: msg::source(),
                ..Default::default()
            })
        }
        Self(())
    }
    fn get_mut(&mut self) -> &'static mut State {
        unsafe { STATE.as_mut().expect("State is not initialized") }
    }
    fn get(&self) -> &'static State {
        unsafe { STATE.as_ref().expect("State is not initialized") }
    }
}

#[sails_rs::service]
impl PairService {
    pub fn new() -> Self {
        Self(())
    }

    pub async fn add_liquidity(
        &mut self,
        amount_a_desired: U256,
        amount_b_desired: U256,
        amount_a_min: U256,
        amount_b_min: U256,
        deadline: u64,
    ) {
        let result = funcs::add_liquidity(
            self.get_mut(),
            amount_a_desired,
            amount_b_desired,
            amount_a_min,
            amount_b_min,
            deadline,
        )
        .await;
        if result.is_err() {
            panic!("Error {:?}", result);
        }
    }

    /// Removes liquidity from the AMM pool
    ///
    /// # Parameters
    /// * `liquidity` - Amount of LP tokens to burn
    /// * `amount_a_min` - Minimum amount of token A to receive (slippage protection)
    /// * `amount_b_min` - Minimum amount of token B to receive (slippage protection)
    /// * `deadline` - Timestamp after which the transaction is considered invalid
    ///
    /// # Algorithm
    /// 1. Validates deadline and user's LP token balance
    /// 2. Mints accumulated protocol fees (modifies state permanently)
    /// 3. Calculates proportional amounts of tokens A and B to return
    /// 4. Validates amounts against minimum thresholds
    /// 5. Burns user's LP tokens and transfers underlying tokens back
    /// 6. Updates pool reserves
    pub async fn remove_liquidity(
        &mut self,
        liquidity: U256,
        amount_a_min: U256,
        amount_b_min: U256,
        deadline: u64,
    ) {
        let result = funcs::remove_liquidity(
            self.get_mut(),
            liquidity,
            amount_a_min,
            amount_b_min,
            deadline,
        )
        .await;
        if result.is_err() {
            panic!("Error {:?}", result);
        }
    }

    /// Swaps an exact amount of input tokens for as many output tokens as possible in a single pair.
    /// Direction is specified by is_token0_to_token1 (true for token0 -> token1, false for token1 -> token0).
    /// Combines high-level swap logic with low-level swap execution for a single-contract setup.
    /// # Arguments
    /// * `amount_in` - Exact amount of input token to swap
    /// * `amount_out_min` - Minimum amount of output token expected (slippage protection)
    /// * `is_token0_to_token1` - Direction of swap (true: token0 to token1, false: token1 to token0)
    /// * `deadline` - Unix timestamp after which the transaction will revert
    pub async fn swap_exact_tokens_for_tokens(
        &mut self,
        amount_in: U256,
        amount_out_min: U256,
        is_token0_to_token1: bool,
        deadline: u64,
    ) {
        let result = funcs::swap_exact_tokens_for_tokens(
            self.get_mut(),
            amount_in,
            amount_out_min,
            is_token0_to_token1,
            deadline,
        )
        .await;
        if result.is_err() {
            panic!("Error {:?}", result);
        }
    }

    /// Swaps as few input tokens as possible for an exact amount of output tokens in a single pair.
    /// Direction is specified by is_token0_to_token1 (true for token0 -> token1, false for token1 -> token0).
    /// Combines high-level swap logic with low-level swap execution for a single-contract setup.
    /// # Arguments
    /// * `amount_out` - Exact amount of output token desired
    /// * `amount_in_max` - Maximum amount of input token willing to pay (slippage protection)
    /// * `is_token0_to_token1` - Direction of swap (true: token0 to token1, false: token1 to token0)
    /// * `deadline` - Unix timestamp after which the transaction will revert
    pub async fn swap_tokens_for_exact_tokens(
        &mut self,
        amount_out: U256,
        amount_in_max: U256,
        is_token0_to_token1: bool,
        deadline: u64,
    ) {
        let result = funcs::swap_tokens_for_exact_tokens(
            self.get_mut(),
            amount_out,
            amount_in_max,
            is_token0_to_token1,
            deadline,
        )
        .await;
        if result.is_err() {
            panic!("Error {:?}", result);
        }
    }

    /// Calculates protocol fees for the liquidity pool, similar to Uniswap V2, without minting.
    ///
    /// This function checks if protocol fees are enabled (via `fee_to` address) and calculates
    /// the growth in pool reserves due to accumulated swap fees (0.3% per swap, with 1/6 or
    /// 0.05% going to the protocol). Returns the amount of new liquidity tokens (LP tokens)
    /// that would be minted to the `fee_to` address, proportional to the increase in the square root
    /// of the constant product (`reserve0 * reserve1`). If protocol fees are disabled or no growth,
    /// returns 0.
    ///
    /// Can be called for estimation or off-chain calculations. Does not modify state.
    pub fn calculate_protocol_fee(&self) -> U256 {
        funcs::calculate_protocol_fee(&self.get()).unwrap_or_default()
    }

    /// Calculates accumulated swap fees for a specific LP provider.
    ///
    /// Similar to calculate_lp_fee, but returns the share of LP fees for a user with a given
    /// LP token balance (pro-rata based on `user_lp_balance / total_supply`). Returns 0 if no growth.
    pub fn calculate_lp_user_fee(&self, user: ActorId) -> U256 {
        let user_lp_balance = VftService::balance_of(user);
        funcs::calculate_lp_user_fee(self.get(), user_lp_balance).unwrap_or_default()
    }

    /// Calculates the amounts of token A and B a user would receive when removing liquidity.
    ///
    /// This function simulates the removal of liquidity by burning a given amount of LP tokens.
    /// It accounts for protocol fees (by simulating mint_fee dilution), calculates pro-rata shares
    /// based on reserves (assuming they include swap fees), and sorts amounts by token_a/token_b.
    /// Does not modify state or perform any transactions.
    pub fn calculate_remove_liquidity(&self, liquidity: U256) {
        funcs::calculate_remove_liquidity(self.get(), liquidity).unwrap_or_default();
    }

    /// Calculates the maximum output amount of the other asset given an input amount and pair reserves.
    /// This accounts for a 0.3% fee (997/1000 multiplier).
    /// Formula: amount_out = (amount_in * 997 * reserve_out) / (reserve_in * 1000 + amount_in * 997)
    /// Uses floor division
    /// # Arguments
    /// * `amount_in` - Amount of input asset being swapped
    /// * `is_token0_to_token1` - Direction of swap (true: token0 to token1, false: token1 to token0)
    pub fn get_amount_out(&self, amount_in: U256, is_token0_to_token1: bool) -> U256 {
        let state = self.get();
        let (reserve_in, reserve_out) = if is_token0_to_token1 {
            (state.reserve0, state.reserve1)
        } else {
            (state.reserve1, state.reserve0)
        };
        amm_math::get_amount_out(amount_in, reserve_in, reserve_out).unwrap_or_default()
    }

    /// Calculates the required input amount of an asset given a desired output amount and pair reserves.
    /// This accounts for a 0.3% fee (997/1000 multiplier).
    /// Formula: amount_in = (reserve_in * amount_out * 1000) / (reserve_out - amount_out) * 997) + 1
    /// Uses floor division and adds 1 to ensure sufficient input (ceiling effect).
    /// # Arguments
    /// * `amount_out` - Desired amount of output asset
    /// * `is_token0_to_token1` - Direction of swap (true: token0 to token1, false: token1 to token0)
    pub fn get_amount_in(&self, amount_out: U256, is_token0_to_token1: bool) -> U256 {
        let state = self.get();
        let (reserve_in, reserve_out) = if is_token0_to_token1 {
            (state.reserve0, state.reserve1)
        } else {
            (state.reserve1, state.reserve0)
        };
        amm_math::get_amount_in(amount_out, reserve_in, reserve_out).unwrap_or_default()
    }

    pub fn get_reserves(&self) -> (U256, U256) {
        (self.get().reserve0, self.get().reserve1)
    }
}
