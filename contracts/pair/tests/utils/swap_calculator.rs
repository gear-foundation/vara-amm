use crate::*;

pub struct SwapCalculator;

impl SwapCalculator {
    pub fn calculate_amount_in(amount_out: U256, reserve_in: U256, reserve_out: U256) -> U256 {
        let thousand = U256::from(FEE_DENOMINATOR);
        let fee_multiplier = U256::from(FEE_NUMERATOR);

        let numerator = reserve_in
            .checked_mul(amount_out)
            .unwrap()
            .checked_mul(thousand)
            .unwrap();
        let denominator_part1 = reserve_out.checked_sub(amount_out).unwrap();
        let denominator = denominator_part1.checked_mul(fee_multiplier).unwrap();

        (numerator / denominator)
            .checked_add(U256::from(1))
            .unwrap()
    }

    pub fn calculate_fee(amount_in: U256) -> U256 {
        amount_in * U256::from(FEE_RATE) / U256::from(FEE_DENOMINATOR)
    }

    pub fn validate_k_invariant(
        old_reserve_a: U256,
        old_reserve_b: U256,
        new_reserve_a: U256,
        new_reserve_b: U256,
        amount_in: U256,
        a_to_b: bool,
    ) -> bool {
        let thousand = U256::from(FEE_DENOMINATOR);
        let fee_amount = amount_in * U256::from(FEE_RATE);
        let (adjusted_a, adjusted_b) = if a_to_b {
            // A -> B: fee is paid in token A
            (
                new_reserve_a * thousand - fee_amount,
                new_reserve_b * thousand,
            )
        } else {
            // B -> A: fee is paid in token B
            (
                new_reserve_a * thousand,
                new_reserve_b * thousand - fee_amount,
            )
        };

        let left = adjusted_a * adjusted_b;
        let right = old_reserve_a * old_reserve_b * thousand * thousand;
        left >= right
    }

    pub fn calculate_protocol_fee(
        reserve_a: U256,
        reserve_b: U256,
        k_last: U256,
        total_supply: U256,
    ) -> U256 {
        let current_k = reserve_a * reserve_b;

        if current_k <= k_last {
            return U256::zero();
        }

        let root_k = current_k.integer_sqrt();
        let root_k_last = k_last.integer_sqrt();

        if root_k <= root_k_last {
            return U256::zero();
        }

        let numerator = total_supply * (root_k - root_k_last);

        let denominator = root_k * U256::from(5) + root_k_last;

        if denominator == U256::zero() {
            return U256::zero();
        }

        numerator / denominator
    }

    pub fn calculate_new_total_supply(
        reserve_a: U256,
        reserve_b: U256,
        k_last: U256,
        current_total_supply: U256,
    ) -> U256 {
        let protocol_fee =
            Self::calculate_protocol_fee(reserve_a, reserve_b, k_last, current_total_supply);
        current_total_supply + protocol_fee
    }

    pub fn calculate_remove_amounts_with_protocol_fee(
        lp_tokens: U256,
        reserve_a: U256,
        reserve_b: U256,
        k_last: U256,
        current_total_supply: U256,
    ) -> (U256, U256) {
        let new_total_supply =
            Self::calculate_new_total_supply(reserve_a, reserve_b, k_last, current_total_supply);

        let amount_a = (lp_tokens * reserve_a) / new_total_supply;
        let amount_b = (lp_tokens * reserve_b) / new_total_supply;

        (amount_a, amount_b)
    }
    /// Calculates minimum output considering allowed slippage tolerance
    pub fn calculate_min_out_with_slippage(expected_out: U256, max_slippage_bp: u64) -> U256 {
        let slippage_factor = U256::from(10000 - max_slippage_bp); // If 5% = 500bp, then factor = 9500
        (expected_out * slippage_factor) / U256::from(10000)
    }

    pub fn calculate_exact_output(amount_in: U256, reserve_in: U256, reserve_out: U256) -> U256 {
        if amount_in == U256::zero() || reserve_in == U256::zero() || reserve_out == U256::zero() {
            return U256::zero();
        }

        let amount_in_with_fee = amount_in * U256::from(FEE_NUMERATOR);

        let numerator = amount_in_with_fee * reserve_out;

        let denominator = reserve_in * U256::from(FEE_DENOMINATOR) + amount_in_with_fee;

        if denominator == U256::zero() {
            return U256::zero();
        }

        numerator / denominator
    }
}
