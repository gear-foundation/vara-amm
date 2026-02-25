use crate::*;

#[tokio::test]
async fn test_exact_input_swap_a_to_b_with_treasury_basic() {
    // Non-zero treasury id to enable treasury logic
    let treasury_id = ActorId::from([1u8; 32]);
    let mut env = TestEnv::new(treasury_id).await;
    env.env.system().mint_to(treasury_id, 100_000_000_000_000);
    let lp_user = ACTOR_ID.into();
    let trader = ActorId::from(TRADER_1);

    // Setup symmetric liquidity pool
    let liquidity_amount = large_amount();
    let trader_funds = large_amount();

    env.setup_user(TRADER_1, trader_funds).await;
    env.setup_user(ACTOR_ID, liquidity_amount).await;

    env.pair
        .add_liquidity(
            liquidity_amount,
            liquidity_amount,
            liquidity_amount / U256::from(2),
            liquidity_amount / U256::from(2),
            env.get_deadline(),
        )
        .with_params(|args| args.with_actor_id(lp_user))
        .await
        .unwrap();

    let (reserve_a, reserve_b) = env.get_reserves().await;

    println!("EXACT INPUT SWAP A->B WITH TREASURY");
    println!("Initial reserves: A={}, B={}", reserve_a, reserve_b);

    // 5% swap A -> B
    let amount_in = calculate_swap_amount_from_percent(reserve_a, 5);

    // View quote: MUST match actual swap result (same math helper inside)
    let quoted_out = env
        .pair
        .get_amount_out(amount_in, true) // A -> B
        .await
        .unwrap();

    // User sets min_amount_out = quoted_out
    let min_amount_out = quoted_out;

    let (before_a, before_b, _) = env.get_balances(trader).await;

    let (_, before_treasury0, before_treasury1) = env.pair.get_treasury_info().await.unwrap();

    env.pair
        .swap_exact_tokens_for_tokens(
            amount_in,
            min_amount_out,
            true, // A -> B
            env.get_deadline(),
        )
        .with_params(|args| args.with_actor_id(trader))
        .await
        .unwrap();

    let (after_a, after_b, _) = env.get_balances(trader).await;

    let used_a = before_a - after_a;
    let received_b = after_b - before_b;

    // ─────────────────────────────────────────────
    // 1. Check that user-facing numbers match quote
    // ─────────────────────────────────────────────

    // User pays exactly amount_in
    assert_eq!(used_a, amount_in, "User should pay full amount_in");

    // Output must match view quote
    assert_eq!(
        received_b, quoted_out,
        "Actual output must match get_amount_out quote"
    );

    // ─────────────────────────────────────────────
    // 2. Check reserves & k-invariant
    // ─────────────────────────────────────────────

    let denom_bps = U256::from(FEE_DENOM_BPS);
    let treasury_bps = U256::from(TREASURY_FEE_BPS);

    // treasury_fee = amount_in * TREASURY_FEE_BPS / 10_000
    let expected_treasury_fee = amount_in
        .checked_mul(treasury_bps)
        .and_then(|v| v.checked_div(denom_bps))
        .expect("treasury fee math overflow");

    // Only this part goes into the pool
    let amount_in_for_pool = amount_in - expected_treasury_fee;

    let (new_reserve_a, new_reserve_b) = env.get_reserves().await;

    assert_eq!(
        new_reserve_a,
        reserve_a + amount_in_for_pool,
        "Reserve A should increase only by pool input"
    );
    assert_eq!(
        new_reserve_b,
        reserve_b - quoted_out,
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

    let (_, after_treasury0, after_treasury1) = env.pair.get_treasury_info().await.unwrap();

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
    let (before_balance_a, _before_balance_b, _) = env.get_balances(treasury_id).await;

    env.pair
        .send_treasury_fees()
        .with_params(|args| args.with_actor_id(treasury_id))
        .await
        .unwrap();

    let (_, fee_a_after, fee_b_after) = env.pair.get_treasury_info().await.unwrap();

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
async fn test_exact_input_swap_b_to_a_with_treasury_basic() {
    // Non-zero treasury id to enable treasury logic
    let treasury_id = ActorId::from([1u8; 32]);
    let mut env = TestEnv::new(treasury_id).await;
    env.env.system().mint_to(treasury_id, 100_000_000_000_000);
    let lp_user = ACTOR_ID.into();
    let trader = ActorId::from(TRADER_1);

    // Setup symmetric liquidity pool
    let liquidity_amount = large_amount();
    let trader_funds = large_amount();

    env.setup_user(TRADER_1, trader_funds).await;
    env.setup_user(ACTOR_ID, liquidity_amount).await;

    env.pair
        .add_liquidity(
            liquidity_amount,
            liquidity_amount,
            liquidity_amount / U256::from(2),
            liquidity_amount / U256::from(2),
            env.get_deadline(),
        )
        .with_params(|args| args.with_actor_id(lp_user))
        .await
        .unwrap();

    let (reserve_a, reserve_b) = env.get_reserves().await;

    println!("EXACT INPUT SWAP B->A WITH TREASURY");
    println!("Initial reserves: A={}, B={}", reserve_a, reserve_b);

    // 5% swap A -> B
    let amount_in = calculate_swap_amount_from_percent(reserve_a, 5);

    // View quote: MUST match actual swap result (same math helper inside)
    let quoted_out = env
        .pair
        .get_amount_out(amount_in, false) // B -> A
        .await
        .unwrap();

    // User sets min_amount_out = quoted_out
    let min_amount_out = quoted_out;

    let (before_a, before_b, _) = env.get_balances(trader).await;

    let (_, before_treasury0, before_treasury1) = env.pair.get_treasury_info().await.unwrap();

    env.pair
        .swap_exact_tokens_for_tokens(
            amount_in,
            min_amount_out,
            false, // B -> A
            env.get_deadline(),
        )
        .with_params(|args| args.with_actor_id(trader))
        .await
        .unwrap();

    let (after_a, after_b, _) = env.get_balances(trader).await;

    let used_b = before_b - after_b;
    let received_a = after_a - before_a;

    // ─────────────────────────────────────────────
    // 1. Check that user-facing numbers match quote
    // ─────────────────────────────────────────────

    // User pays exactly amount_in
    assert_eq!(used_b, amount_in, "User should pay full amount_in");

    // Output must match view quote
    assert_eq!(
        received_a, quoted_out,
        "Actual output must match get_amount_out quote"
    );

    // ─────────────────────────────────────────────
    // 2. Check reserves & k-invariant
    // ─────────────────────────────────────────────

    let denom_bps = U256::from(FEE_DENOM_BPS);
    let treasury_bps = U256::from(TREASURY_FEE_BPS);

    // treasury_fee = amount_in * TREASURY_FEE_BPS / 10_000
    let expected_treasury_fee = amount_in
        .checked_mul(treasury_bps)
        .and_then(|v| v.checked_div(denom_bps))
        .expect("treasury fee math overflow");

    // Only this part goes into the pool
    let amount_in_for_pool = amount_in - expected_treasury_fee;

    let (new_reserve_a, new_reserve_b) = env.get_reserves().await;

    assert_eq!(
        new_reserve_a,
        reserve_a - quoted_out,
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

    let (_, after_treasury0, after_treasury1) = env.pair.get_treasury_info().await.unwrap();

    assert_eq!(
        after_treasury0, before_treasury0,
        "Treasury fee0 must remain unchanged for B->A swap"
    );
    assert_eq!(
        after_treasury1,
        before_treasury1 + expected_treasury_fee,
        "Treasury fee1 must increase by expected_treasury_fee"
    );

    println!(
        "Input: {} B -> Output: {} A (treasury_fee1 = {})",
        used_b, received_a, expected_treasury_fee
    );

    // ─────────────────────────────────────────────
    // 4. Collect treasury fee0 and check balances
    // ─────────────────────────────────────────────
    let (_before_balance_a, before_balance_b, _) = env.get_balances(treasury_id).await;

    env.pair
        .send_treasury_fees()
        .with_params(|args| args.with_actor_id(treasury_id))
        .await
        .unwrap();

    let (_, fee_a_after, fee_b_after) = env.pair.get_treasury_info().await.unwrap();

    let (_, after_balance_b, _) = env.get_balances(treasury_id).await;

    assert_eq!(
        fee_b_after,
        U256::zero(),
        "Treasury fee1 must reset to zero after collect"
    );

    assert_eq!(
        after_balance_b,
        before_balance_b + expected_treasury_fee,
        "Treasury token1 balance must increase by expected_treasury_fee"
    );
    assert_eq!(
        fee_a_after,
        U256::zero(),
        "Treasury token0 balance must be zero"
    );

    println!(
        "Treasury B balance: {} -> {} (delta = {})",
        before_balance_b,
        after_balance_b,
        after_balance_b - before_balance_b
    );
}
