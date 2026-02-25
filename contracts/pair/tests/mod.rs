use sails_rs::{client::*, gtest::*, prelude::*, U256};

use pair_client::{pair::*, Config};
use rand::prelude::*;

pub mod liquidity;
pub mod swaps;

pub mod recovery;

mod utils;
pub use utils::*;

// ============================================================================
// ACTOR IDS
// ============================================================================

/// Main test actor (used as default user)
pub const ACTOR_ID: u64 = 42;

/// Test trader accounts
pub const TRADER_1: u64 = 100;
pub const TRADER_2: u64 = 101;
pub const TRADER_3: u64 = 102;

/// Protocol fee recipient address
pub const FEE_TO: u64 = 10;

// ============================================================================
// PROTOCOL CONSTANTS
// ============================================================================

/// Fee denominator (1000 = 100%)
pub const FEE_DENOMINATOR: u64 = 1000;

/// Fee numerator (997 = 99.7%, so 0.3% fee)
pub const FEE_NUMERATOR: u64 = 997;

/// Fee rate (3 = 0.3%)
pub const FEE_RATE: u64 = 3;

/// Minimum liquidity locked forever (in LP tokens)
pub const MINIMUM_LIQUIDITY: u64 = 1000;

pub const FEE_DENOM_BPS: u64 = 10_000; // 100.00%
pub const TREASURY_FEE_BPS: u64 = 5; // 0.05%

// ============================================================================
// TEST AMOUNT CONSTANTS (in base units, multiply by 10^18)
// ============================================================================

/// Very small test amount
pub const TINY_AMOUNT: u64 = 1;

/// Small test amount  
pub const SMALL_AMOUNT: u64 = 100;

/// Medium test amount
pub const MEDIUM_AMOUNT: u64 = 10_000;

/// Large test amount
pub const LARGE_AMOUNT: u64 = 1_000_000;

/// Very large test amount
pub const HUGE_AMOUNT: u64 = 100_000_000;

/// Maximum reasonable test amount
pub const MAX_TEST_AMOUNT: u64 = u64::MAX / 1000; // Avoid overflow

/// Basis points precision (10000 = 100%)
pub const BASIS_POINTS_PRECISION: u64 = 10000;

pub const SWAP_TEST_SIZES_PERCENT: [u64; 8] = [
    1,  // 1% of liquidity (small swap)
    5,  // 5% of liquidity (medium swap)
    10, // 10% of liquidity (large swap)
    20, // 20% of liquidity (very large swap)
    30, // 30% of liquidity (huge swap)
    50, // 50% of liquidity (extreme swap)
    75, // 75% of liquidity (near maximum)
    90, // 90% of liquidity (maximum reasonable)
];
// ============================================================================
// HELPER FUNCTIONS FOR CREATING U256 AMOUNTS
// ============================================================================

/// Create tiny amount (1 token)
pub fn tiny_amount() -> U256 {
    U256::from(TINY_AMOUNT) * U256::exp10(18)
}

/// Create small amount (100 tokens)
pub fn small_amount() -> U256 {
    U256::from(SMALL_AMOUNT) * U256::exp10(18)
}

/// Create medium amount (10K tokens)
pub fn medium_amount() -> U256 {
    U256::from(MEDIUM_AMOUNT) * U256::exp10(18)
}

/// Create large amount (1M tokens)
pub fn large_amount() -> U256 {
    U256::from(LARGE_AMOUNT) * U256::exp10(18)
}

/// Create huge amount (100M tokens)
pub fn huge_amount() -> U256 {
    U256::from(HUGE_AMOUNT) * U256::exp10(18)
}

/// Create amount with custom base and decimals
pub fn amount_with_decimals(base: u64, decimals: usize) -> U256 {
    U256::from(base) * U256::exp10(decimals)
}
