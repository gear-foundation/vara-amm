use crate::*;

#[tokio::test]
async fn test_remove_liquidity_basic() {
    let treasury_id = ActorId::zero();
    let mut env = TestEnv::new(treasury_id).await;
    let user = ACTOR_ID.into();

    // Add initial liquidity
    let amount_a = medium_amount();
    let amount_b = medium_amount() * U256::from(2);

    env.setup_user(ACTOR_ID, amount_a + amount_b).await;

    let (_before_a, _before_b, before_lp) = env.get_balances(user).await;

    setup_initial_liquidity(&mut env, user, amount_a, amount_b).await;

    let (after_add_a, after_add_b, after_add_lp) = env.get_balances(user).await;
    let lp_tokens_received = after_add_lp - before_lp;

    // Get current reserves and total supply
    let (reserve_a, reserve_b) = env.get_reserves().await;
    let total_supply = env.get_total_supply().await;

    // Remove half of the liquidity
    let lp_to_remove = lp_tokens_received / U256::from(2);

    env.pair
        .remove_liquidity(
            lp_to_remove,
            U256::zero(), // Accept any amount
            U256::zero(),
            env.get_deadline(),
        )
        .with_params(|args| args.with_actor_id(user))
        .await
        .unwrap();

    let (final_a, final_b, final_lp) = env.get_balances(user).await;

    let returned_a = final_a - after_add_a;
    let returned_b = final_b - after_add_b;
    let lp_burned = after_add_lp - final_lp;

    // Calculate expected returns based on current reserves and LP token share
    // Formula: amount = (lp_tokens * reserve) / total_supply
    let expected_a = (lp_to_remove * reserve_a) / total_supply;
    let expected_b = (lp_to_remove * reserve_b) / total_supply;

    assert_eq!(lp_burned, lp_to_remove, "Should burn exact LP tokens");

    assert_eq!(
        expected_a, returned_a,
        "Token A return should match expected",
    );
    assert_eq!(
        expected_b, returned_b,
        "Token B return should match expected",
    );

    println!("✅ Basic remove liquidity test passed");
}

#[tokio::test]
async fn test_remove_liquidity_with_minimum_liquidity_impact() {
    let treasury_id = ActorId::zero();
    let mut env = TestEnv::new(treasury_id).await;
    let user = ACTOR_ID.into();

    // Add initial liquidity
    let amount_a = medium_amount();
    let amount_b = medium_amount() * 2;

    env.setup_user(ACTOR_ID, amount_a + amount_b).await;

    setup_initial_liquidity(&mut env, user, amount_a, amount_b).await;

    // Get LP token balance and total supply
    let lp_balance = env.get_balances(user).await.2;
    let total_supply_before = env.get_total_supply().await;
    // Get current reserves
    let (reserve_a, reserve_b) = env.get_reserves().await;

    println!("User LP balance: {}", lp_balance);
    println!("Total supply before: {}", total_supply_before);
    println!("Minimum liquidity: {}", U256::from(MINIMUM_LIQUIDITY));

    // Try to remove ALL user's liquidity (this should work, but MINIMUM_LIQUIDITY stays locked)
    let (before_a, before_b, _) = env.get_balances(user).await;

    env.pair
        .remove_liquidity(
            lp_balance, // Remove all user's LP tokens
            U256::zero(),
            U256::zero(),
            env.get_deadline(),
        )
        .with_params(|args| args.with_actor_id(user))
        .await
        .unwrap();

    let (after_a, after_b, after_lp) = env.get_balances(user).await;
    let total_supply_after = env.get_total_supply().await;

    // Verify minimum liquidity remains locked
    assert_eq!(
        total_supply_after,
        U256::from(MINIMUM_LIQUIDITY),
        "Minimum liquidity should remain locked"
    );
    assert_eq!(after_lp, U256::zero(), "User should have no LP tokens left");

    // Calculate how much the user actually got vs what they would get without minimum liquidity
    let returned_a = after_a - before_a;
    let returned_b = after_b - before_b;

    let expected_a = (lp_balance * reserve_a) / total_supply_before;
    let expected_b = (lp_balance * reserve_b) / total_supply_before;

    assert_eq!(
        expected_a, returned_a,
        "Token A return should match expected",
    );
    assert_eq!(
        expected_b, returned_b,
        "Token B return should match expected",
    );

    // The user gets slightly less because MINIMUM_LIQUIDITY is locked forever
    let expected_a_without_min = amount_a;
    let expected_b_without_min = amount_b;

    println!(
        "Returned A: {} (vs {} without min liquidity)",
        returned_a, expected_a_without_min
    );
    println!(
        "Returned B: {} (vs {} without min liquidity)",
        returned_b, expected_b_without_min
    );

    // User should get slightly less due to minimum liquidity lock
    assert!(
        returned_a < expected_a_without_min,
        "Should get less A due to minimum liquidity"
    );
    assert!(
        returned_b < expected_b_without_min,
        "Should get less B due to minimum liquidity"
    );

    println!("✅ Minimum liquidity impact test passed");
}

#[tokio::test]
async fn test_remove_liquidity_after_price_change() {
    let treasury_id = ActorId::zero();
    let mut env = TestEnv::new(treasury_id).await;
    let lp_user = ACTOR_ID.into();
    let trader = ActorId::from(43);

    // Setup users
    let initial_a = medium_amount();
    let initial_b = medium_amount();

    env.setup_user(ACTOR_ID, initial_a + initial_b).await;
    env.setup_user(43, initial_a * U256::from(10)).await;

    // LP adds liquidity at 1:1 ratio
    setup_initial_liquidity(&mut env, lp_user, initial_a, initial_b).await;

    // Trader swaps to change price (A becomes more expensive)
    let swap_amount = U256::from(100) * U256::exp10(18);
    let max_input = U256::from(200) * U256::exp10(18);

    // Get current reserves (before swap)
    let (reserve_a, reserve_b) = env.get_reserves().await;

    let k_last = reserve_a * reserve_b;

    env.pair
        .swap_tokens_for_exact_tokens(
            swap_amount,
            max_input,
            false, // B -> A (makes A more expensive)
            env.get_deadline(),
        )
        .with_params(|args| args.with_actor_id(trader))
        .await
        .unwrap();

    // LP removes all liquidity
    let (before_a, before_b, lp_balance) = env.get_balances(lp_user).await;

    // Get current reserves
    let (reserve_a, reserve_b) = env.get_reserves().await;

    let total_supply = env.get_total_supply().await;

    env.pair
        .remove_liquidity(lp_balance, U256::zero(), U256::zero(), env.get_deadline())
        .with_params(|args| args.with_actor_id(lp_user))
        .await
        .unwrap();

    let (after_a, after_b, _) = env.get_balances(lp_user).await;
    let received_a = after_a - before_a;
    let received_b = after_b - before_b;

    let (expected_a, expected_b) = SwapCalculator::calculate_remove_amounts_with_protocol_fee(
        lp_balance,
        reserve_a,
        reserve_b,
        k_last,
        total_supply,
    );

    assert_eq!(
        expected_a, received_a,
        "Token A return should match expected",
    );
    assert_eq!(
        expected_b, received_b,
        "Token B return should match expected",
    );

    // Due to price change, LP should receive different amounts than originally deposited
    // but the total value should be higher due to trading fees
    assert!(
        received_a < initial_a,
        "Should receive less A (impermanent loss)"
    );
    assert!(
        received_b > initial_b,
        "Should receive more B (price appreciation)"
    );

    println!("✅ Remove liquidity after price change test passed");
}

#[tokio::test]
async fn test_remove_liquidity_insufficient_minimum() {
    let treasury_id = ActorId::zero();
    let mut env = TestEnv::new(treasury_id).await;
    let user = ACTOR_ID.into();

    // Add liquidity
    let amount_a = medium_amount();
    let amount_b = medium_amount();

    env.setup_user(ACTOR_ID, amount_a + amount_b).await;

    setup_initial_liquidity(&mut env, user, amount_a, amount_b).await;

    let lp_balance = env.get_balances(user).await.2;

    // Try to remove with unrealistic minimum requirements
    let result = env
        .pair
        .remove_liquidity(
            lp_balance / U256::from(2),
            amount_a, // Impossible minimum
            amount_b,
            env.get_deadline(),
        )
        .with_params(|args| args.with_actor_id(user))
        .await;

    assert!(
        result.is_err(),
        "Should fail with insufficient minimum amounts"
    );
    println!("✅ Remove liquidity insufficient minimum test passed");
}

#[tokio::test]
async fn test_remove_liquidity_expired_deadline() {
    let treasury_id = ActorId::zero();
    let mut env = TestEnv::new(treasury_id).await;
    let user = ACTOR_ID.into();

    // Add liquidity first
    let amount = medium_amount();
    env.setup_user(ACTOR_ID, amount * U256::from(2)).await;

    setup_initial_liquidity(&mut env, user, amount, amount).await;

    let lp_balance = env.get_balances(user).await.2;

    // Try to remove with expired deadline
    let expired_deadline = env.env.system().block_timestamp() - 1;

    let result = env
        .pair
        .remove_liquidity(
            lp_balance / U256::from(2),
            U256::zero(),
            U256::zero(),
            expired_deadline,
        )
        .with_params(|args| args.with_actor_id(user))
        .await;

    assert!(result.is_err(), "Should fail with expired deadline");
    println!("✅ Remove liquidity expired deadline test passed");
}
