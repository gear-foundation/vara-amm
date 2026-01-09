#![allow(static_mut_refs)]

use sails_rs::{gstd::msg, prelude::*};
mod amm_math;
mod funcs;
mod msg_tracker;
use msg_tracker::{MessageStatus, msg_tracker_ref};
use sails_rs::gstd::services::Service as Svc;

mod token_operations;
use crate::services::lp_token::ExtendedService as VftService;
use gstd::static_mut;
type VftExposure = <VftService as Svc>::Exposure;

pub struct PairService {
    vft_exposure: VftExposure,
}

#[derive(Debug, Default)]
pub struct State {
    token0: ActorId,
    token1: ActorId,
    reserve0: U256,
    reserve1: U256,
    fee_to: ActorId,
    factory_id: ActorId,
    k_last: U256,
    config: Config,
    lock: bool,
    treasury_id: ActorId,
    admin_id: ActorId,
    migrated: bool,
    accrued_treasury_fee0: U256,
    accrued_treasury_fee1: U256,
}
static mut STATE: Option<State> = None;

#[event]
#[derive(Debug, Encode, Decode, TypeInfo)]
pub enum PairEvent {
    LiquidityAdded {
        user_id: ActorId,
        amount_a: U256,
        amount_b: U256,
        liquidity: U256,
    },
    Swap {
        user_id: ActorId,
        amount_in: U256,
        amount_out: U256,
        is_token0_to_token1: bool,
    },
    LiquidityRemoved {
        user_id: ActorId,
        amount_a: U256,
        amount_b: U256,
        liquidity: U256,
    },
    TreasuryFeesCollected {
        treasury_id: ActorId,
        amount_a: U256,
        amount_b: U256,
    },
    LiquidityMigrated {
        to: ActorId,
        amount0: U256,
        amount1: U256,
    },
}

#[derive(Debug)]
pub enum PairError {
    NotEnoghAttachedGas,
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
    AnotherTxInProgress,
    MessageNotFound,
    InvalidMessageStatus,
    TokenTransferFailed,
    ReplyHook,
    ZeroLiquidity,
    Unauthorized,
    NoTreasuryFees,
    NotTreasuryId,
    NoLiquidityToMigrate,
    PoolMigrated,
    UnableToDecode,
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
    gas_for_full_tx: u64,
}

impl PairService {
    pub fn init(
        config: Config,
        token0: ActorId,
        token1: ActorId,
        fee_to: ActorId,
        treasury_id: ActorId,
        admin_id: ActorId,
    ) {
        unsafe {
            STATE = Some(State {
                token0,
                token1,
                config,
                fee_to,
                factory_id: msg::source(),
                treasury_id,
                admin_id,
                ..Default::default()
            })
        }
        msg_tracker::init();
    }
    fn get_mut(&mut self) -> &'static mut State {
        unsafe { STATE.as_mut().expect("State is not initialized") }
    }
    fn get(&self) -> &'static State {
        unsafe { STATE.as_ref().expect("State is not initialized") }
    }
}

pub fn state_mut() -> &'static mut State {
    unsafe { static_mut!(STATE).as_mut() }.expect("State is not initialized")
}
macro_rules! event_or_panic_async {
    ($expr:expr) => {{
        match $expr.await {
            Ok(value) => value,
            Err(e) => {
                panic!("Message processing failed with error: {:?}", e)
            }
        }
    }};
}

impl PairService {
    pub fn new(vft_exposure: VftExposure) -> Self {
        Self { vft_exposure }
    }
}
#[sails_rs::service(events = PairEvent)]
impl PairService {

    #[export]
    pub async fn add_liquidity(
        &mut self,
        amount_a_desired: U256,
        amount_b_desired: U256,
        amount_a_min: U256,
        amount_b_min: U256,
        deadline: u64,
    ) {
        let event = event_or_panic_async!(funcs::add_liquidity(
            self.get_mut(),
            amount_a_desired,
            amount_b_desired,
            amount_a_min,
            amount_b_min,
            deadline,
            &mut self.vft_exposure
        ));
        self.emit_event(event).expect("Event emission error");
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
    #[export]
    pub async fn remove_liquidity(
        &mut self,
        liquidity: U256,
        amount_a_min: U256,
        amount_b_min: U256,
        deadline: u64,
    ) {
        let event = event_or_panic_async!(funcs::remove_liquidity(
            self.get_mut(),
            liquidity,
            amount_a_min,
            amount_b_min,
            deadline,
            &mut self.vft_exposure
        ));
        self.emit_event(event).expect("Event emission error");
    }

    /// Migrates all pool liquidity and accrued treasury fees to a target address.
    ///
    /// After migration:
    /// - `reserve0`, `reserve1`, `k_last`,
    ///   `accrued_treasury_fee0`, `accrued_treasury_fee1` are reset to zero.
    ///
    /// NOTE:
    /// - Intended for final pool shutdown / migration to a new contract.
    /// - Should be callable only by an admin
    #[export]
    pub async fn migrate_all_liquidity(&mut self,target: ActorId) {
        let event = event_or_panic_async!(funcs::migrate_all_liquidity(
            self.get_mut(),
            target
        ));
        self.emit_event(event).expect("Event emission error");
    }

    /// Swaps an exact amount of input tokens for as many output tokens as possible in a single pair.
    /// Direction is specified by is_token0_to_token1 (true for token0 -> token1, false for token1 -> token0).
    /// Combines high-level swap logic with low-level swap execution for a single-contract setup.
    /// # Arguments
    /// * `amount_in` - Exact amount of input token to swap
    /// * `amount_out_min` - Minimum amount of output token expected (slippage protection)
    /// * `is_token0_to_token1` - Direction of swap (true: token0 to token1, false: token1 to token0)
    /// * `deadline` - Unix timestamp after which the transaction will revert
    #[export]
    pub async fn swap_exact_tokens_for_tokens(
        &mut self,
        amount_in: U256,
        amount_out_min: U256,
        is_token0_to_token1: bool,
        deadline: u64,
    ) {
        let event = event_or_panic_async!(funcs::swap_exact_tokens_for_tokens(
            self.get_mut(),
            amount_in,
            amount_out_min,
            is_token0_to_token1,
            deadline,
        ));
        self.emit_event(event).expect("Event emission error");
    }

    /// Swaps as few input tokens as possible for an exact amount of output tokens in a single pair.
    /// Direction is specified by is_token0_to_token1 (true for token0 -> token1, false for token1 -> token0).
    /// Combines high-level swap logic with low-level swap execution for a single-contract setup.
    /// # Arguments
    /// * `amount_out` - Exact amount of output token desired
    /// * `amount_in_max` - Maximum amount of input token willing to pay (slippage protection)
    /// * `is_token0_to_token1` - Direction of swap (true: token0 to token1, false: token1 to token0)
    /// * `deadline` - Unix timestamp after which the transaction will revert
    #[export]
    pub async fn swap_tokens_for_exact_tokens(
        &mut self,
        amount_out: U256,
        amount_in_max: U256,
        is_token0_to_token1: bool,
        deadline: u64,
    ) {
        let event = event_or_panic_async!(funcs::swap_tokens_for_exact_tokens(
            self.get_mut(),
            amount_out,
            amount_in_max,
            is_token0_to_token1,
            deadline,
        ));
        self.emit_event(event).expect("Event emission error");
    }

    #[export]
    pub async fn send_treasury_fees(&mut self) {
        let event = event_or_panic_async!(funcs::send_treasury_fees_from_pool(self.get_mut(),));
        self.emit_event(event).expect("Event emission error");
    }

    #[export]
    pub async fn set_lock(&mut self, lock: bool) {
        let state = self.get_mut();
        if msg::source() == state.admin_id {
            state.lock = lock;
        } else {
            panic!("Not admin")
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
    #[export]
    pub fn calculate_protocol_fee(&self) -> U256 {
        funcs::calculate_protocol_fee(self.get()).unwrap_or_default()
    }

    /// Calculates accumulated swap fees for a specific LP provider.
    ///
    /// Similar to calculate_lp_fee, but returns the share of LP fees for a user with a given
    /// LP token balance (pro-rata based on `user_lp_balance / total_supply`). Returns 0 if no growth.
    #[export]
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
    #[export]
    pub fn calculate_remove_liquidity(&self, liquidity: U256) -> (U256, U256) {
        funcs::calculate_remove_liquidity(self.get(), liquidity).unwrap_or_default()
    }

    /// Calculates the expected output amount for a swap, given the input amount and
    /// current reserves, including both the internal 0.3% swap fee (Uniswap-style)
    /// and the optional treasury fee in the input token.
    /// Uses floor division
    ///
    /// - If `treasury` is configured (non-zero address), the input is split into:
    ///     * a small part reserved as treasury fee (e.g. 0.05%), and
    ///     * the remaining part that actually enters the pool and is priced
    ///       with the Uniswap V2 formula (0.3% fee via 997/1000 multiplier).
    /// - If `treasury` is not configured (zero address), the behavior matches
    ///   the classic Uniswap V2 `getAmountOut` with 0.3% fee.
    ///
    /// # Arguments
    /// * `amount_in` - Amount of input asset being swapped
    /// * `is_token0_to_token1` - Direction of swap (true: token0 to token1, false: token1 to token0)
    #[export]
    pub fn get_amount_out(&self, amount_in: U256, is_token0_to_token1: bool) -> U256 {
        let state = self.get();
        let (reserve_in, reserve_out) = if is_token0_to_token1 {
            (state.reserve0, state.reserve1)
        } else {
            (state.reserve1, state.reserve0)
        };
        let treasury_fee_bps = if state.treasury_id.is_zero() {
            0
        } else {
            amm_math::TREASURY_FEE_BPS
        };
        amm_math::get_amount_out_with_treasury(amount_in, reserve_in, reserve_out, treasury_fee_bps)
            .map(|(_, amount_out, _)| amount_out)
            .unwrap_or_default()
    }

    /// Calculates the required input amount for a desired output, given current reserves,
    /// including both the internal 0.3% swap fee (Uniswap-style) and the optional
    /// treasury fee in the input token.
    ///
    /// - First, the function determines how much must actually enter the pool
    ///   (`amount_in_for_pool`) using the standard Uniswap 0.3% math.
    /// - Then, if treasury fee is enabled, it computes a higher total input
    ///   `amount_in_total` such that:
    ///       amount_in_for_pool = amount_in_total * (1 - treasury_fee_bps / 10_000)
    ///   and the difference `amount_in_total - amount_in_for_pool` is the treasury fee.
    /// - If treasury is disabled, the result matches classic Uniswap V2
    ///   `getAmountIn` with 0.3% fee.
    ///
    /// # Arguments
    /// * `amount_out` - Desired amount of output asset
    /// * `is_token0_to_token1` - Direction of swap (true: token0 to token1, false: token1 to token0)
    #[export]
    pub fn get_amount_in(&self, amount_out: U256, is_token0_to_token1: bool) -> U256 {
        let state = self.get();
        let (reserve_in, reserve_out) = if is_token0_to_token1 {
            (state.reserve0, state.reserve1)
        } else {
            (state.reserve1, state.reserve0)
        };
        let treasury_fee_bps = if state.treasury_id.is_zero() {
            0
        } else {
            amm_math::TREASURY_FEE_BPS
        };

        amm_math::get_amount_in_with_treasury(amount_out, reserve_in, reserve_out, treasury_fee_bps)
            .map(|(_, amount_in_total, _)| amount_in_total)
            .unwrap_or_default()
    }

    #[export]
    pub fn change_fee_to(&mut self, new_fee_to: ActorId) {
        let state = self.get_mut();
        if msg::source() == state.factory_id {
            state.fee_to = new_fee_to;
        } else {
            panic!("Not factory")
        }
    }

    #[export]
    pub fn change_treasury_id(&mut self, new_treasury_id: ActorId) {
        let state = self.get_mut();
        if msg::source() == state.admin_id {
            state.treasury_id = new_treasury_id;
        } else {
            panic!("Not admin")
        }
    }

    #[export]
    pub fn treasury_id(&self) -> ActorId {
        self.get().treasury_id
    }

    #[export]
    pub fn get_reserves(&self) -> (U256, U256) {
        (self.get().reserve0, self.get().reserve1)
    }

    #[export]
    pub fn msgs_in_msg_tracker(&self) -> Vec<(MessageId, MessageStatus)> {
        msg_tracker_ref().message_info.clone().into_iter().collect()
    }

    #[export]
    pub fn lock(&self) -> bool {
        self.get().lock
    }

    #[export]
    pub fn migrated(&self) -> bool {
        self.get().migrated
    }

    #[export]
    pub fn get_tokens(&self) -> (ActorId, ActorId) {
        let state = self.get();
        (state.token0, state.token1)
    }

    /// Returns basic treasury info:
    /// - treasury address,
    /// - accrued fee in token0,
    /// - accrued fee in token1.
    #[export]
    pub fn get_treasury_info(&self) -> (ActorId, U256, U256) {
        let state = self.get();
        (
            state.treasury_id,
            state.accrued_treasury_fee0,
            state.accrued_treasury_fee1,
        )
    }
}
