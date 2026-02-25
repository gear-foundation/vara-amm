use crate::*;

#[tokio::test]
async fn test_exact_output_swap_with_fee() {
    let treasury_id = ActorId::zero();
    let mut env = TestEnv::new(treasury_id).await;
    let user = ActorId::from(ACTOR_ID);

    // Setup liquidity with 1:1 ratio for simplicity
    let initial_a = U256::from(10000) * U256::exp10(18);
    let initial_b = U256::from(10000) * U256::exp10(18);

    env.setup_user(42, initial_a + initial_b).await;

    env.pair
        .add_liquidity(
            initial_a,
            initial_b,
            initial_a / U256::from(2),
            initial_b / U256::from(2),
            env.get_deadline(),
        )
        .with_params(|args| args.with_actor_id(user))
        .await
        .unwrap();

    // Get initial reserves
    let (reserve_a, reserve_b) = env.get_reserves().await;

    // Desired exact output (token B)
    let amount_out = U256::from(99) * U256::exp10(18);
    let amount_in_max = U256::from(200) * U256::exp10(18); // Large enough to not fail

    let (before_a, before_b, _) = env.get_balances(user).await; // Balances of A and B before swap

    // Perform swap (A -> B, exact output)
    env.pair
        .swap_tokens_for_exact_tokens(amount_out, amount_in_max, true, env.get_deadline())
        .with_params(|args| args.with_actor_id(user))
        .await
        .unwrap();

    let (after_a, after_b, _) = env.get_balances(user).await;

    let used_a = before_a - after_a; // Actual amount_in used
    let received_b = after_b - before_b; // Actual amount_out received

    // Calculate expected amount_in using get_amount_in formula
    let thousand = U256::from(1000u64);
    let fee_multiplier = U256::from(997u64);

    let numerator = reserve_a
        .checked_mul(amount_out)
        .unwrap()
        .checked_mul(thousand)
        .unwrap();
    let denominator_part1 = reserve_b.checked_sub(amount_out).unwrap();
    let denominator = denominator_part1.checked_mul(fee_multiplier).unwrap();

    let expected_amount_in = (numerator / denominator)
        .checked_add(U256::from(1u64))
        .unwrap();

    // Asserts for swap results
    assert_eq!(received_b, amount_out, "Should receive exact amount_out");
    assert_eq!(
        used_a, expected_amount_in,
        "Used input should match calculated with fee"
    );
    assert!(used_a <= amount_in_max, "Should not exceed max input");

    // Calculate exact fee paid (from input)
    let effective_in = used_a * fee_multiplier / thousand;
    let fee_paid = used_a - effective_in;
    // Assert fee is approximately 0.3%, allowing for integer rounding
    assert!(
        fee_paid >= used_a * U256::from(3) / thousand,
        "Fee at least 0.3%"
    );
    assert!(
        fee_paid <= used_a * U256::from(3) / thousand + U256::from(1),
        "Fee approx 0.3%, with rounding"
    );

    // Check reserve changes and k growth due to fee
    let (new_reserve_a, new_reserve_b) = env.get_reserves().await;
    let old_k = reserve_a * reserve_b;
    let new_k = new_reserve_a * new_reserve_b;
    assert_eq!(
        new_reserve_a,
        reserve_a + used_a,
        "Full input added to reserve A"
    );
    assert_eq!(
        new_reserve_b,
        reserve_b - amount_out,
        "Output subtracted from reserve B"
    );
    assert!(new_k > old_k, "k should increase due to fee");

    // Verify Uniswap V2 invariant: adjusted balances >= old k * 1000^2
    // Assuming input on token A (token0), output on B (token1)
    let adjusted_a = new_reserve_a * thousand - used_a * U256::from(3); // Subtract fee equivalent
    let adjusted_b = new_reserve_b * thousand; // No input on B
    let left = adjusted_a * adjusted_b;
    let right = old_k * thousand * thousand;
    assert!(
        left >= right,
        "Invariant should hold: adjusted_k >= old_k * 1000^2"
    );

    println!("✅ Swap exact output with fee and k invariant test passed");
}

// Property-based test with random values
#[tokio::test]
async fn test_exact_output_swap_property_based_swap_invariants() {
    let mut rng = StdRng::seed_from_u64(12345);
    let treasury_id = ActorId::zero();

    for iteration in 0..50 {
        println!("Property test iteration {}", iteration + 1);

        let mut env = TestEnv::new(treasury_id).await;
        let user = ActorId::from(100);

        // Generate random but reasonable liquidity amounts
        let base_liquidity = 1000 + rng.gen_range(0..50000);
        let liquidity_a = U256::from(base_liquidity) * U256::exp10(18);
        let liquidity_b = U256::from(base_liquidity + rng.gen_range(0..10000)) * U256::exp10(18);

        env.setup_user(
            100,
            liquidity_a + liquidity_b + U256::from(100000) * U256::exp10(18),
        )
        .await;

        // Add initial liquidity
        env.pair
            .add_liquidity(
                liquidity_a,
                liquidity_b,
                liquidity_a * U256::from(90) / U256::from(100),
                liquidity_b * U256::from(90) / U256::from(100),
                env.get_deadline(),
            )
            .with_params(|args| args.with_actor_id(user))
            .await
            .unwrap();

        let (reserve_a, reserve_b) = env.get_reserves().await;
        let initial_k = reserve_a * reserve_b;

        // Generate random swap amount (1-10% of reserves)
        let swap_percentage = 1 + rng.gen_range(0..10);
        let amount_out = if rng.gen_bool(0.5) {
            reserve_b * U256::from(swap_percentage) / U256::from(100)
        } else {
            reserve_a * U256::from(swap_percentage) / U256::from(100)
        };

        let a_to_b = rng.gen_bool(0.5);
        let (reserve_in, reserve_out) = if a_to_b {
            (reserve_a, reserve_b)
        } else {
            (reserve_b, reserve_a)
        };

        // Skip if amount_out is too large
        if amount_out >= reserve_out * U256::from(95) / U256::from(100) {
            continue;
        }

        let expected_amount_in =
            SwapCalculator::calculate_amount_in(amount_out, reserve_in, reserve_out);
        let amount_in_max = expected_amount_in * U256::from(120) / U256::from(100); // 20% slippage

        let (before_a, before_b, _) = env.get_balances(user).await;

        // Perform swap
        env.pair
            .swap_tokens_for_exact_tokens(amount_out, amount_in_max, a_to_b, env.get_deadline())
            .with_params(|args| args.with_actor_id(user))
            .await
            .unwrap();

        let (after_a, after_b, _) = env.get_balances(user).await;
        let (new_reserve_a, new_reserve_b) = env.get_reserves().await;

        let actual_amount_in = if a_to_b {
            before_a - after_a
        } else {
            before_b - after_b
        };

        let actual_amount_out = if a_to_b {
            after_b - before_b
        } else {
            after_a - before_a
        };

        // Property assertions
        assert_eq!(actual_amount_out, amount_out, "Exact output property");
        assert!(actual_amount_in <= amount_in_max, "Max input property");
        assert!(
            new_reserve_a * new_reserve_b > initial_k,
            "K growth property"
        );
        assert!(
            SwapCalculator::validate_k_invariant(
                reserve_a,
                reserve_b,
                new_reserve_a,
                new_reserve_b,
                actual_amount_in,
                a_to_b
            ),
            "K invariant property"
        );

        // Fee property
        let expected_fee = SwapCalculator::calculate_fee(actual_amount_in);
        let effective_in =
            actual_amount_in * U256::from(FEE_NUMERATOR) / U256::from(FEE_DENOMINATOR);
        let actual_fee = actual_amount_in - effective_in;
        assert!(
            actual_fee >= expected_fee - U256::from(1)
                && actual_fee <= expected_fee + U256::from(1),
            "Fee calculation property"
        );
    }

    println!("All property-based tests passed");
}

// Edge cases: very large amounts (near liquidity limits)
#[tokio::test]
async fn test_exact_output_swap_edge_case_very_large_amounts() {
    let treasury_id = ActorId::zero();
    let mut env = TestEnv::new(treasury_id).await;
    let user = ActorId::from(ACTOR_ID);

    // Setup with large liquidity
    let liquidity_a = U256::from(1000000) * U256::exp10(18);
    let liquidity_b = U256::from(1000000) * U256::exp10(18);

    env.setup_user(ACTOR_ID, liquidity_a * 3).await;

    env.pair
        .add_liquidity(
            liquidity_a,
            liquidity_b,
            liquidity_a / U256::from(2),
            liquidity_b / U256::from(2),
            env.get_deadline(),
        )
        .with_params(|args| args.with_actor_id(user))
        .await
        .unwrap();

    let (reserve_a, reserve_b) = env.pair.get_reserves().await.unwrap();

    // Test very large swap (50% of reserves - should still work)
    let amount_out = reserve_b / U256::from(2);
    let expected_amount_in = SwapCalculator::calculate_amount_in(amount_out, reserve_a, reserve_b);
    let amount_in_max = expected_amount_in * U256::from(110) / U256::from(100);

    let (before_a, before_b, _) = env.get_balances(user).await;

    env.pair
        .swap_tokens_for_exact_tokens(amount_out, amount_in_max, true, env.get_deadline())
        .with_params(|args| args.with_actor_id(user))
        .await
        .unwrap();

    let (after_a, after_b, _) = env.get_balances(user).await;
    let used_a = before_a - after_a;
    let received_b = after_b - before_b;

    assert_eq!(received_b, amount_out, "Should receive exact large output");
    assert!(
        used_a <= amount_in_max,
        "Should not exceed max input for large swap"
    );

    // Verify price impact is significant but reasonable
    let price_impact = (used_a * U256::from(100) / reserve_a).as_u64();
    assert!(
        price_impact > 50,
        "Large swap should have significant price impact"
    );
    assert!(price_impact < 200, "Price impact should not be excessive");

    println!(
        "✅ Very large amount edge case passed (price impact: {}%)",
        price_impact
    );
}

// Edge cases: very small amounts
#[tokio::test]
async fn test_exact_output_swap_edge_case_very_small_amounts() {
    let treasury_id = ActorId::zero();
    let mut env = TestEnv::new(treasury_id).await;
    let user = ActorId::from(ACTOR_ID);

    // Setup with normal liquidity
    let liquidity_a = U256::from(10000) * U256::exp10(18);
    let liquidity_b = U256::from(10000) * U256::exp10(18);

    env.setup_user(ACTOR_ID, liquidity_a + liquidity_b).await;

    env.pair
        .add_liquidity(
            liquidity_a,
            liquidity_b,
            liquidity_a / U256::from(2),
            liquidity_b / U256::from(2),
            env.get_deadline(),
        )
        .with_params(|args| args.with_actor_id(user))
        .await
        .unwrap();

    // Test very small swap
    let amount_out = U256::from(1);
    let amount_in_max = U256::from(10);

    let (reserve_a, reserve_b) = env.pair.get_reserves().await.unwrap();
    let (before_a, before_b, _) = env.get_balances(user).await;

    env.pair
        .swap_tokens_for_exact_tokens(amount_out, amount_in_max, true, env.get_deadline())
        .with_params(|args| args.with_actor_id(user))
        .await
        .unwrap();

    let (after_a, after_b, _) = env.get_balances(user).await;
    let used_a = before_a - after_a;
    let received_b = after_b - before_b;

    assert_eq!(
        received_b, amount_out,
        "Should receive exact 1 unit of token output"
    );
    assert!(
        used_a > U256::zero(),
        "Should use some input for 1 unit of token"
    );
    assert!(used_a <= amount_in_max, "Should not exceed max input");

    // Verify k still increases even for tiny swaps
    let (new_reserve_a, new_reserve_b) = env.pair.get_reserves().await.unwrap();
    assert!(
        new_reserve_a * new_reserve_b > reserve_a * reserve_b,
        "K should increase even for 1 wei"
    );

    println!("✅ Very small amount edge case passed");
}

// Edge cases: extreme price ratios
#[tokio::test]
async fn test_edge_case_extreme_price_ratios() {
    let treasury_id = ActorId::zero();
    let mut env = TestEnv::new(treasury_id).await;

    // Test 1: Very expensive token B (1:1000 ratio)
    let liquidity_a = U256::from(1000000) * U256::exp10(18);
    let liquidity_b = U256::from(1000) * U256::exp10(18);

    env.setup_user(
        ACTOR_ID,
        liquidity_a + liquidity_b + U256::from(100000) * U256::exp10(18),
    )
    .await;

    env.pair
        .add_liquidity(
            liquidity_a,
            liquidity_b,
            liquidity_a * U256::from(90) / U256::from(100),
            liquidity_b * U256::from(90) / U256::from(100),
            env.get_deadline(),
        )
        .with_params(|args| args.with_actor_id(ACTOR_ID.into()))
        .await
        .unwrap();

    let (reserve_a, reserve_b) = env.get_reserves().await;

    // Swap small amount of expensive token B
    let amount_out = U256::from(1) * U256::exp10(18); // 1 B token
    let expected_amount_in = SwapCalculator::calculate_amount_in(amount_out, reserve_a, reserve_b);
    let amount_in_max = expected_amount_in * U256::from(110) / U256::from(100);

    let (before_a, before_b, _) = env.get_balances(ACTOR_ID.into()).await;

    env.pair
        .swap_tokens_for_exact_tokens(amount_out, amount_in_max, true, env.get_deadline())
        .with_params(|args| args.with_actor_id(ACTOR_ID.into()))
        .await
        .unwrap();

    let (after_a, after_b, _) = env.get_balances(ACTOR_ID.into()).await;
    let used_a = before_a - after_a;
    let received_b = after_b - before_b;

    assert_eq!(received_b, amount_out, "Should receive exact B token");

    // Verify the exchange rate is approximately correct (accounting for fees)
    let exchange_rate = used_a / received_b;
    let expected_rate = reserve_a / reserve_b;
    let rate_diff = if exchange_rate > expected_rate {
        exchange_rate - expected_rate
    } else {
        expected_rate - exchange_rate
    };
    assert!(
        rate_diff < expected_rate / U256::from(10), // Within 10% due to fees and slippage
        "Exchange rate should be approximately correct for extreme ratios"
    );

    println!(
        "✅ Extreme price ratio test passed (rate: {} A per B)",
        exchange_rate
    );
}

// Test insufficient liquidity scenarios
#[tokio::test]
async fn test_exact_output_swap_edge_case_insufficient_liquidity() {
    let treasury_id = ActorId::zero();
    let mut env = TestEnv::new(treasury_id).await;
    let user = ActorId::from(42);

    // Setup minimal liquidity
    let liquidity_a = U256::from(100) * U256::exp10(18);
    let liquidity_b = U256::from(100) * U256::exp10(18);

    env.setup_user(42, liquidity_a + liquidity_b).await;

    env.pair
        .add_liquidity(
            liquidity_a,
            liquidity_b,
            liquidity_a / U256::from(2),
            liquidity_b / U256::from(2),
            env.get_deadline(),
        )
        .with_params(|args| args.with_actor_id(user))
        .await
        .unwrap();

    let (_reserve_a, reserve_b) = env.get_reserves().await;

    // Try to swap more than available (should fail)
    let amount_out = reserve_b + U256::from(1);
    let amount_in_max = U256::from(u64::MAX) * U256::exp10(18);

    let result = env
        .pair
        .swap_tokens_for_exact_tokens(amount_out, amount_in_max, true, env.get_deadline())
        .with_params(|args| args.with_actor_id(user))
        .await;

    assert!(
        result.is_err(),
        "Should fail when requesting more than available liquidity"
    );

    // Try to swap exactly the reserve amount (should also fail due to k invariant)
    let amount_out = reserve_b;
    let result = env
        .pair
        .swap_tokens_for_exact_tokens(amount_out, amount_in_max, true, env.get_deadline())
        .with_params(|args| args.with_actor_id(user))
        .await;

    assert!(
        result.is_err(),
        "Should fail when requesting entire reserve"
    );

    println!("✅ Insufficient liquidity edge cases passed");
}
