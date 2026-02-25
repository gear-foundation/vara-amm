use pair_client::SendTokenStage;

use crate::recovery::*;

#[tokio::test]
async fn migrate_all_liquidity_recovery_send_token1() {
    let system = System::new();
    system.init_logger();
    system.mint_to(ACTOR_ID, 1_000_000_000_000_000);

    let user = ACTOR_ID.into();
    let amount = medium_amount();

    // balances returned by token mocks during migrate_all_liquidity()
    let bal0 = U256::from(111_000u128);
    let bal1 = U256::from(222_000u128);

    // add_liq: tokenA TF ok, tokenB TF ok
    // migrate: balance_of tokenA -> bal0, balance_of tokenB -> bal1
    // migrate payouts (return_tokens_from_pool):
    //   tokenA Transfer ok (UnlockTokenA), tokenB Transfer fails (UnlockTokenB),
    //   recovery: tokenB Transfer ok
    let token_a = vec![
        vft_ok_tf(), // add_liq tokenA transfer_from
        vft_balance(bal0),
        vft_ok_t(), // migrate balance_of(tokenA, program_id)
    ];

    let token_b = vec![
        vft_ok_tf(), // add_liq tokenB transfer_from
        vft_balance(bal1),
        vft_no_t(), // migrate send token1 to target fails (UnlockTokenB) => pause
        vft_ok_t(), // recovery: send token1 succeeds
    ];

    let Deployed { env, mut pair, .. } = deploy_pair_with_mocks(system, token_a, token_b).await;

    // create some non-zero reserves (not strictly required, but makes the test meaningful)
    let deadline = env.system().block_timestamp() + 10_000;
    pair.add_liquidity(amount, amount, amount / 2, amount / 2, deadline)
        .with_params(|p| p.with_actor_id(user))
        .await
        .unwrap();

    let (r0_before, r1_before) = pair.get_reserves().await.unwrap();
    assert!(!r0_before.is_zero() || !r1_before.is_zero());

    let target = ActorId::from(777u64);

    // should fail (token1 transfer returns false) and pause
    let res = pair.migrate_all_liquidity(target).await;
    assert!(res.is_err());

    // stage must be SendToken1 if token0 transfer succeeded
    assert_paused(
        &pair,
        LockState::Paused(LockCtx::MigrateAllLiquidity {
            target,
            amount0: bal0,
            amount1: bal1,
            stage: SendTokenStage::SendToken1,
        }),
    )
    .await;

    // recovery (admin only)
    pair.recover_paused().await.unwrap();

    // state must be finalized
    assert_free(&pair).await;

    let (r0_after, r1_after) = pair.get_reserves().await.unwrap();
    assert!(
        r0_after.is_zero() && r1_after.is_zero(),
        "reserves must be zero after migration"
    );

    let migrated = pair.migrated().await.unwrap();
    assert!(
        migrated,
        "pool must be marked as migrated after successful recovery"
    );
}
