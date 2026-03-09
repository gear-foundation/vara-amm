use crate::services::pair::PairError;
use sails_rs::{U256, prelude::*};

pub const MINIMUM_LIQUIDITY: u64 = 1000;
pub const FEE_DENOM_BPS: u64 = 10_000; // 100.00%
pub const TREASURY_FEE_BPS: u64 = 5; // 0.05%

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

/// Calculates output amount for an ExactInput swap, taking into account
/// an additional treasury fee in the input token.
///
/// 1. User specifies `amount_in_total` (total input they send to the pair).
/// 2. We compute `treasury_fee = amount_in_total * treasury_fee_bps / 10_000`.
/// 3. Remaining part goes into the pool:
///    amount_in_for_pool = amount_in_total - treasury_fee
/// 4. `get_amount_out(amount_in_for_pool, ...)` is used with the standard
///    Uniswap 0.3% fee math (997/1000).
///
/// If `treasury_fee_bps == 0`, then:
///   amount_in_for_pool == amount_in_total and treasury_fee == 0.
///
/// Returns:
///   - amount_in_for_pool : effective input that enters the AMM reserves
///   - amount_out         : output amount computed by Uniswap math
///   - treasury_fee       : part of the input reserved for treasury
pub fn get_amount_out_with_treasury(
    amount_in_total: U256,
    reserve_in: U256,
    reserve_out: U256,
    treasury_fee_bps: u64,
) -> Result<(U256, U256, U256), PairError> {
    if amount_in_total.is_zero() {
        return Err(PairError::InsufficientAmount);
    }

    let denom = U256::from(FEE_DENOM_BPS);
    let treasury_bps = U256::from(treasury_fee_bps);

    // treasury_fee = amount_in_total * treasury_fee_bps / 10_000 (or 0 if disabled)
    let treasury_fee = if treasury_fee_bps == 0 {
        U256::zero()
    } else {
        amount_in_total
            .checked_mul(treasury_bps)
            .and_then(|v| v.checked_div(denom))
            .ok_or(PairError::Overflow)?
    };

    // Portion that actually enters the pool and participates in x*y=k and 0.3% fee logic
    let amount_in_for_pool = amount_in_total
        .checked_sub(treasury_fee)
        .ok_or(PairError::Overflow)?;

    if amount_in_for_pool.is_zero() {
        return Err(PairError::InsufficientAmount);
    }

    // Standard Uniswap V2 output calculation (internal 0.3% fee)
    let amount_out = get_amount_out(amount_in_for_pool, reserve_in, reserve_out)?;

    Ok((amount_in_for_pool, amount_out, treasury_fee))
}

/// Calculates required input amount for an ExactOutput swap, taking into account
/// an additional treasury fee in the input token.
///
/// 1. We first compute how much must enter the pool using standard Uniswap math:
///    amount_in_for_pool = get_amount_in(amount_out, reserve_in, reserve_out)
///    This uses the internal 0.3% swap fee (997/1000).
///
/// 2. If `treasury_fee_bps > 0`, we solve:
///    amount_in_for_pool = amount_in_total * (DENOM - treasury_fee_bps) / DENOM
///
///    Hence:
///    amount_in_total = ceil(amount_in_for_pool * DENOM / (DENOM - treasury_fee_bps))
///
///    Then:
///    treasury_fee = amount_in_total - amount_in_for_pool
///
/// 3. If `treasury_fee_bps == 0`, then:
///    amount_in_total == amount_in_for_pool and treasury_fee == 0.
///    Returns:
///   - amount_in_for_pool : effective input that must enter the pool
///   - amount_in_total    : total input the user has to pay (for slippage checks, transfers)
///   - treasury_fee       : part of input reserved for treasury
pub fn get_amount_in_with_treasury(
    amount_out: U256,
    reserve_in: U256,
    reserve_out: U256,
    treasury_fee_bps: u64,
) -> Result<(U256, U256, U256), PairError> {
    // First, compute the pool-side requirement using Uniswap's 0.3% math
    let amount_in_for_pool = get_amount_in(amount_out, reserve_in, reserve_out)?;

    if amount_in_for_pool.is_zero() {
        return Err(PairError::InsufficientAmount);
    }

    if treasury_fee_bps == 0 {
        // Treasury disabled → user pays exactly what the pool needs
        return Ok((amount_in_for_pool, amount_in_for_pool, U256::zero()));
    }

    let denom = U256::from(FEE_DENOM_BPS);
    let treasury_bps = U256::from(treasury_fee_bps);
    let denom_minus_treasury = denom.checked_sub(treasury_bps).ok_or(PairError::Overflow)?;

    // amount_in_for_pool = amount_in_total * (denom - treasury_bps) / denom
    //
    // amount_in_total = ceil(amount_in_for_pool * denom / (denom - treasury_bps))
    let numerator = amount_in_for_pool
        .checked_mul(denom)
        .ok_or(PairError::Overflow)?;

    let numerator_ceil = numerator
        .checked_add(
            denom_minus_treasury
                .checked_sub(U256::from(1u64))
                .ok_or(PairError::Overflow)?,
        )
        .ok_or(PairError::Overflow)?;

    let amount_in_total = numerator_ceil
        .checked_div(denom_minus_treasury)
        .ok_or(PairError::Overflow)?;

    let treasury_fee = amount_in_total
        .checked_sub(amount_in_for_pool)
        .ok_or(PairError::Overflow)?;

    Ok((amount_in_for_pool, amount_in_total, treasury_fee))
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

#[cfg(test)]
mod prop_tests {
    use crate::pair::amm_math::{
        FEE_DENOM_BPS, calculate_liquidity, calculate_optimal_amounts, get_amount_in,
        get_amount_in_with_treasury, get_amount_out, get_amount_out_with_treasury, quote,
    };
    use proptest::prelude::*;
    use sails_rs::U256;

    fn u256_small() -> impl Strategy<Value = U256> {
        (1u64..=u64::MAX / 2).prop_map(U256::from)
    }

    // quote

    proptest! {
        /// quote(0, _, _) must always return 0.
        #[test]
        fn prop_quote_zero_amount_returns_zero(
            reserve_a in u256_small(),
            reserve_b in u256_small(),
        ) {
            let result = quote(U256::zero(), reserve_a, reserve_b).unwrap();
            prop_assert_eq!(result, U256::zero());
        }

        /// quote must error when either reserve is zero.
        #[test]
        fn prop_quote_zero_reserves_returns_error(amount_a in u256_small()) {
            prop_assert!(quote(amount_a, U256::zero(), U256::from(1u64)).is_err());
            prop_assert!(quote(amount_a, U256::from(1u64), U256::zero()).is_err());
        }

        /// Proportionality: doubling amount_a exactly doubles the result
        /// (within floor-division rounding: result ∈ {2q, 2q+1}).
        #[test]
        fn prop_quote_linear_in_amount(
            amount_a in (1u64..=u32::MAX as u64).prop_map(U256::from),
            reserve_a in (1u64..=u32::MAX as u64).prop_map(U256::from),
            reserve_b in (1u64..=u32::MAX as u64).prop_map(U256::from),
        ) {
            let q1 = quote(amount_a, reserve_a, reserve_b).unwrap();
            let q2 = quote(amount_a * U256::from(2u64), reserve_a, reserve_b).unwrap();
            // Due to floor division: 2*q1 <= q2 <= 2*q1 + 1
            prop_assert!(q2 >= q1 * U256::from(2u64));
            prop_assert!(q2 <= q1 * U256::from(2u64) + U256::from(1u64));
        }

        /// quote is monotonically non-decreasing in amount_a.
        #[test]
        fn prop_quote_monotone_in_amount(
            amount_a in (1u64..=u32::MAX as u64).prop_map(U256::from),
            delta in (0u64..=1000u64).prop_map(U256::from),
            reserve_a in (1u64..=u32::MAX as u64).prop_map(U256::from),
            reserve_b in (1u64..=u32::MAX as u64).prop_map(U256::from),
        ) {
            let q1 = quote(amount_a, reserve_a, reserve_b).unwrap();
            let q2 = quote(amount_a + delta, reserve_a, reserve_b).unwrap();
            prop_assert!(q2 >= q1);
        }
    }

    // get_amount_out
    proptest! {
        /// Output is always strictly less than reserve_out (pool can't be drained).
        #[test]
        fn prop_get_amount_out_less_than_reserve(
            amount_in in u256_small(),
            reserve_in in u256_small(),
            reserve_out in u256_small(),
        ) {
            if let Ok(out) = get_amount_out(amount_in, reserve_in, reserve_out) {
                prop_assert!(out < reserve_out);
            }
        }

        /// Output is strictly positive for positive inputs and reserves.
        #[test]
        fn prop_get_amount_out_positive(
            amount_in in u256_small(),
            reserve_in in u256_small(),
            reserve_out in u256_small(),
        ) {
            if let Ok(out) = get_amount_out(amount_in, reserve_in, reserve_out) {
                prop_assert!(out > U256::zero());
            }
        }
        /// Monotone: larger input → at least as large output.
        #[test]
        fn prop_get_amount_out_monotone(
            amount_in in (1u64..=u32::MAX as u64).prop_map(U256::from),
            delta in (1u64..=1000u64).prop_map(U256::from),
            reserve_in in (1u64..=u32::MAX as u64).prop_map(U256::from),
            reserve_out in (1u64..=u32::MAX as u64).prop_map(U256::from),
        ) {
            if let (Ok(out1), Ok(out2)) = (
                get_amount_out(amount_in, reserve_in, reserve_out),
                get_amount_out(amount_in + delta, reserve_in, reserve_out),
            ) {
                prop_assert!(out2 >= out1);
            }
        }

        /// Zero input must return an error.
        #[test]
        fn prop_get_amount_out_zero_input_is_err(
            reserve_in in u256_small(),
            reserve_out in u256_small(),
        ) {
            prop_assert!(get_amount_out(U256::zero(), reserve_in, reserve_out).is_err());
        }
    }

    // get_amount_in
    proptest! {
        /// Required input is always > 0 for valid parameters.
        #[test]
        fn prop_get_amount_in_positive(
            amount_out in (1u64..=u32::MAX as u64).prop_map(U256::from),
            reserve_in in (1u64..=u32::MAX as u64).prop_map(U256::from),
            reserve_out in (1u64..=u32::MAX as u64).prop_map(U256::from),
        ) {
            // Only test where amount_out < reserve_out
            let amount_out = if amount_out >= reserve_out {
                reserve_out / U256::from(2u64)
            } else {
                amount_out
            };
            if amount_out.is_zero() { return Ok(()); }

            if let Ok(r_in) = get_amount_in(amount_out, reserve_in, reserve_out) {
                prop_assert!(r_in > U256::zero());
            }
        }

        /// amount_out >= reserve_out must always fail (pool invariant).
        #[test]
        fn prop_get_amount_in_output_exceeds_reserve_is_err(
            reserve_out in u256_small(),
            excess in (0u64..=100u64).prop_map(U256::from),
            reserve_in in u256_small(),
        ) {
            let bad_out = reserve_out + excess;
            prop_assert!(get_amount_in(bad_out, reserve_in, reserve_out).is_err());
        }

        /// Round-trip: get_amount_in then get_amount_out must yield ≥ amount_out.
        ///
        /// i.e., if you pay `amount_in = get_amount_in(desired_out, ...)`,
        /// then `get_amount_out(amount_in, ...)` >= desired_out.
        #[test]
        fn prop_amount_in_out_roundtrip(
            amount_out in (1u64..=1_000_000u64).prop_map(U256::from),
            reserve_in in (1_000_000u64..=u32::MAX as u64).prop_map(U256::from),
            reserve_out in (1_000_000u64..=u32::MAX as u64).prop_map(U256::from),
        ) {
            let amount_out = if amount_out >= reserve_out {
                return Ok(());
            } else {
                amount_out
            };

            if let Ok(amount_in) = get_amount_in(amount_out, reserve_in, reserve_out)
                && let Ok(out_check) = get_amount_out(amount_in, reserve_in, reserve_out) {
                    // Due to ceiling in get_amount_in, out_check must be >= amount_out
                    prop_assert!(out_check >= amount_out,
                        "round-trip failed: desired={}, got={}", amount_out, out_check);
                }

        }
    }

    // get_amount_out_with_treasury

    proptest! {
        /// treasury_fee + amount_in_for_pool == amount_in_total.
        #[test]
        fn prop_treasury_out_fee_plus_pool_eq_total(
            amount_in in u256_small(),
            reserve_in in u256_small(),
            reserve_out in u256_small(),
            treasury_bps in 0u64..=FEE_DENOM_BPS,
        ) {
            if let Ok((amount_in_for_pool, _amount_out, treasury_fee)) =
                get_amount_out_with_treasury(amount_in, reserve_in, reserve_out, treasury_bps)
            {
                let reconstructed = amount_in_for_pool
                    .checked_add(treasury_fee)
                    .unwrap();
                prop_assert_eq!(reconstructed, amount_in,
                    "pool + treasury != total_in");
            }
        }

        /// With zero treasury bps, treasury_fee must be zero.
        #[test]
        fn prop_treasury_out_zero_bps_no_fee(
            amount_in in u256_small(),
            reserve_in in u256_small(),
            reserve_out in u256_small(),
        ) {
            if let Ok((_pool, _out, fee)) =
                get_amount_out_with_treasury(amount_in, reserve_in, reserve_out, 0)
            {
                prop_assert_eq!(fee, U256::zero());
            }
        }

        /// Output must be < reserve_out.
        #[test]
        fn prop_treasury_out_less_than_reserve(
            amount_in in u256_small(),
            reserve_in in u256_small(),
            reserve_out in u256_small(),
            treasury_bps in 0u64..FEE_DENOM_BPS,
        ) {
            if let Ok((_pool, out, _fee)) =
                get_amount_out_with_treasury(amount_in, reserve_in, reserve_out, treasury_bps)
            {
                prop_assert!(out < reserve_out);
            }
        }

        /// Higher treasury bps → less or equal output (more of the input is diverted).
        #[test]
        fn prop_treasury_out_higher_bps_less_output(
            amount_in in (1_000u64..=u32::MAX as u64).prop_map(U256::from),
            reserve_in in (1_000u64..=u32::MAX as u64).prop_map(U256::from),
            reserve_out in (1_000u64..=u32::MAX as u64).prop_map(U256::from),
            bps_low in 0u64..=50u64,
            bps_high in 51u64..=500u64,
        ) {
            if let (Ok((_, out_low, _)), Ok((_, out_high, _))) = (
                get_amount_out_with_treasury(amount_in, reserve_in, reserve_out, bps_low),
                get_amount_out_with_treasury(amount_in, reserve_in, reserve_out, bps_high),
            ) {
                prop_assert!(out_low >= out_high,
                    "higher bps should yield <= output: low_bps={bps_low} out={out_low}, high_bps={bps_high} out={out_high}");
            }
        }
    }

    // get_amount_in_with_treasury

    proptest! {
        /// amount_in_total - amount_in_for_pool == treasury_fee.
        #[test]
        fn prop_treasury_in_total_minus_pool_eq_fee(
            amount_out in (1u64..=1_000_000u64).prop_map(U256::from),
            reserve_in in (1_000_000u64..=u32::MAX as u64).prop_map(U256::from),
            reserve_out in (1_000_000u64..=u32::MAX as u64).prop_map(U256::from),
            treasury_bps in 0u64..=500u64,
        ) {
            let amount_out = if amount_out >= reserve_out { return Ok(()); } else { amount_out };

            if let Ok((pool, total, fee)) =
                get_amount_in_with_treasury(amount_out, reserve_in, reserve_out, treasury_bps)
            {
                let expected_fee = total.checked_sub(pool).unwrap();
                prop_assert_eq!(fee, expected_fee);
            }
        }

        /// amount_in_total >= amount_in_for_pool (treasury never makes total cheaper).
        #[test]
        fn prop_treasury_in_total_gte_pool(
            amount_out in (1u64..=1_000_000u64).prop_map(U256::from),
            reserve_in in (1_000_000u64..=u32::MAX as u64).prop_map(U256::from),
            reserve_out in (1_000_000u64..=u32::MAX as u64).prop_map(U256::from),
            treasury_bps in 0u64..=500u64,
        ) {
            let amount_out = if amount_out >= reserve_out { return Ok(()); } else { amount_out };

            if let Ok((pool, total, _fee)) =
                get_amount_in_with_treasury(amount_out, reserve_in, reserve_out, treasury_bps)
            {
                prop_assert!(total >= pool);
            }
        }

        /// With zero treasury, total == pool and fee == 0.
        #[test]
        fn prop_treasury_in_zero_bps_no_fee(
            amount_out in (1u64..=1_000_000u64).prop_map(U256::from),
            reserve_in in (1_000_000u64..=u32::MAX as u64).prop_map(U256::from),
            reserve_out in (1_000_000u64..=u32::MAX as u64).prop_map(U256::from),
        ) {
            let amount_out = if amount_out >= reserve_out { return Ok(()); } else { amount_out };

            if let Ok((pool, total, fee)) =
                get_amount_in_with_treasury(amount_out, reserve_in, reserve_out, 0)
            {
                prop_assert_eq!(fee, U256::zero());
                prop_assert_eq!(pool, total);
            }
        }

        /// Round-trip: if user pays amount_in_total, the pool part gets them >= amount_out.
        #[test]
        fn prop_treasury_in_roundtrip(
            amount_out in (1u64..=100_000u64).prop_map(U256::from),
            reserve_in in (10_000_000u64..=u32::MAX as u64).prop_map(U256::from),
            reserve_out in (10_000_000u64..=u32::MAX as u64).prop_map(U256::from),
            treasury_bps in 0u64..=500u64,
        ) {
            let amount_out = if amount_out >= reserve_out { return Ok(()); } else { amount_out };

            if let Ok((pool_in, _total, _fee)) =
                get_amount_in_with_treasury(amount_out, reserve_in, reserve_out, treasury_bps)
                && let Ok(actual_out) = get_amount_out(pool_in, reserve_in, reserve_out) {
                    prop_assert!(actual_out >= amount_out,
                        "round-trip: desired={amount_out}, got={actual_out}");
                }

        }
    }

    // calculate_liquidity

    proptest! {
        /// First mint: liquidity > 0 only when sqrt(a*b) > MINIMUM_LIQUIDITY.
        #[test]
        fn prop_first_mint_positive_liquidity(
            amount_a in (1_000_000u64..=u32::MAX as u64).prop_map(U256::from),
            amount_b in (1_000_000u64..=u32::MAX as u64).prop_map(U256::from),
        ) {
            let result = calculate_liquidity(
                U256::zero(), U256::zero(),
                amount_a, amount_b,
                U256::zero(),
            );
            if let Ok(liq) = result { prop_assert!(liq > U256::zero()) }
        }

        /// First mint returns error when product is too small (sqrt < 1000).
        #[test]
        fn prop_first_mint_too_small_returns_err(
            // Both amounts = 1 → sqrt(1) = 1 < 1000
            amount_a in (1u64..=30u64).prop_map(U256::from),
            amount_b in (1u64..=30u64).prop_map(U256::from),
        ) {
            // sqrt(30*30) = 30 < 1000, so all combos here should err
            let result = calculate_liquidity(
                U256::zero(), U256::zero(),
                amount_a, amount_b,
                U256::zero(),
            );
            prop_assert!(result.is_err());
        }

        /// Subsequent mint: liquidity is proportional (min of liq_a, liq_b).
        /// With balanced amounts, result must be > 0.
        #[test]
        fn prop_subsequent_mint_positive(
            reserve in (1_000_000u64..=u32::MAX as u64).prop_map(U256::from),
            add_a in (1_000u64..=100_000u64).prop_map(U256::from),
            add_b in (1_000u64..=100_000u64).prop_map(U256::from),
            total_supply in (1_000_000u64..=u32::MAX as u64).prop_map(U256::from),
        ) {
            if let Ok(liq) = calculate_liquidity(reserve, reserve, add_a, add_b, total_supply) {
                prop_assert!(liq > U256::zero());
            }
        }

        /// Subsequent mint: adding more tokens yields at least as much liquidity.
        #[test]
        fn prop_subsequent_mint_monotone(
            reserve in (1_000_000u64..=u32::MAX as u64).prop_map(U256::from),
            add_a in (1_000u64..=50_000u64).prop_map(U256::from),
            extra in (0u64..=1_000u64).prop_map(U256::from),
            add_b in (1_000u64..=50_000u64).prop_map(U256::from),
            total_supply in (1_000_000u64..=u32::MAX as u64).prop_map(U256::from),
        ) {
            let liq1 = calculate_liquidity(reserve, reserve, add_a, add_b, total_supply);
            let liq2 = calculate_liquidity(reserve, reserve, add_a + extra, add_b + extra, total_supply);

            if let (Ok(l1), Ok(l2)) = (liq1, liq2) {
                prop_assert!(l2 >= l1);
            }
        }
    }

    // calculate_optimal_amounts
    proptest! {
        /// For first liquidity addition (both reserves 0), output equals input.
        #[test]
        fn prop_optimal_first_add_passthrough(
            amount_a in u256_small(),
            amount_b in u256_small(),
        ) {
            let (a, b) = calculate_optimal_amounts(
                U256::zero(), U256::zero(),
                amount_a, amount_b,
                U256::zero(), U256::zero(),
            ).unwrap();
            prop_assert_eq!(a, amount_a);
            prop_assert_eq!(b, amount_b);
        }

        /// Result must satisfy: a <= amount_a_desired AND b <= amount_b_desired.
        #[test]
        fn prop_optimal_amounts_within_desired(
            reserve in (1_000_000u64..=u32::MAX as u64).prop_map(U256::from),
            desired_a in (1_000u64..=1_000_000u64).prop_map(U256::from),
            desired_b in (1_000u64..=1_000_000u64).prop_map(U256::from),
        ) {
            let (a, b) = match calculate_optimal_amounts(
                reserve, reserve,
                desired_a, desired_b,
                U256::zero(), U256::zero(),
            ) {
                Ok(v) => v,
                Err(_) => return Ok(()),
            };

            prop_assert!(a <= desired_a, "a={a} > desired_a={desired_a}");
            prop_assert!(b <= desired_b, "b={b} > desired_b={desired_b}");
        }

        /// Pool price invariant: a/b must equal reserve_a/reserve_b (within 1 unit rounding).
        ///
        /// Concretely: a * reserve_b == b * reserve_a  (or differ by at most reserve_b)
        #[test]
        fn prop_optimal_amounts_maintain_price_ratio(
            reserve_a in (1_000_000u64..=u32::MAX as u64).prop_map(U256::from),
            reserve_b in (1_000_000u64..=u32::MAX as u64).prop_map(U256::from),
            desired_a in (1_000u64..=1_000_000u64).prop_map(U256::from),
            desired_b in (1_000u64..=1_000_000u64).prop_map(U256::from),
        ) {
            let (a, b) = match calculate_optimal_amounts(
                reserve_a, reserve_b,
                desired_a, desired_b,
                U256::zero(), U256::zero(),
            ) {
                Ok(v) => v,
                Err(_) => return Ok(()),
            };

            // a / b ≈ reserve_a / reserve_b
            // a * reserve_b ≈ b * reserve_a  (within 1 ULP of floor division)
            let lhs = a.checked_mul(reserve_b).unwrap_or(U256::MAX);
            let rhs = b.checked_mul(reserve_a).unwrap_or(U256::MAX);
            let diff = if lhs >= rhs { lhs - rhs } else { rhs - lhs };

            prop_assert!(diff <= reserve_b.max(reserve_a),
                "price ratio violated: a={a}, b={b}, ra={reserve_a}, rb={reserve_b}, diff={diff}");
        }
    }
}
