use crate::*;

#[tokio::test]
async fn test_add_liquidity_expired_deadline() {
    let treasury_id = ActorId::zero();
    let mut env = TestEnv::new(treasury_id).await;
    let user = ACTOR_ID.into();
    let amount = medium_amount();

    env.setup_user(ACTOR_ID, amount * U256::from(2)).await;

    // Set deadline in the past
    let expired_deadline = env.remoting.system().block_timestamp() - 1;

    let result = env
        .pair_client
        .add_liquidity(
            amount,
            amount,
            amount / U256::from(2),
            amount / U256::from(2),
            expired_deadline,
        )
        .with_args(|args| args.with_actor_id(user))
        .send_recv(env.pair_id)
        .await;

    assert!(result.is_err(), "Should fail with expired deadline");
    println!("✅ Add liquidity expired deadline test passed");
}

#[tokio::test]
async fn test_add_liquidity_subsequent_perfect_ratio() {
    let treasury_id = ActorId::zero();
    let mut env = TestEnv::new(treasury_id).await;
    let user1 = ACTOR_ID.into();
    let user2 = ActorId::from(43);

    // Setup initial liquidity with 1:2 ratio
    let initial_a = medium_amount();
    let initial_b = medium_amount() * U256::from(2);

    env.setup_user(ACTOR_ID, initial_a * U256::from(2)).await;
    env.setup_user(43, initial_a * U256::from(4)).await;

    // First user adds initial liquidity
    setup_initial_liquidity(&mut env, user1, initial_a, initial_b).await;

    // Second user adds with perfect ratio (1:2)
    let second_a = medium_amount() / U256::from(2);
    let second_b = medium_amount();

    let (before_a, before_b, before_lp) = env.get_balances(user2).await;

    env.pair_client
        .add_liquidity(second_a, second_b, second_a, second_b, env.get_deadline())
        .with_args(|args| args.with_actor_id(user2))
        .send_recv(env.pair_id)
        .await
        .unwrap();

    let (after_a, after_b, after_lp) = env.get_balances(user2).await;

    // With perfect ratio, both amounts should be used exactly
    assert_eq!(before_a - after_a, second_a, "Should use exact amount A");
    assert_eq!(before_b - after_b, second_b, "Should use exact amount B");

    // Verify LP tokens calculation
    let (reserve_a, reserve_b) = env
        .pair_client
        .get_reserves()
        .recv(env.pair_id)
        .await
        .unwrap();
    let total_supply = env
        .lp_vft_client
        .total_supply()
        .recv(env.pair_id)
        .await
        .unwrap();

    let expected_liquidity = calculate_expected_liquidity_subsequent(
        second_a,
        second_b,
        reserve_a,
        reserve_b,
        total_supply,
    );

    let received_lp = after_lp - before_lp;
    assert_eq!(
        received_lp, expected_liquidity,
        "LP tokens should match calculation"
    );

    println!("✅ Perfect ratio subsequent addition test passed");
}

#[tokio::test]
async fn test_add_liquidity_subsequent_excess_token_a() {
    let treasury_id = ActorId::zero();
    let mut env = TestEnv::new(treasury_id).await;
    let user1 = ACTOR_ID.into();
    let user2 = ActorId::from(43);

    // Setup initial liquidity with 1:2 ratio
    let initial_a = medium_amount();
    let initial_b = medium_amount() * U256::from(2);

    env.setup_user(ACTOR_ID, initial_a * U256::from(2)).await;
    env.setup_user(43, initial_a * U256::from(10)).await;

    setup_initial_liquidity(&mut env, user1, initial_a, initial_b).await;

    // Second user tries to add with excess token A
    let desired_a = medium_amount() * U256::from(2); // Too much A for the ratio
    let desired_b = medium_amount(); // Correct B amount
    let min_a = medium_amount() / U256::from(5);
    let min_b = desired_b * U256::from(8) / U256::from(10); // 20% slippage on B

    let (before_a, before_b, _) = env.get_balances(user2).await;

    env.pair_client
        .add_liquidity(desired_a, desired_b, min_a, min_b, env.get_deadline())
        .with_args(|args| args.with_actor_id(user2))
        .send_recv(env.pair_id)
        .await
        .unwrap();

    let (after_a, after_b, _) = env.get_balances(user2).await;

    let used_a = before_a - after_a;
    let used_b = before_b - after_b;

    // Should optimize to use correct ratio - all of B, optimal amount of A
    assert_eq!(used_b, desired_b, "Should use all of token B");
    assert_eq!(
        used_a,
        desired_b / U256::from(2),
        "Should use optimal amount of A (half of B for 1:2 ratio)"
    );
    assert!(used_a < desired_a, "Should use less than desired token A");
    assert!(used_a >= min_a, "Should meet minimum A requirement");

    println!("✅ Excess token A optimization test passed");
}

#[tokio::test]
async fn test_add_liquidity_subsequent_excess_token_b() {
    let treasury_id = ActorId::zero();
    let mut env = TestEnv::new(treasury_id).await;
    let user1 = ACTOR_ID.into();
    let user2 = ActorId::from(43);

    // Setup initial liquidity with 1:2 ratio
    let initial_a = medium_amount();
    let initial_b = medium_amount() * U256::from(2);

    env.setup_user(ACTOR_ID, initial_a * U256::from(2)).await;
    env.setup_user(43, initial_b * U256::from(10)).await;

    setup_initial_liquidity(&mut env, user1, initial_a, initial_b).await;

    // Second user tries to add with excess token B
    let desired_a = medium_amount() / U256::from(2);
    let desired_b = medium_amount() * U256::from(2); // Too much B for amount A
    let min_a = desired_a * U256::from(8) / U256::from(10); // 20% slippage on A
    let min_b = desired_a; // Should get exactly 2x the A amount

    let (before_a, before_b, _) = env.get_balances(user2).await;

    env.pair_client
        .add_liquidity(desired_a, desired_b, min_a, min_b, env.get_deadline())
        .with_args(|args| args.with_actor_id(user2))
        .send_recv(env.pair_id)
        .await
        .unwrap();

    let (after_a, after_b, _) = env.get_balances(user2).await;

    let used_a = before_a - after_a;
    let used_b = before_b - after_b;

    // Should optimize to use correct ratio - all of A, optimal amount of B
    assert_eq!(used_a, desired_a, "Should use all of token A");
    assert_eq!(
        used_b,
        desired_a * U256::from(2),
        "Should use optimal amount of B (double of A for 1:2 ratio)"
    );
    assert!(used_b < desired_b, "Should use less than desired token B");
    assert!(used_b >= min_b, "Should meet minimum B requirement");

    println!("✅ Excess token B optimization test passed");
}

#[tokio::test]
async fn test_add_liquidity_insufficient_minimum_amounts() {
    let treasury_id = ActorId::zero();
    let mut env = TestEnv::new(treasury_id).await;
    let user1 = ACTOR_ID.into();
    let user2 = ActorId::from(43);

    // Setup initial liquidity
    let initial_a = medium_amount();
    let initial_b = medium_amount() * U256::from(2);

    env.setup_user(ACTOR_ID, initial_a * U256::from(2)).await;
    env.setup_user(43, initial_a * U256::from(10)).await;

    setup_initial_liquidity(&mut env, user1, initial_a, initial_b).await;

    // Test Case 1: Minimum A too high
    expect_minimum_amount_failure(
        &mut env,
        user2,
        medium_amount(),                                  // desired_a
        medium_amount(), // desired_b (will result in using 50% A due to 1:2 ratio)
        medium_amount() * U256::from(6) / U256::from(10), // min_a: require 60% but will only get 50%
        medium_amount() / U256::from(2),                  // min_b: reasonable
    )
    .await;

    // Test Case 2: Minimum B too high
    expect_minimum_amount_failure(
        &mut env,
        user2,
        medium_amount() / U256::from(2), // desired_a
        medium_amount() * U256::from(2), // desired_b (will result in using A amount * 2)
        medium_amount() / U256::from(4), // min_a: reasonable
        medium_amount() * U256::from(12) / U256::from(10), // min_b: require 120% but will only get 100%
    )
    .await;

    println!("✅ Insufficient minimum amounts tests passed");
}

#[tokio::test]
async fn test_add_liquidity_zero_amounts() {
    let treasury_id = ActorId::zero();
    let mut env = TestEnv::new(treasury_id).await;
    let user = ACTOR_ID.into();

    env.setup_user(ACTOR_ID, medium_amount()).await;

    let result = env
        .pair_client
        .add_liquidity(
            U256::zero(),
            U256::zero(),
            U256::zero(),
            U256::zero(),
            env.get_deadline(),
        )
        .with_args(|args| args.with_actor_id(user))
        .send_recv(env.pair_id)
        .await;

    assert!(result.is_err(), "Should fail with zero amounts");
    println!("✅ Zero amounts test passed");
}

#[tokio::test]
async fn test_add_liquidity_insufficient_balance() {
    let treasury_id = ActorId::zero();
    let mut env = TestEnv::new(treasury_id).await;
    let user = ACTOR_ID.into();

    // Setup user with limited balance
    let small_balance = small_amount();
    env.setup_user(ACTOR_ID, small_balance).await;

    // Try to add more than balance
    let large_amount = small_balance * U256::from(10);

    let result = env
        .pair_client
        .add_liquidity(
            large_amount,
            large_amount,
            large_amount / U256::from(2),
            large_amount / U256::from(2),
            env.get_deadline(),
        )
        .with_args(|args| args.with_actor_id(user))
        .send_recv(env.pair_id)
        .await;

    assert!(
        result.is_err(),
        "Should fail due to insufficient balance in amount_a"
    );

    // check msg tracker is empty
    let msgs_in_msg_tracker = env
        .pair_client
        .msgs_in_msg_tracker()
        .recv(env.pair_id)
        .await
        .unwrap();
    assert_eq!(msgs_in_msg_tracker.len(), 1);

    let lock = env.pair_client.lock().recv(env.pair_id).await.unwrap();
    assert!(!lock);

    let result = env
        .pair_client
        .add_liquidity(
            small_balance,
            large_amount,
            small_balance / U256::from(2),
            large_amount / U256::from(2),
            env.get_deadline(),
        )
        .with_args(|args| args.with_actor_id(user))
        .send_recv(env.pair_id)
        .await;

    assert!(
        result.is_err(),
        "Should fail due to insufficient balance in amount_b"
    );

    // check msg tracker is empty
    let msgs_in_msg_tracker = env
        .pair_client
        .msgs_in_msg_tracker()
        .recv(env.pair_id)
        .await
        .unwrap();
    assert_eq!(msgs_in_msg_tracker.len(), 2);

    let lock = env.pair_client.lock().recv(env.pair_id).await.unwrap();
    assert!(!lock);

    println!("✅ Insufficient balance test passed");
}
