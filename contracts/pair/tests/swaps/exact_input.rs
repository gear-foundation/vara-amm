use crate::*;

pub fn calculate_price_token0_in_token1(
    reserve0: U256,
    reserve1: U256,
    decimals0: u32,
    decimals1: u32,
) -> f64 {
    if reserve1.is_zero() {
        return 0.0;
    }
    
    let normalized_reserve0 = if decimals0 < 18 {
        reserve0 * U256::from(10u128).pow(U256::from(18 - decimals0))
    } else {
        reserve0 / U256::from(10u128).pow(U256::from(decimals0 - 18))
    };
    
    let normalized_reserve1 = if decimals1 < 18 {
        reserve1 * U256::from(10u128).pow(U256::from(18 - decimals1))
    } else {
        reserve1 / U256::from(10u128).pow(U256::from(decimals1 - 18))
    };
    
    let price_scaled = normalized_reserve1 * U256::from(10u128).pow(U256::from(18)) / normalized_reserve0;
    
    price_scaled.as_u128() as f64 / 1e18
}

#[tokio::test]
async fn test_exact_input_swap_low_price_impact() {
    let mut env = TestEnv::new().await;
    let lp_user = ACTOR_ID.into();
    let trader = ActorId::from(TRADER_1);

    // Setup balanced liquidity pool
    let decimals0 = 18;
    let decimals1 = 6;

    // 10 ETH
    let liquidity_amount_0 = U256::from(10u128) * U256::from(10u128).pow(U256::from(decimals0));

    // 44341 USDC
    let liquidity_amount_1 = U256::from(44341u128) * U256::from(10u128).pow(U256::from(decimals1));


    println!("{:?}", liquidity_amount_0);
    println!("{:?}", liquidity_amount_1);
    env.setup_user(TRADER_1, liquidity_amount_0*2).await;
    env.setup_user(ACTOR_ID, liquidity_amount_0*2).await;

    env.pair_client
        .add_liquidity(
            liquidity_amount_0,
            liquidity_amount_1,
            liquidity_amount_0 / U256::from(2),
            liquidity_amount_1 / U256::from(2),
            env.get_deadline(),
        )
        .with_args(|args| args.with_actor_id(lp_user))
        .send_recv(env.pair_id)
        .await
        .unwrap();

    let (reserve_a, reserve_b) = env.get_reserves().await;

    println!("=== EXACT INPUT SWAP A->B BASIC TEST ===");
    let initial_price = calculate_price_token0_in_token1(reserve_a, reserve_b, decimals0, decimals1);
    println!("Initial reserves: A={}, B={}, price={}", reserve_a, reserve_b, initial_price);

    // Perform 1% swap A -> B
    let amount_in = calculate_swap_amount_from_percent(reserve_a, 1);
    println!("amount_in={}", amount_in);

    let min_amount_out = SwapCalculator::calculate_exact_output(amount_in, reserve_a, reserve_b) - 1000;

    env.pair_client
        .swap_exact_tokens_for_tokens(
            amount_in,
            min_amount_out,
            true, // A to B
            env.get_deadline(),
        )
        .with_args(|args| args.with_actor_id(trader))
        .send_recv(env.pair_id)
        .await
        .unwrap();

    // Calculate expected output
    let expected_out = SwapCalculator::calculate_exact_output(amount_in, reserve_a, reserve_b);
    println!("amount_out={}", expected_out);
    // Verify k-invariant
    let (new_reserve_a, new_reserve_b) = env.get_reserves().await;
    let new_price = calculate_price_token0_in_token1(new_reserve_a, new_reserve_b, decimals0, decimals1);
    println!("New reserves: A={}, B={}, price={}", new_reserve_a, new_reserve_b, new_price);
    println!("Price impact {:?}", ((new_price - initial_price) / initial_price) * 100.0);
}

#[tokio::test]
async fn test_exact_input_swap_low_price_impact_1() {
    let mut env = TestEnv::new().await;
    let lp_user = ACTOR_ID.into();
    let trader = ActorId::from(TRADER_1);

    // Setup balanced liquidity pool
    let decimals0 = 6;
    let decimals1 = 6;

    // 10 ETH
    let liquidity_amount_0 = U256::from(100_000u128) * U256::from(10u128).pow(U256::from(decimals0));

    // 44341 USDC
    let liquidity_amount_1 = U256::from(100_000u128) * U256::from(10u128).pow(U256::from(decimals1));


    println!("{:?}", liquidity_amount_0);
    println!("{:?}", liquidity_amount_1);
    env.setup_user(TRADER_1, liquidity_amount_0).await;
    env.setup_user(ACTOR_ID, liquidity_amount_0).await;

    env.pair_client
        .add_liquidity(
            liquidity_amount_0,
            liquidity_amount_1,
            liquidity_amount_0 / U256::from(2),
            liquidity_amount_1 / U256::from(2),
            env.get_deadline(),
        )
        .with_args(|args| args.with_actor_id(lp_user))
        .send_recv(env.pair_id)
        .await
        .unwrap();

    let (reserve_a, reserve_b) = env.get_reserves().await;

    println!("=== EXACT INPUT SWAP A->B BASIC TEST ===");
    let initial_price = calculate_price_token0_in_token1(reserve_a, reserve_b, decimals0, decimals1);
    println!("Initial reserves: A={}, B={}, price={}", reserve_a, reserve_b, initial_price);

    // Perform 1% swap A -> B
    let amount_in = calculate_swap_amount_from_percent(reserve_a, 5);
    println!("amount_in={}", amount_in);

    let min_amount_out = SwapCalculator::calculate_exact_output(amount_in, reserve_a, reserve_b) - 1000;

    env.pair_client
        .swap_exact_tokens_for_tokens(
            amount_in,
            min_amount_out,
            true, // A to B
            env.get_deadline(),
        )
        .with_args(|args| args.with_actor_id(trader))
        .send_recv(env.pair_id)
        .await
        .unwrap();

    // Calculate expected output
    let expected_out = SwapCalculator::calculate_exact_output(amount_in, reserve_a, reserve_b);
    println!("amount_out={}", expected_out);
    // Verify k-invariant
    let (new_reserve_a, new_reserve_b) = env.get_reserves().await;
    let new_price = calculate_price_token0_in_token1(new_reserve_a, new_reserve_b, decimals0, decimals1);
    println!("New reserves: A={}, B={}, price={}", new_reserve_a, new_reserve_b, new_price);
    println!("Price impact {:?}", ((new_price - initial_price) / initial_price) * 100.0);
}


#[tokio::test]
async fn test_exact_input_swap_a_to_b_basic() {
    let mut env = TestEnv::new().await;
    let lp_user = ACTOR_ID.into();
    let trader = ActorId::from(TRADER_1);

    // Setup balanced liquidity pool
    let liquidity_amount = large_amount();
    let trader_funds = large_amount();

    env.setup_user(TRADER_1, trader_funds).await;
    env.setup_user(ACTOR_ID, liquidity_amount).await;

    env.pair_client
        .add_liquidity(
            liquidity_amount,
            liquidity_amount,
            liquidity_amount / U256::from(2),
            liquidity_amount / U256::from(2),
            env.get_deadline(),
        )
        .with_args(|args| args.with_actor_id(lp_user))
        .send_recv(env.pair_id)
        .await
        .unwrap();

    let (reserve_a, reserve_b) = env.get_reserves().await;

    println!("=== EXACT INPUT SWAP A->B BASIC TEST ===");
    println!("Initial reserves: A={}, B={}", reserve_a, reserve_b);

    // Perform 5% swap A -> B
    let amount_in = calculate_swap_amount_from_percent(reserve_a, 5);
    let min_amount_out = small_amount(); // Low minimum for basic test

    let (before_a, before_b, _) = env.get_balances(trader).await;

    env.pair_client
        .swap_exact_tokens_for_tokens(
            amount_in,
            min_amount_out,
            true, // A to B
            env.get_deadline(),
        )
        .with_args(|args| args.with_actor_id(trader))
        .send_recv(env.pair_id)
        .await
        .unwrap();

    let (after_a, after_b, _) = env.get_balances(trader).await;

    let used_a = before_a - after_a;
    let received_b = after_b - before_b;

    // Calculate expected output
    let expected_out = SwapCalculator::calculate_exact_output(amount_in, reserve_a, reserve_b);

    // Verify swap results
    assert_eq!(used_a, amount_in, "Should use exact input amount");
    assert!(received_b >= min_amount_out, "Should meet minimum output");
    assert_eq!(received_b, expected_out, "Output should match calculation");

    // Verify k-invariant
    let (new_reserve_a, new_reserve_b) = env.get_reserves().await;
    assert!(
        SwapCalculator::validate_k_invariant(
            reserve_a,
            reserve_b,
            new_reserve_a,
            new_reserve_b,
            amount_in,
            true
        ),
        "K-invariant should be preserved"
    );

    println!("Input: {} A -> Output: {} B", used_a, received_b);
    println!("✅ Exact input swap A->B basic test passed");
}

#[tokio::test]
async fn test_exact_input_swap_b_to_a_basic() {
    let mut env = TestEnv::new().await;
    let lp_user = ACTOR_ID.into();
    let trader = ActorId::from(TRADER_1);

    // Setup balanced liquidity pool
    let liquidity_amount = large_amount();
    let trader_funds = large_amount();

    env.setup_user(TRADER_1, trader_funds).await;
    env.setup_user(ACTOR_ID, liquidity_amount).await;

    env.pair_client
        .add_liquidity(
            liquidity_amount,
            liquidity_amount,
            liquidity_amount / U256::from(2),
            liquidity_amount / U256::from(2),
            env.get_deadline(),
        )
        .with_args(|args| args.with_actor_id(lp_user))
        .send_recv(env.pair_id)
        .await
        .unwrap();
    let (reserve_a, reserve_b) = env.get_reserves().await;

    println!("=== EXACT INPUT SWAP B->A BASIC TEST ===");
    println!("Initial reserves: A={}, B={}", reserve_a, reserve_b);

    // Perform 5% swap B -> A
    let amount_in = calculate_swap_amount_from_percent(reserve_b, 5);
    let min_amount_out = small_amount();

    let (before_a, before_b, _) = env.get_balances(trader).await;

    env.pair_client
        .swap_exact_tokens_for_tokens(
            amount_in,
            min_amount_out,
            false, // B to A
            env.get_deadline(),
        )
        .with_args(|args| args.with_actor_id(trader))
        .send_recv(env.pair_id)
        .await
        .unwrap();

    let (after_a, after_b, _) = env.get_balances(trader).await;

    let used_b = before_b - after_b;
    let received_a = after_a - before_a;

    // Calculate expected output
    let expected_out = SwapCalculator::calculate_exact_output(amount_in, reserve_b, reserve_a);

    // Verify swap results
    assert_eq!(used_b, amount_in, "Should use exact input amount");
    assert!(received_a >= min_amount_out, "Should meet minimum output");
    assert_eq!(received_a, expected_out, "Output should match calculation");

    // Verify k-invariant
    let (new_reserve_a, new_reserve_b) = env.get_reserves().await;
    assert!(
        SwapCalculator::validate_k_invariant(
            reserve_a,
            reserve_b,
            new_reserve_a,
            new_reserve_b,
            amount_in,
            false
        ),
        "K-invariant should be preserved"
    );

    println!("Input: {} B -> Output: {} A", used_b, received_a);
    println!("✅ Exact input swap B->A basic test passed");
}

#[tokio::test]
async fn test_exact_input_different_swap_sizes() {
    let mut env = TestEnv::new().await;
    let lp_user = ACTOR_ID.into();
    let trader = ActorId::from(TRADER_1);

    // Setup liquidity
    let liquidity_amount = huge_amount(); // Large liquidity for big swaps
    let trader_funds = huge_amount() * U256::from(10);

    env.setup_user(TRADER_1, trader_funds).await;
    env.setup_user(ACTOR_ID, liquidity_amount).await;

    env.pair_client
        .add_liquidity(
            liquidity_amount,
            liquidity_amount,
            liquidity_amount / U256::from(2),
            liquidity_amount / U256::from(2),
            env.get_deadline(),
        )
        .with_args(|args| args.with_actor_id(lp_user))
        .send_recv(env.pair_id)
        .await
        .unwrap();
    let (initial_reserve_a, initial_reserve_b) = env.get_reserves().await;

    println!("=== EXACT INPUT DIFFERENT SIZES TEST ===");
    println!(
        "Liquidity: A={}, B={}",
        initial_reserve_a, initial_reserve_b
    );

    for &size_percent in SWAP_TEST_SIZES_PERCENT.iter() {
        // Skip very large swaps that might fail due to insufficient liquidity
        if size_percent > 50 {
            continue;
        }

        println!("\n--- Testing {}% swap ---", size_percent);

        let (reserve_a, reserve_b) = env.get_reserves().await;
        let amount_in = calculate_swap_amount_from_percent(reserve_a, size_percent);
        let expected_out = SwapCalculator::calculate_exact_output(amount_in, reserve_a, reserve_b);
        let min_out = expected_out * U256::from(90) / U256::from(100); // 10% slippage tolerance

        let (before_a, before_b, _) = env.get_balances(trader).await;

        let result = env
            .pair_client
            .swap_exact_tokens_for_tokens(
                amount_in,
                min_out,
                true, // A to B
                env.get_deadline(),
            )
            .with_args(|args| args.with_actor_id(trader))
            .send_recv(env.pair_id)
            .await;

        assert!(result.is_ok(), "{}% swap should succeed", size_percent);

        let (after_a, after_b, _) = env.get_balances(trader).await;
        let used_a = before_a - after_a;
        let received_b = after_b - before_b;

        // Verify exact input was used
        assert_eq!(
            used_a, amount_in,
            "Should use exact input for {}% swap",
            size_percent
        );
        assert_eq!(
            received_b, expected_out,
            "Output should match calculation for {}% swap",
            size_percent
        );
    }

    println!("✅ Different swap sizes test passed");
}

#[tokio::test]
async fn test_exact_input_swap_exceeds_slippage_tolerance() {
    let mut env = TestEnv::new().await;
    let user = ACTOR_ID.into();

    // Create small liquidity pool for higher slippage demonstration
    let liquidity_a = U256::from(1000) * U256::exp10(18); // 1K tokens
    let liquidity_b = U256::from(1000) * U256::exp10(18); // 1K tokens

    env.setup_user(
        ACTOR_ID,
        liquidity_a + liquidity_b + U256::from(10000) * U256::exp10(18),
    )
    .await;

    // Add small liquidity to create higher price impact
    env.pair_client
        .add_liquidity(
            liquidity_a,
            liquidity_b,
            liquidity_a / U256::from(2),
            liquidity_b / U256::from(2),
            env.get_deadline(),
        )
        .with_args(|args| args.with_actor_id(user))
        .send_recv(env.pair_id)
        .await
        .unwrap();

    let (reserve_a, reserve_b) = env
        .pair_client
        .get_reserves()
        .recv(env.pair_id)
        .await
        .unwrap();

    // User wants to make LARGE swap (50% of liquidity)
    // This will create significant slippage
    let amount_in = U256::from(500) * U256::exp10(18); // 50% of reserve

    let expected_out = amount_in;

    // User is prepared for 5% slippage from naive calculation
    let user_slippage_tolerance_bp = 500; // 5.00%
    let min_amount_out =
        SwapCalculator::calculate_min_out_with_slippage(expected_out, user_slippage_tolerance_bp);

    // Transaction should fail due to slippage exceeding tolerance
    let result = env
        .pair_client
        .swap_exact_tokens_for_tokens(
            amount_in,
            min_amount_out, // User's expectations too high
            true,           // A -> B
            env.get_deadline(),
        )
        .with_args(|args| args.with_actor_id(user))
        .send_recv(env.pair_id)
        .await;

    assert!(
        result.is_err(),
        "Transaction should fail due to excessive slippage"
    );

    println!("✅ Transaction correctly failed due to slippage exceeding user tolerance");
}

#[tokio::test]
async fn test_exact_input_swap_not_enoght_funds() {
    let mut env = TestEnv::new().await;
    let lp_user = ACTOR_ID.into();
    let trader = ActorId::from(TRADER_1);

    // Setup balanced liquidity pool
    let liquidity_amount = large_amount();
    let trader_funds = small_amount();

    env.setup_user(TRADER_1, trader_funds).await;
    env.setup_user(ACTOR_ID, liquidity_amount).await;

    env.pair_client
        .add_liquidity(
            liquidity_amount,
            liquidity_amount,
            liquidity_amount / U256::from(2),
            liquidity_amount / U256::from(2),
            env.get_deadline(),
        )
        .with_args(|args| args.with_actor_id(lp_user))
        .send_recv(env.pair_id)
        .await
        .unwrap();

    let (reserve_a, _) = env.get_reserves().await;
    let amount_in = calculate_swap_amount_from_percent(reserve_a, 5);
    let min_amount_out = small_amount(); // Low minimum for basic test

    let (before_a, before_b, _) = env.get_balances(trader).await;

    let result = env
        .pair_client
        .swap_exact_tokens_for_tokens(
            amount_in,
            min_amount_out,
            true, // A to B
            env.get_deadline(),
        )
        .with_args(|args| args.with_actor_id(trader))
        .send_recv(env.pair_id)
        .await;

    assert!(result.is_err(), "Should fail due to insufficient balance");

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
}
