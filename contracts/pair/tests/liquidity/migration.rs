use crate::*;

#[tokio::test]
async fn test_migrate_all_liquidity_transfers_funds_and_disables_pool() {
    let treasury_id = ActorId::from([2u8; 32]);
    let mut env = TestEnv::new(treasury_id).await;

    let admin_id: ActorId = ACTOR_ID.into();
    let lp_user = admin_id;
    let trader = ActorId::from(TRADER_1);
    let migration_target = ActorId::from([9u8; 32]);

    let liquidity_amount = large_amount();
    env.setup_user(ACTOR_ID, liquidity_amount).await;
    env.setup_user(TRADER_1, liquidity_amount).await;

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

    let (reserve_a, _) = env.get_reserves().await;
    let amount_in = calculate_swap_amount_from_percent(reserve_a, 5);
    let min_out = U256::zero();

    env.pair
        .swap_exact_tokens_for_tokens(
            amount_in,
            min_out,
            true, // A -> B
            env.get_deadline(),
        )
        .with_params(|args| args.with_actor_id(trader))
        .await
        .unwrap();

    let (reserve0_before, reserve1_before) = env.get_reserves().await;
    let (_, fee0_before, fee1_before) = env.pair.get_treasury_info().await.unwrap();

    let (target0_before, target1_before, _) = env.get_balances(migration_target).await;

    assert!(
        !reserve0_before.is_zero() || !reserve1_before.is_zero(),
        "Reserves should be non-zero before migration"
    );

    env.pair
        .migrate_all_liquidity(migration_target)
        .with_params(|args| args.with_actor_id(admin_id))
        .await
        .unwrap();

    let (reserve0_after, reserve1_after) = env.get_reserves().await;
    assert_eq!(
        reserve0_after,
        U256::zero(),
        "reserve0 must be zero after migration"
    );
    assert_eq!(
        reserve1_after,
        U256::zero(),
        "reserve1 must be zero after migration"
    );

    let (_, fee0_after, fee1_after) = env.pair.get_treasury_info().await.unwrap();
    assert_eq!(
        fee0_after,
        U256::zero(),
        "accrued_treasury_fee0 must be zero after migration"
    );
    assert_eq!(
        fee1_after,
        U256::zero(),
        "accrued_treasury_fee1 must be zero after migration"
    );

    let (target0_after, target1_after, _) = env.get_balances(migration_target).await;

    let expected_delta0 = reserve0_before + fee0_before;
    let expected_delta1 = reserve1_before + fee1_before;

    assert_eq!(
        target0_after,
        target0_before + expected_delta0,
        "Migration target token0 balance must increase by all pool holdings"
    );
    assert_eq!(
        target1_after,
        target1_before + expected_delta1,
        "Migration target token1 balance must increase by all pool holdings"
    );

    let (trader_a_before, trader_b_before, _) = env.get_balances(trader).await;
    let try_amount_in = small_amount();

    let res = env
        .pair
        .swap_exact_tokens_for_tokens(try_amount_in, U256::zero(), true, env.get_deadline())
        .with_params(|args| args.with_actor_id(trader))
        .await;

    assert!(res.is_err(), "Swap must fail after pool migration");

    let (trader_a_after, trader_b_after, _) = env.get_balances(trader).await;
    assert_eq!(
        (trader_a_before, trader_b_before),
        (trader_a_after, trader_b_after),
        "Trader balances must not change when swap fails on migrated pool"
    );
}

#[tokio::test]
async fn test_migrate_all_liquidity_only_admin_can_call() {
    let treasury_id = ActorId::from([2u8; 32]);
    let mut env = TestEnv::new(treasury_id).await;

    let admin_id: ActorId = ACTOR_ID.into();
    let migration_target = ActorId::from([9u8; 32]);

    let liquidity_amount = large_amount();
    env.setup_user(ACTOR_ID, liquidity_amount).await;
    env.setup_user(TRADER_1, liquidity_amount).await;

    env.pair
        .add_liquidity(
            liquidity_amount,
            liquidity_amount,
            liquidity_amount / U256::from(2),
            liquidity_amount / U256::from(2),
            env.get_deadline(),
        )
        .with_params(|args| args.with_actor_id(admin_id))
        .await
        .unwrap();

    let res = env
        .pair
        .migrate_all_liquidity(migration_target)
        .with_params(|args| args.with_actor_id(TRADER_1.into()))
        .await;

    assert!(
        res.is_err(),
        "Non-admin must not be able to migrate liquidity"
    );

    let (reserve0_after, reserve1_after) = env.get_reserves().await;
    assert!(
        !reserve0_after.is_zero() || !reserve1_after.is_zero(),
        "Reserves must remain non-zero after failed unauthorized migration"
    );
}
