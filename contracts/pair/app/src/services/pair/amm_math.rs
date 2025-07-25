use crate::services::pair::PairError;
use sails_rs::{U256, prelude::*};

pub const MINIMUM_LIQUIDITY: u64 = 1000;
/// Calculates the amount of token B needed for a given amount of token A based on current reserves.
/// Formula: amount_b = (amount_a * reserve_b) / reserve_a (floor division).
/// # Arguments
/// * `amount_a` - Amount of token A to be provided
/// * `reserve_a` - Reserve of token A in the pool
/// * `reserve_b` - Reserve of token B in the pool
/// # Returns
/// * `Ok(U256)` - Amount of token B required
/// * `Err(LiquidityError)` - If reserves are zero or arithmetic overflows
pub fn quote(amount_a: U256, reserve_a: U256, reserve_b: U256) -> Result<U256, PairError> {
    if amount_a.is_zero() {
        return Ok(U256::zero());
    }
    if reserve_a.is_zero() || reserve_b.is_zero() {
        return Err(PairError::InsufficientLiquidity);
    }

    let numerator = amount_a.checked_mul(reserve_b).ok_or(PairError::Overflow)?;

    // reserve_a != 0, division safe
    Ok(numerator / reserve_a)
}

// Calculate optimal token amounts for adding liquidity
pub fn calculate_optimal_amounts(
    reserve_a: U256,
    reserve_b: U256,
    amount_a_desired: U256,
    amount_b_desired: U256,
    amount_a_min: U256,
    amount_b_min: U256,
) -> Result<(U256, U256), PairError> {
    if reserve_a.is_zero() && reserve_b.is_zero() {
        // First liquidity addition
        return Ok((amount_a_desired, amount_b_desired));
    }

    // Calculate optimal amount B based on amount A
    let amount_b_optimal = quote(amount_a_desired, reserve_a, reserve_b)?;

    if amount_b_optimal <= amount_b_desired {
        if amount_b_optimal < amount_b_min {
            return Err(PairError::InsufficientAmountB);
        }
        Ok((amount_a_desired, amount_b_optimal))
    } else {
        // Calculate optimal amount A based on amount B
        let amount_a_optimal = quote(amount_b_desired, reserve_b, reserve_a)?;

        if amount_a_optimal > amount_a_desired {
            return Err(PairError::InsufficientAmountA);
        }

        if amount_a_optimal < amount_a_min {
            return Err(PairError::InsufficientAmountA);
        }

        Ok((amount_a_optimal, amount_b_desired))
    }
}

/// Calculates the liquidity amount to mint based on added token amounts and current pool state.
/// For the first liquidity addition: liquidity = sqrt(amount_a_added * amount_b_added) - MINIMUM_LIQUIDITY
/// For subsequent additions: liquidity = min( (amount_a_added * total_supply / reserve_a), (amount_b_added * total_supply / reserve_b) )
/// Uses floor sqrt and division to match Uniswap V2 behavior.
/// # Arguments
/// * `reserve_a` - Current reserve of token A
/// * `reserve_b` - Current reserve of token B
/// * `amount_a_added` - Added amount of token A (balance_after - reserve_a)
/// * `amount_b_added` - Added amount of token B (balance_after - reserve_b)
/// * `total_supply` - Current total supply of LP tokens
/// # Returns
/// * `Ok(U256)` - Calculated liquidity amount
/// * `Err(PairError)` - If calculations overflow, insufficient added amounts, or liquidity is zero
/// # Notes
/// - MINIMUM_LIQUIDITY = 1000 (burned on first mint to prevent small pool attacks)
/// - Requires num-bigint and num-integer for accurate sqrt on large numbers
/// - Assumes amount_a_added and amount_b_added are positive (checked upstream)
pub fn calculate_liquidity(
    reserve_a: U256,
    reserve_b: U256,
    amount_a_added: U256,
    amount_b_added: U256,
    total_supply: U256,
) -> Result<U256, PairError> {
    let liquidity = if total_supply.is_zero() {
        // First mint: sqrt(amount_a * amount_b) - 1000
        let product = amount_a_added
            .checked_mul(amount_b_added)
            .ok_or(PairError::Overflow)?;
        let sqrt = product.integer_sqrt();

        let min_liquidity = U256::from(MINIMUM_LIQUIDITY);
        if sqrt < min_liquidity {
            return Err(PairError::InsufficientLiquidityMinted);
        }

        sqrt - min_liquidity
    } else {
        // Subsequent mint: min(liq_a, liq_b)
        let liq_a = amount_a_added
            .checked_mul(total_supply)
            .ok_or(PairError::Overflow)?
            / reserve_a;

        let liq_b = amount_b_added
            .checked_mul(total_supply)
            .ok_or(PairError::Overflow)?
            / reserve_b;

        liq_a.min(liq_b)
    };

    if liquidity.is_zero() {
        return Err(PairError::InsufficientLiquidityMinted);
    }

    Ok(liquidity)
}

/// Calculates the maximum output amount of the other asset given an input amount and pair reserves.
/// This accounts for a 0.3% fee (997/1000 multiplier).
/// Formula: amount_out = (amount_in * 997 * reserve_out) / (reserve_in * 1000 + amount_in * 997)
/// Uses floor division
/// # Arguments
/// * `amount_in` - Amount of input asset being swapped
/// * `reserve_in` - Reserve of input asset in the pool
/// * `reserve_out` - Reserve of output asset in the pool
/// # Returns
/// * `Ok(U256)` - Calculated output amount
/// * `Err(PairError)` - If input is zero, insufficient liquidity, or arithmetic overflows
/// # Safety Checks
/// - Requires amount_in > 0
/// - Requires reserves > 0 to prevent division by zero
/// - Uses checked arithmetic to prevent overflows
pub fn get_amount_out(
    amount_in: U256,
    reserve_in: U256,
    reserve_out: U256,
) -> Result<U256, PairError> {
    if amount_in.is_zero() {
        return Err(PairError::InsufficientAmount);
    }
    if reserve_in.is_zero() || reserve_out.is_zero() {
        return Err(PairError::InsufficientLiquidity);
    }

    let fee_multiplier = U256::from(997u64);
    let thousand = U256::from(1000u64);

    // amount_in_with_fee = amount_in * 997
    let amount_in_with_fee = amount_in
        .checked_mul(fee_multiplier)
        .ok_or(PairError::Overflow)?;

    // numerator = amount_in_with_fee * reserve_out
    let numerator = amount_in_with_fee
        .checked_mul(reserve_out)
        .ok_or(PairError::Overflow)?;

    // denominator = reserve_in * 1000 + amount_in_with_fee
    let denominator_part1 = reserve_in
        .checked_mul(thousand)
        .ok_or(PairError::Overflow)?;
    let denominator = denominator_part1
        .checked_add(amount_in_with_fee)
        .ok_or(PairError::Overflow)?;

    // amount_out = numerator / denominator (floor division)
    Ok(numerator / denominator)
}

/// Calculates the required input amount of an asset given a desired output amount and pair reserves.
/// This accounts for a 0.3% fee (997/1000 multiplier).
/// Formula: amount_in = (reserve_in * amount_out * 1000) / (reserve_out - amount_out) * 997) + 1
/// Uses floor division and adds 1 to ensure sufficient input (ceiling effect).
/// # Arguments
/// * `amount_out` - Desired amount of output asset
/// * `reserve_in` - Reserve of input asset in the pool
/// * `reserve_out` - Reserve of output asset in the pool
/// # Returns
/// * `Ok(U256)` - Calculated input amount required
/// * `Err(PairError)` - If output is zero, insufficient liquidity, output exceeds reserve, or arithmetic overflows
/// # Safety Checks
/// - Requires amount_out > 0
/// - Requires reserves > 0 to prevent division by zero
/// - Ensures amount_out < reserve_out to prevent negative denominator
/// - Uses checked arithmetic to prevent overflows
/// - Assumes U256 bounds are sufficient
pub fn get_amount_in(
    amount_out: U256,
    reserve_in: U256,
    reserve_out: U256,
) -> Result<U256, PairError> {
    if amount_out.is_zero() {
        return Err(PairError::InsufficientAmount);
    }
    if reserve_in.is_zero() || reserve_out.is_zero() {
        return Err(PairError::InsufficientLiquidity);
    }
    if amount_out >= reserve_out {
        return Err(PairError::InsufficientLiquidity);
    }

    let fee_multiplier = U256::from(997u64);
    let thousand = U256::from(1000u64);

    // numerator = reserve_in * amount_out * 1000
    let numerator_part1 = reserve_in
        .checked_mul(amount_out)
        .ok_or(PairError::Overflow)?;
    let numerator = numerator_part1
        .checked_mul(thousand)
        .ok_or(PairError::Overflow)?;

    // denominator = (reserve_out - amount_out) * 997
    let denominator_part1 = reserve_out
        .checked_sub(amount_out)
        .ok_or(PairError::Overflow)?;
    let denominator = denominator_part1
        .checked_mul(fee_multiplier)
        .ok_or(PairError::Overflow)?;

    // amount_in = (numerator / denominator) + 1 (floor division + ceiling adjustment)
    let amount_in = (numerator / denominator)
        .checked_add(U256::from(1u64))
        .ok_or(PairError::Overflow)?;

    Ok(amount_in)
}
