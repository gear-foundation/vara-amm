use crate::services::lp_token::ExtendedService as VftService;
use crate::services::pair::{PairError, PairEvent, State, amm_math, token_operations};
const FEE_BPS: u64 = 3; // 0.3% fee (3/1000)
use sails_rs::{
    gstd::{exec, msg},
    prelude::*,
};

struct SwapDirection {
    token_in: ActorId,
    token_out: ActorId,
    reserve_in: U256,
    reserve_out: U256,
}

// Enum to define the type of swap operation
#[derive(Debug, Clone, Copy)]
pub enum SwapType {
    ExactInput {
        amount_in: U256,
        amount_out_min: U256,
    },
    ExactOutput {
        amount_out: U256,
        amount_in_max: U256,
    },
}

pub async fn add_liquidity(
    state: &mut State,
    amount_a_desired: U256,
    amount_b_desired: U256,
    amount_a_min: U256,
    amount_b_min: U256,
    deadline: u64,
) -> Result<PairEvent, PairError> {
    if exec::block_timestamp() > deadline {
        return Err(PairError::DeadlineExpired);
    }

    let (amount_a, amount_b) = amm_math::calculate_optimal_amounts(
        state.reserve0,
        state.reserve1,
        amount_a_desired,
        amount_b_desired,
        amount_a_min,
        amount_b_min,
    )?;

    // transfer user's tokens
    let sender = msg::source();
    let program_id = exec::program_id();

    token_operations::transfer_from(state.token0, sender, program_id, amount_a, &state.config)
        .await?;

    token_operations::transfer_from(state.token1, sender, program_id, amount_b, &state.config)
        .await?;

    let fee_on = mint_fee(state)?;
    let total_supply = VftService::total_supply();

    let liquidity = amm_math::calculate_liquidity(
        state.reserve0,
        state.reserve1,
        amount_a,
        amount_b,
        total_supply,
    )?;

    if total_supply.is_zero() {
        mint_liquidity(ActorId::zero(), U256::from(amm_math::MINIMUM_LIQUIDITY));
    }

    mint_liquidity(sender, liquidity);

    update_reserves(state, amount_a, amount_b);

    if fee_on {
        set_new_k_last(state)?;
    }

    Ok(PairEvent::LiquidityAdded {
        amount_a,
        amount_b,
        liquidity,
    })
}

pub async fn remove_liquidity(
    state: &mut State,
    liquidity: U256,
    amount_a_min: U256,
    amount_b_min: U256,
    deadline: u64,
) -> Result<PairEvent, PairError> {
    // Check if transaction deadline has passed
    if exec::block_timestamp() > deadline {
        return Err(PairError::DeadlineExpired);
    }

    let sender = msg::source();

    // Verify user has sufficient LP tokens
    let user_balance = VftService::balance_of(sender);
    if user_balance < liquidity {
        return Err(PairError::InsufficientLiquidity);
    }

    // Calculate protocol fee to estimate user's amount_a and amount_b
    // Can't modify state here
    let lp_protocol_fee = calculate_protocol_fee(state)?;

    // Recalculate total supply after potential fee minting
    let total_supply = VftService::total_supply();

    // Calculate proportional amounts of underlying tokens to return
    // Formula: user_amount = (liquidity_to_burn * reserve) / total_supply
    let amount_a = liquidity
        .checked_mul(state.reserve0)
        .and_then(|result| result.checked_div(total_supply + lp_protocol_fee))
        .ok_or(PairError::Overflow)?;

    let amount_b = liquidity
        .checked_mul(state.reserve1)
        .and_then(|result| result.checked_div(total_supply + lp_protocol_fee))
        .ok_or(PairError::Overflow)?;

    // Slippage protection: ensure user receives at least minimum amounts
    if amount_a < amount_a_min {
        return Err(PairError::InsufficientAmountA);
    }
    if amount_b < amount_b_min {
        return Err(PairError::InsufficientAmountB);
    }

    // Sanity check: ensure pool has sufficient reserves
    if amount_a > state.reserve0 || amount_b > state.reserve1 {
        return Err(PairError::InsufficientLiquidity);
    }

    // Transfer underlying tokens back to user
    let program_id = exec::program_id();

    token_operations::transfer(state.token0, program_id, sender, amount_a, &state.config).await?;

    token_operations::transfer(state.token1, program_id, sender, amount_b, &state.config).await?;

    let fee_on = mint_fee(state)?;
    // Burn user's LP tokens (reduces both user balance and total supply)
    burn_liquidity(sender, liquidity);

    // Update pool reserves after token withdrawal
    let new_reserve0 = state
        .reserve0
        .checked_sub(amount_a)
        .ok_or(PairError::Overflow)?;

    let new_reserve1 = state
        .reserve1
        .checked_sub(amount_b)
        .ok_or(PairError::Overflow)?;

    state.reserve0 = new_reserve0;
    state.reserve1 = new_reserve1;

    if fee_on {
        set_new_k_last(state)?;
    }

    Ok(PairEvent::LiquidityRemoved {
        amount_a,
        amount_b,
        liquidity,
    })
}

pub async fn swap_exact_tokens_for_tokens(
    state: &mut State,
    amount_in: U256,
    amount_out_min: U256,
    is_token0_to_token1: bool,
    deadline: u64,
) -> Result<PairEvent, PairError> {
    swap_tokens(
        state,
        SwapType::ExactInput {
            amount_in,
            amount_out_min,
        },
        is_token0_to_token1,
        deadline,
    )
    .await
}

pub async fn swap_tokens_for_exact_tokens(
    state: &mut State,
    amount_out: U256,
    amount_in_max: U256,
    is_token0_to_token1: bool,
    deadline: u64,
) -> Result<PairEvent, PairError> {
    swap_tokens(
        state,
        SwapType::ExactOutput {
            amount_out,
            amount_in_max,
        },
        is_token0_to_token1,
        deadline,
    )
    .await
}

pub async fn swap_tokens(
    state: &mut State,
    swap_type: SwapType,
    is_token0_to_token1: bool,
    deadline: u64,
) -> Result<PairEvent, PairError> {
    if exec::block_timestamp() > deadline {
        return Err(PairError::DeadlineExpired);
    }

    // Determine swap direction
    let swap_direction = if is_token0_to_token1 {
        SwapDirection {
            token_in: state.token0,
            token_out: state.token1,
            reserve_in: state.reserve0,
            reserve_out: state.reserve1,
        }
    } else {
        SwapDirection {
            token_in: state.token1,
            token_out: state.token0,
            reserve_in: state.reserve1,
            reserve_out: state.reserve0,
        }
    };

    // Calculate amounts based on swap type
    let (amount_in, amount_out) = match swap_type {
        SwapType::ExactInput {
            amount_in,
            amount_out_min,
        } => {
            let calculated_amount_out = amm_math::get_amount_out(
                amount_in,
                swap_direction.reserve_in,
                swap_direction.reserve_out,
            )?;

            // Check slippage for exact input
            if calculated_amount_out < amount_out_min {
                return Err(PairError::InsufficientAmount);
            }

            (amount_in, calculated_amount_out)
        }
        SwapType::ExactOutput {
            amount_out,
            amount_in_max,
        } => {
            let calculated_amount_in = amm_math::get_amount_in(
                amount_out,
                swap_direction.reserve_in,
                swap_direction.reserve_out,
            )?;

            // Check slippage for exact output
            if calculated_amount_in > amount_in_max {
                return Err(PairError::ExcessiveInputAmount);
            }

            (calculated_amount_in, amount_out)
        }
    };

    // Check liquidity sufficiency
    if amount_out > swap_direction.reserve_out {
        return Err(PairError::InsufficientLiquidity);
    }

    // Execute common swap logic
    execute_swap(
        state,
        &swap_direction,
        amount_in,
        amount_out,
        is_token0_to_token1,
    )
    .await
}

async fn execute_swap(
    state: &mut State,
    swap_direction: &SwapDirection,
    amount_in: U256,
    amount_out: U256,
    is_token0_to_token1: bool,
) -> Result<PairEvent, PairError> {
    // Calculate new balances
    let (new_balance0, new_balance1) = if is_token0_to_token1 {
        (
            state
                .reserve0
                .checked_add(amount_in)
                .ok_or(PairError::Overflow)?,
            state
                .reserve1
                .checked_sub(amount_out)
                .ok_or(PairError::Overflow)?,
        )
    } else {
        (
            state
                .reserve0
                .checked_sub(amount_out)
                .ok_or(PairError::Overflow)?,
            state
                .reserve1
                .checked_add(amount_in)
                .ok_or(PairError::Overflow)?,
        )
    };

    // Prepare data for invariant check
    let (amount0_in, amount1_in) = if is_token0_to_token1 {
        (amount_in, U256::zero())
    } else {
        (U256::zero(), amount_in)
    };

    // Verify constant product invariant
    verify_constant_product_invariant(
        new_balance0,
        new_balance1,
        amount0_in,
        amount1_in,
        state.reserve0,
        state.reserve1,
    )?;

    // Execute transfers
    let sender = msg::source();
    let program_id = exec::program_id();

    // Receive input tokens from user
    token_operations::transfer_from(
        swap_direction.token_in,
        sender,
        program_id,
        amount_in,
        &state.config,
    )
    .await?;

    // Send output tokens to user
    token_operations::transfer(
        swap_direction.token_out,
        program_id,
        sender,
        amount_out,
        &state.config,
    )
    .await?;

    // Update reserves
    state.reserve0 = new_balance0;
    state.reserve1 = new_balance1;

    Ok(PairEvent::Swap)
}

/// Verifies the constant product invariant (k) after a swap, accounting for a 0.3% fee.
/// Ensures that (balance0 * 1000 - amount0_in * 3) * (balance1 * 1000 - amount1_in * 3) >= reserve0 * reserve1 * 1000^2.
/// # Arguments
/// * `balance0` - New balance of token0 after swap
/// * `balance1` - New balance of token1 after swap
/// * `amount0_in` - Input amount of token0
/// * `amount1_in` - Input amount of token1
/// * `reserve0` - Reserve of token0 before swap
/// * `reserve1` - Reserve of token1 before swap
pub fn verify_constant_product_invariant(
    balance0: U256,
    balance1: U256,
    amount0_in: U256,
    amount1_in: U256,
    reserve0: U256,
    reserve1: U256,
) -> Result<(), PairError> {
    let thousand = U256::from(1000);
    let fee = U256::from(FEE_BPS);

    // Calculate adjusted balances: balance * 1000 - amount_in * 3
    let balance0_adjusted = balance0
        .checked_mul(thousand)
        .ok_or(PairError::Overflow)?
        .checked_sub(amount0_in.checked_mul(fee).ok_or(PairError::Overflow)?)
        .ok_or(PairError::Overflow)?;

    let balance1_adjusted = balance1
        .checked_mul(thousand)
        .ok_or(PairError::Overflow)?
        .checked_sub(amount1_in.checked_mul(fee).ok_or(PairError::Overflow)?)
        .ok_or(PairError::Overflow)?;

    // Calculate new constant product: balance0_adjusted * balance1_adjusted
    let k_new = balance0_adjusted
        .checked_mul(balance1_adjusted)
        .ok_or(PairError::Overflow)?;

    // Calculate old constant product: reserve0 * reserve1 * 1000*1000
    let k_old = reserve0
        .checked_mul(reserve1)
        .ok_or(PairError::Overflow)?
        .checked_mul(thousand * thousand)
        .ok_or(PairError::Overflow)?;

    // Verify invariant
    if k_new < k_old {
        return Err(PairError::InvariantViolation);
    }

    Ok(())
}

fn mint_liquidity(sender: ActorId, liquidity: U256) {
    let mut vft_service = VftService::new();
    vft_service.mint(sender, liquidity);
}

/// Burns LP tokens from user's balance
fn burn_liquidity(user: ActorId, amount: U256) {
    let mut vft_service = VftService::new();
    vft_service.burn(user, amount);
}

fn update_reserves(state: &mut State, amount_a: U256, amount_b: U256) {
    state.reserve0 += amount_a;
    state.reserve1 += amount_b;
}

fn set_new_k_last(state: &mut State) -> Result<(), PairError> {
    state.k_last = state
        .reserve0
        .checked_mul(state.reserve1)
        .ok_or(PairError::Overflow)?;
    Ok(())
}
/// Calculates and mints protocol fees for the liquidity pool, similar to Uniswap V2.
///
/// This function checks if protocol fees are enabled (via `fee_to` address) and calculates
/// the growth in pool reserves due to accumulated swap fees (0.3% per swap, with 1/6 or
/// 0.05% going to the protocol). If growth is detected, it mints new liquidity tokens (LP tokens)
/// to the `fee_to` address, proportional to the increase in the square root of the constant
/// product (`reserve0 * reserve1`). If protocol fees are disabled, it resets `k_last` to zero
/// to prevent future minting unless re-enabled.
///
/// Called internally before adding (`mint`) or removing (`burn`) liquidity to
/// ensure protocol fees from accumulated swaps are accounted for.
pub fn mint_fee(state: &mut State) -> Result<bool, PairError> {
    let fee_to = state.fee_to; // Should be in your config
    let k_last = state.k_last;
    let fee_on = !fee_to.is_zero();

    if fee_on {
        if !k_last.is_zero() {
            let current_k = state
                .reserve0
                .checked_mul(state.reserve1)
                .ok_or(PairError::Overflow)?;

            let root_k = current_k.integer_sqrt();
            let root_k_last = k_last.integer_sqrt();

            if root_k > root_k_last {
                let root_k_diff = root_k - root_k_last;

                let numerator = VftService::total_supply()
                    .checked_mul(root_k_diff)
                    .ok_or(PairError::Overflow)?;

                let root_k_times_5 = root_k
                    .checked_mul(U256::from(5))
                    .ok_or(PairError::Overflow)?;

                let denominator = root_k_times_5
                    .checked_add(root_k_last)
                    .ok_or(PairError::Overflow)?;

                let liquidity = numerator / denominator;

                if !liquidity.is_zero() {
                    mint_liquidity(fee_to, liquidity);
                }
            }
        }
    } else if !k_last.is_zero() {
        state.k_last = U256::zero();
    }

    Ok(fee_on)
}

pub fn calculate_protocol_fee(state: &State) -> Result<U256, PairError> {
    let fee_to = state.fee_to;
    let fee_on = !fee_to.is_zero();
    let k_last = state.k_last;

    if !fee_on {
        return Ok(U256::zero());
    }

    if k_last.is_zero() {
        return Ok(U256::zero());
    }

    let current_k = state
        .reserve0
        .checked_mul(state.reserve1)
        .ok_or(PairError::Overflow)?;

    let root_k = current_k.integer_sqrt();
    let root_k_last = k_last.integer_sqrt();

    sails_rs::gstd::debug!("root_k {:?}", root_k);
    sails_rs::gstd::debug!("root_k_last {:?}", root_k_last);

    if root_k <= root_k_last {
        return Ok(U256::zero());
    }

    let total_supply = VftService::total_supply();

    let root_k_diff = root_k - root_k_last;

    let numerator = total_supply
        .checked_mul(root_k_diff)
        .ok_or(PairError::Overflow)?;

    let root_k_times_5 = root_k
        .checked_mul(U256::from(5))
        .ok_or(PairError::Overflow)?;

    let denominator = root_k_times_5
        .checked_add(root_k_last)
        .ok_or(PairError::Overflow)?;

    let liquidity = numerator / denominator;

    Ok(liquidity)
}

/// Calculates accumulated swap fees for all LP providers, similar to Uniswap V2.
///
/// This function calculates the total growth in pool reserves due to swap fees (0.3% per swap),
/// subtracts the protocol share (1/6 or 0.05%), and returns the remaining fees (0.25%) as the
/// equivalent LP token value for all providers combined. Returns 0 if no growth or fees disabled.
///
/// Can be called for estimation. Does not modify state.
pub fn calculate_lp_fee(state: &State) -> Result<U256, PairError> {
    let protocol_fee = calculate_protocol_fee(state)?;

    if protocol_fee.is_zero() {
        return Ok(U256::zero());
    }

    // LP fees = total growth - protocol fee (5/6 of growth)
    let total_growth = /* Calculate total growth, e.g., from root_k_diff * denominator / 6 or similar; for simplicity, assume protocol is 1/6 */
        protocol_fee.checked_mul(U256::from(5)).ok_or(PairError::Overflow)?;

    Ok(total_growth)
}

pub fn calculate_lp_user_fee(state: &State, user_lp_balance: U256) -> Result<U256, PairError> {
    let total_lp_fee = calculate_lp_fee(state)?;

    if total_lp_fee.is_zero() {
        return Ok(U256::zero());
    }

    let total_supply = VftService::total_supply();

    if total_supply.is_zero() {
        return Ok(U256::zero());
    }

    let user_share = user_lp_balance
        .checked_mul(total_lp_fee)
        .ok_or(PairError::Overflow)?
        / total_supply;

    Ok(user_share)
}

pub fn calculate_remove_liquidity(
    state: &State,
    liquidity: U256,
) -> Result<(U256, U256), PairError> {
    if liquidity.is_zero() {
        return Ok((U256::zero(), U256::zero()));
    }

    // Simulate protocol fee dilution (calculate potential increase in total_supply)
    let protocol_fee = calculate_protocol_fee(state)?;
    let simulated_total_supply = VftService::total_supply() + protocol_fee; // Dilution from mint_fee

    // Calculate amounts based on reserves (assuming they include swap fees)
    let amount0 = liquidity
        .checked_mul(state.reserve0)
        .ok_or(PairError::Overflow)?
        / simulated_total_supply;
    let amount1 = liquidity
        .checked_mul(state.reserve1)
        .ok_or(PairError::Overflow)?
        / simulated_total_supply;

    Ok((amount0, amount1))
}
