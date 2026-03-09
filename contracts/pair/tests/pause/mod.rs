use crate::recovery::{deploy_pair_with_mocks, vft_ok_t, vft_ok_tf, Deployed};
use crate::{recovery::vft_no_t, *};
use pair_client::vft::Vft;
#[tokio::test]
async fn add_liquidity_failed_on_token0_does_not_leave_lp_paused_forever() {
    let treasury_id = ActorId::zero();
    let mut env = TestEnv::new(treasury_id).await;

    let liquidity_amount = large_amount();
    let trader_funds = liquidity_amount / U256::from(2);
    let user = TRADER_1.into();
    env.setup_user(TRADER_1, trader_funds).await;
    let result = env
        .pair
        .add_liquidity(
            liquidity_amount,
            liquidity_amount,
            liquidity_amount / U256::from(2),
            liquidity_amount / U256::from(2),
            env.get_deadline(),
        )
        .with_params(|args| args.with_actor_id(user))
        .await;

    assert!(result.is_err());
    assert!(!env.lp_vft.is_paused().await.unwrap());
}

#[tokio::test]
async fn send_treasury_fee_first_transfer_fail_pause_state_expected() {
    let system = System::new();
    system.mint_to(ACTOR_ID, 1_000_000_000_000_000);
    let user = ACTOR_ID.into();
    //let admin = ACTOR_ID.into();
    let amount = medium_amount();

    // Build token scripts:
    //
    // add_liq: A TF ok, B TF ok
    // swap A->B: A TF ok, B T ok
    // swap B->A: B TF ok, A T ok
    // treasury payout: A T fail (fee0)
    let token_a = vec![
        vft_ok_tf(), // add_liq: tokenA transfer_from
        vft_ok_tf(), // swap A->B: tokenA transfer_from (token_in)
        vft_ok_t(),  // swap B->A: tokenA transfer (token_out)
        vft_no_t(),  // treasury payout: send tokenA fee fails => pause
    ];

    let token_b = vec![
        vft_ok_tf(), // add_liq: tokenB transfer_from
        vft_ok_t(),  // swap A->B: tokenB transfer (token_out)
        vft_ok_tf(), // swap B->A: tokenB transfer_from (token_in)
    ];

    let Deployed {
        env,
        mut pair,
        lp_vft,
        ..
    } = deploy_pair_with_mocks(system, token_a, token_b).await;

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
    let (treasury_id, fee0_before, fee1_before) = pair.get_treasury_info().await.unwrap();
    assert!(
        !treasury_id.is_zero(),
        "treasury must be enabled for this test"
    );
    assert!(!fee0_before.is_zero(), "fee0 must be > 0 after A->B swap");
    assert!(!fee1_before.is_zero(), "fee1 must be > 0 after B->A swap");

    // payout should fail on token1 transfer and pause
    let res = pair
        .send_treasury_fees()
        .with_params(|p| p.with_actor_id(treasury_id)) // caller must be treasury_id
        .await;
    assert!(res.is_err());

    assert!(lp_vft.is_paused().await.unwrap());

    let (_, fee0_after, fee1_after) = pair.get_treasury_info().await.unwrap();
    assert_eq!(fee0_before, fee0_after);
    assert_eq!(fee1_before, fee1_after);
}

#[tokio::test]
async fn swap_fail_return_token_does_not_leave_lp_paused_forever() {
    let system = System::new();
    system.init_logger();
    system.mint_to(ACTOR_ID, 1_000_000_000_000_000);
    let user = ACTOR_ID.into();
    //let admin = ACTOR_ID.into();
    let amount = medium_amount();

    // Build token scripts:
    //
    // add_liq: A TF ok, B TF ok
    // swap A->B: A TF ok, B T fail, A T ok
    let token_a = vec![
        vft_ok_tf(), // add_liq: tokenA transfer_from
        vft_ok_tf(), // swap A->B: tokenA transfer_from (token_in)
        vft_ok_t(),  // sswap A->B: tokenA return ok
    ];

    let token_b = vec![
        vft_ok_tf(), // add_liq: tokenB transfer_from
        vft_no_t(),  // swap A->B: tokenB transfer (token_out) fail
    ];

    let Deployed {
        env,
        mut pair,
        lp_vft,
        ..
    } = deploy_pair_with_mocks(system, token_a, token_b).await;

    // add liquidity
    let deadline = env.system().block_timestamp() + 10_000;
    pair.add_liquidity(amount, amount, amount / 2, amount / 2, deadline)
        .with_params(|p| p.with_actor_id(user))
        .await
        .unwrap();

    let (reserve_a_before, reserve_b_before) = pair.get_reserves().await.unwrap();
    let amount_in = U256::from(10_000u128);

    let result = pair
        .swap_exact_tokens_for_tokens(
            amount_in,
            U256::zero(),
            true, // A -> B
            env.system().block_timestamp() + 100_000,
        )
        .with_params(|p| p.with_actor_id(user))
        .await;
    assert!(result.is_err());
    let (reserve_a_after, reserve_b_after) = pair.get_reserves().await.unwrap();
    assert_eq!(reserve_a_before, reserve_a_after);
    assert_eq!(reserve_b_before, reserve_b_after);
    assert!(!lp_vft.is_paused().await.unwrap());
}
