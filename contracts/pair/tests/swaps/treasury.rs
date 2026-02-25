use crate::*;

#[tokio::test]
async fn test_failed_swap_does_not_change_treasury() {
    let treasury_id = ActorId::from([1u8; 32]);
    let mut env = TestEnv::new(treasury_id).await;

    env.env.system().mint_to(treasury_id, 100_000_000_000_000);

    let lp_user = ACTOR_ID.into();
    let trader = ActorId::from(TRADER_1);

    let liquidity_amount = large_amount();
    let trader_funds = small_amount();

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

    let (treasury_addr_before, fee0_before, fee1_before) =
        env.pair.get_treasury_info().await.unwrap();

    assert_eq!(treasury_addr_before, treasury_id);
    assert_eq!(fee0_before, U256::zero());
    assert_eq!(fee1_before, U256::zero());

    let (reserve_a, _) = env.get_reserves().await;
    // Swap more tokens then user has
    let amount_in = calculate_swap_amount_from_percent(reserve_a, 50); // 50% пула

    let min_amount_out = U256::zero();

    let result = env
        .pair
        .swap_exact_tokens_for_tokens(
            amount_in,
            min_amount_out,
            true, // A -> B
            env.get_deadline(),
        )
        .with_params(|args| args.with_actor_id(trader))
        .await;

    assert!(
        result.is_err(),
        "Swap with insufficient funds must fail, not succeed"
    );

    let (_, fee0_after, fee1_after) = env.pair.get_treasury_info().await.unwrap();

    assert_eq!(
        fee0_after, fee0_before,
        "Treasury fee0 must not change after failed swap"
    );
    assert_eq!(
        fee1_after, fee1_before,
        "Treasury fee1 must not change after failed swap"
    );

    let result = env
        .pair
        .send_treasury_fees()
        .with_params(|args| args.with_actor_id(treasury_id))
        .await;
    assert!(
        result.is_err(),
        "Send treasury fees must fail if there are no accrued fees"
    );
}

#[tokio::test]
async fn test_treasury_accumulates_over_multiple_swaps_and_single_collect() {
    let treasury_id = ActorId::from([1u8; 32]);
    let mut env = TestEnv::new(treasury_id).await;
    env.env.system().mint_to(treasury_id, 100_000_000_000_000);

    let lp_user = ACTOR_ID.into();
    let trader = ActorId::from(TRADER_1);

    let liquidity_amount = huge_amount();
    let trader_funds = huge_amount() * U256::from(10);

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

    let denom_bps = U256::from(FEE_DENOM_BPS);
    let treasury_bps = U256::from(TREASURY_FEE_BPS);

    let mut expected_fee0 = U256::zero();
    let mut expected_fee1 = U256::zero();

    // ───────────────────── Swap 1: exact input A->B ─────────────────────
    let (reserve_a1, _) = env.get_reserves().await;
    let amount_in1 = calculate_swap_amount_from_percent(reserve_a1, 5);

    let quoted_out1 = env.pair.get_amount_out(amount_in1, true).await.unwrap();

    env.pair
        .swap_exact_tokens_for_tokens(amount_in1, quoted_out1, true, env.get_deadline())
        .with_params(|args| args.with_actor_id(trader))
        .await
        .unwrap();

    let fee1_0 = amount_in1
        .checked_mul(treasury_bps)
        .and_then(|v| v.checked_div(denom_bps))
        .expect("fee math");
    expected_fee0 = expected_fee0.checked_add(fee1_0).expect("accumulate fee0");

    // ───────────────────── Swap 2: exact input B->A ─────────────────────
    let (_, reserve_b2) = env.get_reserves().await;
    let amount_in2 = calculate_swap_amount_from_percent(reserve_b2, 3);

    let quoted_out2 = env.pair.get_amount_out(amount_in2, false).await.unwrap();

    env.pair
        .swap_exact_tokens_for_tokens(amount_in2, quoted_out2, false, env.get_deadline())
        .with_params(|args| args.with_actor_id(trader))
        .await
        .unwrap();

    let fee2_1 = amount_in2
        .checked_mul(treasury_bps)
        .and_then(|v| v.checked_div(denom_bps))
        .expect("fee math");
    expected_fee1 = expected_fee1.checked_add(fee2_1).expect("accumulate fee1");

    // ───────────────────── Swap 3: exact output A->B ─────────────────────
    let (reserve_a3, reserve_b3) = env.get_reserves().await;
    let amount_out3 = calculate_swap_amount_from_percent(reserve_b3, 2);

    let quoted_in3 = env.pair.get_amount_in(amount_out3, true).await.unwrap();

    env.pair
        .swap_tokens_for_exact_tokens(amount_out3, quoted_in3, true, env.get_deadline())
        .with_params(|args| args.with_actor_id(trader))
        .await
        .unwrap();

    // For exact output: treasury = quoted_in - amount_in_for_pool
    let amount_in_for_pool3 =
        SwapCalculator::calculate_amount_in(amount_out3, reserve_a3, reserve_b3);
    let fee3_0 = quoted_in3
        .checked_sub(amount_in_for_pool3)
        .expect("quoted_in >= pool_in");
    expected_fee0 = expected_fee0.checked_add(fee3_0).expect("accumulate fee0");

    let (_, fee0_after_swaps, fee1_after_swaps) = env.pair.get_treasury_info().await.unwrap();

    assert_eq!(
        fee0_after_swaps, expected_fee0,
        "Treasury fee0 must equal sum of all A-direction fees"
    );
    assert_eq!(
        fee1_after_swaps, expected_fee1,
        "Treasury fee1 must equal sum of all B-direction fees"
    );
    println!("fee0_after_swaps {:?}", fee0_after_swaps);
    println!("fee1_after_swaps {:?}", fee1_after_swaps);
    let (bal_a_before, bal_b_before, _) = env.get_balances(treasury_id).await;

    env.pair
        .send_treasury_fees()
        .with_params(|args| args.with_actor_id(treasury_id))
        .await
        .unwrap();

    let (_, fee0_final, fee1_final) = env.pair.get_treasury_info().await.unwrap();

    let (bal_a_after, bal_b_after, _) = env.get_balances(treasury_id).await;

    assert_eq!(
        fee0_final,
        U256::zero(),
        "fee0 must reset to 0 after collect"
    );
    assert_eq!(
        fee1_final,
        U256::zero(),
        "fee1 must reset to 0 after collect"
    );

    assert_eq!(
        bal_a_after,
        bal_a_before + expected_fee0,
        "Treasury A balance must grow by accumulated fee0"
    );
    assert_eq!(
        bal_b_after,
        bal_b_before + expected_fee1,
        "Treasury B balance must grow by accumulated fee1"
    );
}

#[tokio::test]
async fn test_treasury_fee_zero_for_tiny_amounts_due_to_floor() {
    let treasury_id = ActorId::from([1u8; 32]);
    let mut env = TestEnv::new(treasury_id).await;
    env.env.system().mint_to(treasury_id, 100_000_000_000_000);

    let lp_user = ACTOR_ID.into();
    let trader = ActorId::from(TRADER_1);

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

    let (treasury_addr_before, fee0_before, fee1_before) =
        env.pair.get_treasury_info().await.unwrap();
    assert_eq!(treasury_addr_before, treasury_id);
    assert_eq!(fee0_before, U256::zero());
    assert_eq!(fee1_before, U256::zero());

    let denom_bps = U256::from(FEE_DENOM_BPS);
    let treasury_bps = U256::from(TREASURY_FEE_BPS);

    let min_for_one_fee = denom_bps
        .checked_div(treasury_bps)
        .expect("treasury_bps > 0");
    let tiny_amount_in = min_for_one_fee
        .checked_sub(U256::from(1u64))
        .expect("min_for_one_fee > 1");

    let (reserve_a, reserve_b) = env.get_reserves().await;

    // tiny_amount_in << reserve_a
    assert!(tiny_amount_in < reserve_a);

    println!("tiny_amount_in {:?}", tiny_amount_in);
    println!("min_for_one_fee {:?}", min_for_one_fee);

    let quoted_out = env
        .pair
        .get_amount_out(tiny_amount_in, true) // A -> B
        .await
        .unwrap();

    let min_amount_out = quoted_out;

    let (before_a, before_b, _) = env.get_balances(trader).await;

    env.pair
        .swap_exact_tokens_for_tokens(
            tiny_amount_in,
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

    assert_eq!(used_a, tiny_amount_in);
    assert_eq!(received_b, quoted_out);

    let (new_reserve_a, new_reserve_b) = env.get_reserves().await;

    assert_eq!(
        new_reserve_a,
        reserve_a + tiny_amount_in,
        "Reserve A must increase by full tiny_amount_in when treasury fee floors to zero"
    );
    assert_eq!(
        new_reserve_b,
        reserve_b - quoted_out,
        "Reserve B must decrease by quoted_out"
    );

    assert!(
        SwapCalculator::validate_k_invariant(
            reserve_a,
            reserve_b,
            new_reserve_a,
            new_reserve_b,
            tiny_amount_in,
            true
        ),
        "K-invariant must hold using full tiny_amount_in as pool input"
    );

    let (_, fee0_after, fee1_after) = env.pair.get_treasury_info().await.unwrap();

    assert_eq!(
        fee0_after, fee0_before,
        "Treasury fee0 must not increase for tiny amount with fee floor = 0"
    );
    assert_eq!(
        fee1_after, fee1_before,
        "Treasury fee1 must not change for A->B swap"
    );
}
