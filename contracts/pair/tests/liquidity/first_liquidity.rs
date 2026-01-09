use crate::*;

#[tokio::test]
async fn test_first_liquidity_balanced_amounts() {
    let treasury_id = ActorId::zero();
    let mut env = TestEnv::new(treasury_id).await;
    let user = ACTOR_ID.into();

    let amount_a = U256::from(10) * U256::exp10(18); // 10 tokens
    let amount_b = U256::from(15) * U256::exp10(18); // 15 tokens

    env.setup_user(ACTOR_ID, amount_a.max(amount_b) * U256::from(2))
        .await;

    let (before_a, before_b, before_lp) = env.get_balances(user).await;

    env.pair_client
        .add_liquidity(
            amount_a,
            amount_b,
            amount_a / U256::from(2),
            amount_b / U256::from(2),
            env.get_deadline(),
        )
        .with_args(|args| args.with_actor_id(user))
        .send_recv(env.pair_id)
        .await
        .unwrap();

    let (after_a, after_b, after_lp) = env.get_balances(user).await;

    // Verify token transfers
    assert_eq!(
        before_a - after_a,
        amount_a,
        "Token A should be transferred"
    );
    assert_eq!(
        before_b - after_b,
        amount_b,
        "Token B should be transferred"
    );

    // Verify LP tokens minted using first liquidity formula
    let expected_liquidity = calculate_expected_liquidity_first(amount_a, amount_b);
    assert_eq!(
        after_lp - before_lp,
        expected_liquidity,
        "LP tokens should match sqrt formula"
    );

    // Verify total supply includes minimum liquidity
    let total_supply = env
        .lp_vft_client
        .total_supply()
        .recv(env.pair_id)
        .await
        .unwrap();
    assert_eq!(
        total_supply,
        expected_liquidity + U256::from(MINIMUM_LIQUIDITY),
        "Total supply should include minimum liquidity lock"
    );

    println!("✅ First liquidity balanced amounts test passed");
}

#[tokio::test]
async fn test_first_liquidity_minimum_amounts() {
    let treasury_id = ActorId::zero();
    let mut env = TestEnv::new(treasury_id).await;
    let user = ACTOR_ID.into();

    // Test with very small amounts
    let amount_a = U256::from(1000); // Minimal amount
    let amount_b = U256::from(1000);

    env.setup_user(ACTOR_ID, amount_a * U256::from(1000)).await;

    let result = env
        .pair_client
        .add_liquidity(amount_a, amount_b, amount_a, amount_b, env.get_deadline())
        .with_args(|args| args.with_actor_id(user))
        .send_recv(env.pair_id)
        .await;

    assert!(
        result.is_err(),
        "Should fail with unsifficient liquidity minted"
    );

    println!("✅ Minimum amounts test completed");
}

#[tokio::test]
async fn test_first_liquidity_maximum_amounts() {
    let treasury_id = ActorId::zero();
    let mut env = TestEnv::new(treasury_id).await;
    let user = ACTOR_ID.into();

    // Test with very large amounts
    let amount_a = U256::from(1000000) * U256::exp10(18); // 1M tokens
    let amount_b = U256::from(2000000) * U256::exp10(18); // 2M tokens

    env.setup_user(ACTOR_ID, amount_a.max(amount_b) * U256::from(2))
        .await;

    let (before_a, before_b, before_lp) = env.get_balances(user).await;

    let result = env
        .pair_client
        .add_liquidity(
            amount_a,
            amount_b,
            amount_a / U256::from(2),
            amount_b / U256::from(2),
            env.get_deadline(),
        )
        .with_args(|args| args.with_actor_id(user))
        .send_recv(env.pair_id)
        .await
        .unwrap();

    let (after_a, after_b, after_lp) = env.get_balances(user).await;
    // Verify token transfers
    assert_eq!(
        before_a - after_a,
        amount_a,
        "Token A should be transferred"
    );
    assert_eq!(
        before_b - after_b,
        amount_b,
        "Token B should be transferred"
    );

    // Verify LP tokens minted (sqrt(a*b) - MINIMUM_LIQUIDITY for first addition)
    let expected_liquidity = (amount_a * amount_b).integer_sqrt() - U256::from(1000);
    assert_eq!(
        after_lp - before_lp,
        expected_liquidity,
        "LP tokens mismatch"
    );

    // Verify total supply
    let total_supply = env
        .lp_vft_client
        .total_supply()
        .recv(env.pair_id)
        .await
        .unwrap();
    assert_eq!(
        total_supply,
        expected_liquidity + U256::from(1000),
        "Total supply mismatch"
    );

    println!("✅ Maximum amounts test passed");
}
