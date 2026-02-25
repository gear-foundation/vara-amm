use pair_client::{vft::Vft, SendTokenStage};

use crate::recovery::*;

#[tokio::test]
async fn add_liquidity_recovery() {
    let system = System::new();
    system.init_logger();
    system.mint_to(ACTOR_ID, 1_000_000_000_000_000);

    let ok_tf = vft_ok_tf();
    let no_tf = vft_no_tf();
    let no_t = vft_no_t();
    let ok_t = vft_ok_t();

    // token0: TF ok, refund T fails, recovery T ok
    let token_a = vec![ok_tf.clone(), no_t.clone(), ok_t.clone()];
    // token1: TF fails
    let token_b = vec![no_tf.clone()];

    let Deployed {
        env,
        mut pair,
        token_a_id,
        ..
    } = deploy_pair_with_mocks(system, token_a, token_b).await;

    let user = ACTOR_ID.into();
    let amount = medium_amount();
    let deadline = env.system().block_timestamp() + 10_000;

    let res = pair
        .add_liquidity(amount, amount, amount / 2, amount / 2, deadline)
        .with_params(|p| p.with_actor_id(user))
        .await;

    assert!(res.is_err());

    assert_paused(
        &pair,
        LockState::Paused(LockCtx::AddLiqRefund {
            user,
            token: token_a_id.into(),
            amount,
        }),
    )
    .await;

    pair.recover_paused()
        .with_params(|p| p.with_actor_id(user))
        .await
        .unwrap();
    assert_free(&pair).await;
}

#[tokio::test]
async fn remove_liquidity_recovery_unlock_b() {
    let system = System::new();
    system.mint_to(ACTOR_ID, 1_000_000_000_000_000);
    let user = ACTOR_ID.into();
    let amount = medium_amount();

    // add_liq: tokenA TF ok, tokenB TF ok
    // rem_liq: tokenA Transfer ok, tokenB Transfer fails, recovery tokenB Transfer ok
    let token_a = vec![vft_ok_tf(), vft_ok_t()];
    let token_b = vec![vft_ok_tf(), vft_no_t(), vft_ok_t()];

    let Deployed {
        env,
        mut pair,
        lp_vft,
        ..
    } = deploy_pair_with_mocks(system, token_a, token_b).await;
    let deadline = env.system().block_timestamp() + 10_000;

    pair.add_liquidity(amount, amount, amount / 2, amount / 2, deadline)
        .with_params(|p| p.with_actor_id(user))
        .await
        .unwrap();

    let lp = lp_vft.balance_of(user).await.unwrap();

    let (amount_a, amount_b) = pair.calculate_remove_liquidity(lp).await.unwrap();
    let (reserve_0_before, reserve_1_before) = pair.get_reserves().await.unwrap();

    let res = pair
        .remove_liquidity(
            lp,
            U256::zero(),
            U256::zero(),
            env.system().block_timestamp() + 100_000,
        )
        .with_params(|p| p.with_actor_id(user))
        .await;

    assert!(res.is_err());

    assert_paused(
        &pair,
        LockState::Paused(LockCtx::RemLiq {
            user,
            liquidity: lp,
            amount_a,
            amount_b,
            stage: SendTokenStage::SendToken1,
        }),
    )
    .await;

    pair.recover_paused()
        .with_params(|p| p.with_actor_id(user))
        .await
        .unwrap();

    let (reserve_0_after, reserve_1_after) = pair.get_reserves().await.unwrap();
    assert_eq!(reserve_0_after + amount_a, reserve_0_before);
    assert_eq!(reserve_1_after + amount_b, reserve_1_before);

    let lp_after = lp_vft.balance_of(user).await.unwrap();
    assert!(lp_after.is_zero());
    assert_free(&pair).await;
}
