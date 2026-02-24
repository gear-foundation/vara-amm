use crate::*;

#[tokio::test]
async fn test_exact_output_swap_a_to_b_with_treasury_basic() {
    // Non-zero treasury id to enable treasury logic
    let treasury_id = ActorId::from([1u8; 32]);
    let mut env = TestEnv::new(treasury_id).await;
    env.remoting
        .system()
        .mint_to(treasury_id, 100_000_000_000_000);
    let lp_user = ACTOR_ID.into();
    let trader = ActorId::from(TRADER_1);

    // Setup symmetric liquidity pool
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

    println!("EXACT OUTPUT SWAP A->B WITH TREASURY");
    println!("Initial reserves: A={}, B={}", reserve_a, reserve_b);

    // Trader wants to receive 5% of token B reserves
    let amount_out = calculate_swap_amount_from_percent(reserve_b, 5);

    // View quote: MUST match actual swap result (same math helper inside)
    let quoted_in = env
        .pair_client
        .get_amount_in(amount_out, true) // A -> B
        .recv(env.pair_id)
        .await
        .unwrap();

    let amount_in_max = quoted_in;

    let (before_a, before_b, _) = env.get_balances(trader).await;

    let (_, before_treasury0, before_treasury1) = env
        .pair_client
        .get_treasury_info()
        .recv(env.pair_id)
        .await
        .unwrap();

    env.pair_client
        .swap_tokens_for_exact_tokens(
            amount_out,
            amount_in_max,
            true, // A -> B
            env.get_deadline(),
        )
        .with_args(|args| args.with_actor_id(trader))
        .send_recv(env.pair_id)
        .await
        .unwrap();

    let (after_a, after_b, _) = env.get_balances(trader).await;

    let used_a = before_a - after_a;
    let received_b = after_b - before_b;

    // ─────────────────────────────────────────────
    // 1. Check that user-facing numbers match quote
    // ─────────────────────────────────────────────

    // User pays quoted_in
    assert_eq!(used_a, quoted_in, "User must pay quoted_in (total input)");

    // Output must receive exactly amount_out
    assert_eq!(
        received_b, amount_out,
        "User must receive exactly requested amount_out"
    );

    // ─────────────────────────────────────────────
    // 2. Check reserves & k-invariant
    // ─────────────────────────────────────────────
    let amount_in_for_pool = SwapCalculator::calculate_amount_in(amount_out, reserve_a, reserve_b);

    // Only this part goes into the pool
    let expected_treasury_fee = quoted_in - amount_in_for_pool;

    let (new_reserve_a, new_reserve_b) = env.get_reserves().await;

    assert_eq!(
        new_reserve_a,
        reserve_a + amount_in_for_pool,
        "Reserve A should increase only by pool input"
    );
    assert_eq!(
        new_reserve_b,
        reserve_b - amount_out,
        "Reserve B should decrease by output amount"
    );

    assert!(
        SwapCalculator::validate_k_invariant(
            reserve_a,
            reserve_b,
            new_reserve_a,
            new_reserve_b,
            amount_in_for_pool,
            true
        ),
        "K-invariant must hold when using pool input (without treasury part)"
    );

    // ─────────────────────────────────────────────
    // 3. Check treasury accounting
    // ─────────────────────────────────────────────

    let (_, after_treasury0, after_treasury1) = env
        .pair_client
        .get_treasury_info()
        .recv(env.pair_id)
        .await
        .unwrap();

    assert_eq!(
        after_treasury0,
        before_treasury0 + expected_treasury_fee,
        "Treasury fee0 must increase by expected_treasury_fee"
    );
    assert_eq!(
        after_treasury1, before_treasury1,
        "Treasury fee1 must remain unchanged for A->B swap"
    );

    println!(
        "Input: {} A -> Output: {} B (treasury_fee0 = {})",
        used_a, received_b, expected_treasury_fee
    );

    // ─────────────────────────────────────────────
    // 4. Collect treasury fee0 and check balances
    // ─────────────────────────────────────────────
    let (before_balance_a, before_balance_b, _) = env.get_balances(treasury_id).await;

    env.pair_client
        .send_treasury_fees()
        .with_args(|args| args.with_actor_id(treasury_id))
        .send_recv(env.pair_id)
        .await
        .unwrap();

    let (_, fee_a_after, fee_b_after) = env
        .pair_client
        .get_treasury_info()
        .recv(env.pair_id)
        .await
        .unwrap();

    let (after_balance_a, _, _) = env.get_balances(treasury_id).await;

    assert_eq!(
        fee_a_after,
        U256::zero(),
        "Treasury fee0 must reset to zero after collect"
    );

    assert_eq!(
        after_balance_a,
        before_balance_a + expected_treasury_fee,
        "Treasury token0 balance must increase by expected_treasury_fee"
    );
    assert_eq!(
        fee_b_after,
        U256::zero(),
        "Treasury token1 balance must be zero"
    );

    println!(
        "Treasury A balance: {} -> {} (delta = {})",
        before_balance_a,
        after_balance_a,
        after_balance_a - before_balance_a
    );
}

#[tokio::test]
async fn test_exact_output_swap_b_to_a_with_treasury_basic() {
    // Non-zero treasury id to enable treasury logic
    let treasury_id = ActorId::from([1u8; 32]);
    let mut env = TestEnv::new(treasury_id).await;
    env.remoting
        .system()
        .mint_to(treasury_id, 100_000_000_000_000);
    let lp_user = ACTOR_ID.into();
    let trader = ActorId::from(TRADER_1);

    // Setup symmetric liquidity pool
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

    println!("EXACT OUTPUT SWAP B->A WITH TREASURY");
    println!("Initial reserves: A={}, B={}", reserve_a, reserve_b);

    // Trader wants to receive 5% of token A reserves
    let amount_out = calculate_swap_amount_from_percent(reserve_b, 5);

    // View quote: MUST match actual swap result (same math helper inside)
    let quoted_in = env
        .pair_client
        .get_amount_in(amount_out, false) // B -> A
        .recv(env.pair_id)
        .await
        .unwrap();

    let amount_in_max = quoted_in;

    let (before_a, before_b, _) = env.get_balances(trader).await;

    let (_, before_treasury0, before_treasury1) = env
        .pair_client
        .get_treasury_info()
        .recv(env.pair_id)
        .await
        .unwrap();

    env.pair_client
        .swap_tokens_for_exact_tokens(
            amount_out,
            amount_in_max,
            false, // B -> A
            env.get_deadline(),
        )
        .with_args(|args| args.with_actor_id(trader))
        .send_recv(env.pair_id)
        .await
        .unwrap();

    let (after_a, after_b, _) = env.get_balances(trader).await;

    let used_b = before_b - after_b;
    let received_a = after_a - before_a;

    // ─────────────────────────────────────────────
    // 1. Check that user-facing numbers match quote
    // ─────────────────────────────────────────────

    // User pays quoted_in
    assert_eq!(used_b, quoted_in, "User must pay quoted_in (total input)");

    // Output must receive exactly amount_out
    assert_eq!(
        received_a, amount_out,
        "User must receive exactly requested amount_out"
    );

    // ─────────────────────────────────────────────
    // 2. Check reserves & k-invariant
    // ─────────────────────────────────────────────
    let amount_in_for_pool = SwapCalculator::calculate_amount_in(amount_out, reserve_b, reserve_a);

    // Only this part goes into the pool
    let expected_treasury_fee = quoted_in - amount_in_for_pool;

    let (new_reserve_a, new_reserve_b) = env.get_reserves().await;

    assert_eq!(
        new_reserve_a,
        reserve_a - amount_out,
        "Reserve A should increase only by pool input"
    );
    assert_eq!(
        new_reserve_b,
        reserve_b + amount_in_for_pool,
        "Reserve B should decrease by output amount"
    );

    assert!(
        SwapCalculator::validate_k_invariant(
            reserve_a,
            reserve_b,
            new_reserve_a,
            new_reserve_b,
            amount_in_for_pool,
            false
        ),
        "K-invariant must hold when using pool input (without treasury part)"
    );

    // ─────────────────────────────────────────────
    // 3. Check treasury accounting
    // ─────────────────────────────────────────────

    let (_, after_treasury0, after_treasury1) = env
        .pair_client
        .get_treasury_info()
        .recv(env.pair_id)
        .await
        .unwrap();

    assert_eq!(
        after_treasury0, before_treasury0,
        "Treasury fee0 must remain unchanged for B->A swap"
    );
    assert_eq!(
        after_treasury1,
        before_treasury1 + expected_treasury_fee,
        "Treasury fee1 must increase by expected_treasury_feep"
    );

    println!(
        "Input: {} A -> Output: {} B (treasury_fee0 = {})",
        used_b, received_a, expected_treasury_fee
    );

    // ─────────────────────────────────────────────
    // 4. Collect treasury fee0 and check balances
    // ─────────────────────────────────────────────
    let (before_balance_a, before_balance_b, _) = env.get_balances(treasury_id).await;

    env.pair_client
        .send_treasury_fees()
        .with_args(|args| args.with_actor_id(treasury_id))
        .send_recv(env.pair_id)
        .await
        .unwrap();

    let (_, fee_a_after, fee_b_after) = env
        .pair_client
        .get_treasury_info()
        .recv(env.pair_id)
        .await
        .unwrap();

    let (_, after_balance_b, _) = env.get_balances(treasury_id).await;

    assert_eq!(
        fee_b_after,
        U256::zero(),
        "Treasury fee1 must reset to zero after collect"
    );

    assert_eq!(
        after_balance_b,
        before_balance_b + expected_treasury_fee,
        "Treasury token0 balance must increase by expected_treasury_fee"
    );
    assert_eq!(
        fee_a_after,
        U256::zero(),
        "Treasury token0 balance must be zero"
    );

    println!(
        "Treasury A balance: {} -> {} (delta = {})",
        before_balance_b,
        after_balance_b,
        after_balance_b - before_balance_a
    );
}
