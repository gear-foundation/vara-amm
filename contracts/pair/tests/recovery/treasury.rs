use pair_client::SendTokenStage;

use crate::recovery::*;

#[tokio::test]
async fn treasury_payout_recovery_send_token1() {
    let system = System::new();
    system.mint_to(ACTOR_ID, 1_000_000_000_000_000);
    let user = ACTOR_ID.into();
    let admin = ACTOR_ID.into();
    let amount = medium_amount();

    // Build token scripts:
    //
    // add_liq: A TF ok, B TF ok
    // swap A->B: A TF ok, B T ok
    // swap B->A: B TF ok, A T ok
    // treasury payout: A T ok (fee0), B T fail (fee1)
    // recovery: B T ok
    let token_a = vec![
        vft_ok_tf(), // add_liq: tokenA transfer_from
        vft_ok_tf(), // swap A->B: tokenA transfer_from (token_in)
        vft_ok_t(),  // swap B->A: tokenA transfer (token_out)
        vft_ok_t(),  // treasury payout: send tokenA fee to treasury
    ];

    let token_b = vec![
        vft_ok_tf(), // add_liq: tokenB transfer_from
        vft_ok_t(),  // swap A->B: tokenB transfer (token_out)
        vft_ok_tf(), // swap B->A: tokenB transfer_from (token_in)
        vft_no_t(),  // treasury payout: send tokenB fee fails => pause
        vft_ok_t(),  // recovery: send tokenB fee succeeds
    ];

    let Deployed { env, mut pair, .. } = deploy_pair_with_mocks(system, token_a, token_b).await;

    // add liquidity
    let deadline = env.system().block_timestamp() + 10_000;
    pair.add_liquidity(amount, amount, amount / 2, amount / 2, deadline)
        .with_params(|p| p.with_actor_id(user))
        .await
        .unwrap();

    // Make two swaps to accrue fees in both tokens.
    // Use a small but non-zero amount to ensure treasury_fee != 0.
    let amount_in = U256::from(10_000u128);

    pair.swap_exact_tokens_for_tokens(
        amount_in,
        U256::zero(),
        true, // A -> B
        env.system().block_timestamp() + 100_000,
    )
    .with_params(|p| p.with_actor_id(user))
    .await
    .unwrap();

    pair.swap_exact_tokens_for_tokens(
        amount_in,
        U256::zero(),
        false, // B -> A
        env.system().block_timestamp() + 100_000,
    )
    .with_params(|p| p.with_actor_id(user))
    .await
    .unwrap();

    // Check treasury fees are actually accrued
    let (treasury_id, fee0, fee1) = pair.get_treasury_info().await.unwrap();
    assert!(
        !treasury_id.is_zero(),
        "treasury must be enabled for this test"
    );
    assert!(!fee0.is_zero(), "fee0 must be > 0 after A->B swap");
    assert!(!fee1.is_zero(), "fee1 must be > 0 after B->A swap");

    // payout should fail on token1 transfer and pause
    let res = pair
        .send_treasury_fees()
        .with_params(|p| p.with_actor_id(treasury_id)) // caller must be treasury_id
        .await;
    assert!(res.is_err());

    assert_paused(
        &pair,
        LockState::Paused(LockCtx::TreasuryPayout {
            treasury: treasury_id,
            amount0: fee0,
            amount1: fee1,
            stage: SendTokenStage::SendToken1,
        }),
    )
    .await;

    // recovery (your recover_paused requires admin)
    pair.recover_paused()
        .with_params(|p| p.with_actor_id(admin))
        .await
        .unwrap();

    assert_free(&pair).await;

    // After successful recovery accrued fees must be cleared
    let (_, fee0_after, fee1_after) = pair.get_treasury_info().await.unwrap();
    assert!(
        fee0_after.is_zero() && fee1_after.is_zero(),
        "treasury fees must be cleared after recovery"
    );
}
