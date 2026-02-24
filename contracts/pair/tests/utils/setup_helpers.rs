use crate::*;

/// Setup initial liquidity for any test (ОБЩАЯ функция)
pub async fn setup_initial_liquidity(
    env: &mut TestEnv,
    user: ActorId,
    amount_a: U256,
    amount_b: U256,
) -> U256 {
    let (before_a, before_b, before_lp) = env.get_balances(user).await;

    env.pair_client
        .add_liquidity(
            amount_a,
            amount_b,
            U256::zero(),
            U256::zero(),
            //amount_a * U256::from(90) / U256::from(100),
            //  amount_b * U256::from(90) / U256::from(100),
            env.get_deadline(),
        )
        .with_args(|args| args.with_actor_id(user))
        .send_recv(env.pair_id)
        .await
        .unwrap();

    let (after_a, after_b, after_lp) = env.get_balances(user).await;
    after_lp - before_lp // Return LP tokens received
}

pub async fn setup_liquidity_with_ratio(
    env: &mut TestEnv,
    user: ActorId,
    base_amount: U256,
    ratio: (u64, u64),
) -> (U256, U256, U256) {
    let amount_a = base_amount * U256::from(ratio.0) / U256::from(ratio.1.max(ratio.0));
    let amount_b = base_amount * U256::from(ratio.1) / U256::from(ratio.1.max(ratio.0));
    println!("base amount {:?}", base_amount);
    println!("amount_a {:?}", amount_a);
    println!("amount_b {:?}", amount_b);
    let lp_tokens = setup_initial_liquidity(env, user, amount_a, amount_b).await;
    (amount_a, amount_b, lp_tokens)
}

pub fn calculate_expected_liquidity_first(amount_a: U256, amount_b: U256) -> U256 {
    (amount_a * amount_b).integer_sqrt() - U256::from(MINIMUM_LIQUIDITY)
}

pub fn calculate_expected_liquidity_subsequent(
    amount_a: U256,
    amount_b: U256,
    reserve_a: U256,
    reserve_b: U256,
    total_supply: U256,
) -> U256 {
    let liquidity_a = amount_a * total_supply / reserve_a;
    let liquidity_b = amount_b * total_supply / reserve_b;
    liquidity_a.min(liquidity_b)
}

// Helper for testing minimum amount failures
pub async fn expect_minimum_amount_failure(
    env: &mut TestEnv,
    user: ActorId,
    desired_a: U256,
    desired_b: U256,
    min_a: U256,
    min_b: U256,
) {
    let result = env
        .pair_client
        .add_liquidity(desired_a, desired_b, min_a, min_b, env.get_deadline())
        .with_args(|args| args.with_actor_id(user))
        .send_recv(env.pair_id)
        .await;

    assert!(
        result.is_err(),
        "Should fail because of wrong minimum amount"
    );
}

pub fn calculate_swap_amount_from_percent(reserve: U256, percentage: u64) -> U256 {
    reserve * U256::from(percentage) / U256::from(100)
}

pub fn calculate_expected_price_impact(
    amount_in: U256,
    reserve_in: U256,
    reserve_out: U256,
) -> u64 {
    if reserve_in == U256::zero() || reserve_out == U256::zero() {
        return 0;
    }

    let price_before = reserve_in * U256::from(BASIS_POINTS_PRECISION) / reserve_out;

    let amount_out = SwapCalculator::calculate_exact_output(amount_in, reserve_in, reserve_out);

    let new_reserve_in = reserve_in + amount_in;
    let new_reserve_out = reserve_out - amount_out;

    if new_reserve_out == U256::zero() {
        return u64::MAX;
    }

    let price_after = new_reserve_in * U256::from(BASIS_POINTS_PRECISION) / new_reserve_out;

    println!("price_after {:?}", price_after);
    println!("price_before {:?}", price_before);
    if price_after <= price_before {
        0
    } else {
        ((price_after - price_before) / price_before).as_u64()
    }
}
