use crate::recovery::*;

#[tokio::test]
async fn swap_recovery_exact_input_a_to_b() {
    let system = System::new();
    system.mint_to(ACTOR_ID, 1_000_000_000_000_000);
    let user = ACTOR_ID.into();
    let amount = medium_amount();
    let amount_in = U256::from(10_000);
    let min_out = U256::zero();

    // tokenA replies:
    // add_liq TF ok, swap TF ok, refund T fails, recovery T ok
    let token_a = vec![vft_ok_tf(), vft_ok_tf(), vft_no_t(), vft_ok_t()];
    // tokenB replies:
    // add_liq TF ok, swap out T fails
    let token_b = vec![vft_ok_tf(), vft_no_t()];

    let Deployed {
        env,
        mut pair,
        token_a_id,
        ..
    } = deploy_pair_with_mocks(system, token_a, token_b).await;

    let deadline = env.system().block_timestamp() + 10_000;

    pair.add_liquidity(amount, amount, amount / 2, amount / 2, deadline)
        .with_params(|p| p.with_actor_id(user))
        .await
        .unwrap();

    let res = pair
        .swap_exact_tokens_for_tokens(
            amount_in,
            min_out,
            true,
            env.system().block_timestamp() + 100_000,
        )
        .with_params(|p| p.with_actor_id(user))
        .await;

    assert!(res.is_err());

    assert_paused(
        &pair,
        LockState::Paused(LockCtx::SwapRefund {
            user,
            token: token_a_id.into(),
            amount: amount_in,
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
async fn swap_recovery_exact_input_b_to_a() {
    let system = System::new();
    system.mint_to(ACTOR_ID, 1_000_000_000_000_000);
    let user = ACTOR_ID.into();
    let amount = medium_amount();
    let amount_in = U256::from(10_000);
    let min_out = U256::zero();

    // add_liq: tokenA TF ok, tokenB TF ok
    // swap B->A: tokenB TF ok, tokenA T fails (out), refund tokenB T fails, recovery tokenB T ok
    let token_a = vec![vft_ok_tf(), vft_no_t()]; // add_liq TF ok, swap out T fails
    let token_b = vec![vft_ok_tf(), vft_ok_tf(), vft_no_t(), vft_ok_t()]; // add_liq TF ok, swap in TF ok, refund fail, recovery ok

    let Deployed {
        env,
        mut pair,
        token_b_id,
        ..
    } = deploy_pair_with_mocks(system, token_a, token_b).await;

    let deadline = env.system().block_timestamp() + 10_000;

    pair.add_liquidity(amount, amount, amount / 2, amount / 2, deadline)
        .with_params(|p| p.with_actor_id(user))
        .await
        .unwrap();

    let res = pair
        .swap_exact_tokens_for_tokens(
            amount_in,
            min_out,
            false,
            env.system().block_timestamp() + 100_000,
        )
        .with_params(|p| p.with_actor_id(user))
        .await;

    assert!(res.is_err());

    assert_paused(
        &pair,
        LockState::Paused(LockCtx::SwapRefund {
            user,
            token: token_b_id.into(),
            amount: amount_in,
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
async fn swap_recovery_exact_output_a_to_b() {
    let system = System::new();
    system.mint_to(ACTOR_ID, 1_000_000_000_000_000);
    let user = ACTOR_ID.into();
    let amount = medium_amount();
    let amount_out = U256::from(10_000);
    let max_in = U256::from(100_000_000);

    let token_a = vec![vft_ok_tf(), vft_ok_tf(), vft_no_t(), vft_ok_t()]; // add TF ok, swap TF ok, refund fail, recovery ok
    let token_b = vec![vft_ok_tf(), vft_no_t()]; // add TF ok, swap out fails

    let Deployed {
        env,
        mut pair,
        token_a_id,
        ..
    } = deploy_pair_with_mocks(system, token_a, token_b).await;
    let deadline = env.system().block_timestamp() + 10_000;

    pair.add_liquidity(amount, amount, amount / 2, amount / 2, deadline)
        .with_params(|p| p.with_actor_id(user))
        .await
        .unwrap();

    let amount_in_total = pair.get_amount_in(amount_out, true).await.unwrap();

    let res = pair
        .swap_tokens_for_exact_tokens(
            amount_out,
            max_in,
            true,
            env.system().block_timestamp() + 100_000,
        )
        .with_params(|p| p.with_actor_id(user))
        .await;

    assert!(res.is_err());

    assert_paused(
        &pair,
        LockState::Paused(LockCtx::SwapRefund {
            user,
            token: token_a_id.into(),
            amount: amount_in_total,
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
async fn swap_recovery_exact_output_b_to_a() {
    let system = System::new();
    system.mint_to(ACTOR_ID, 1_000_000_000_000_000);
    let user = ACTOR_ID.into();
    let amount = medium_amount();
    let amount_out = U256::from(10_000);
    let max_in = U256::from(100_000_000);

    let token_a = vec![vft_ok_tf(), vft_no_t()]; // add TF ok, swap out fails (A is out)
    let token_b = vec![vft_ok_tf(), vft_ok_tf(), vft_no_t(), vft_ok_t()]; // add TF ok, swap in TF ok, refund fail, recovery ok

    let Deployed {
        env,
        mut pair,
        token_b_id,
        ..
    } = deploy_pair_with_mocks(system, token_a, token_b).await;
    let deadline = env.system().block_timestamp() + 10_000;

    pair.add_liquidity(amount, amount, amount / 2, amount / 2, deadline)
        .with_params(|p| p.with_actor_id(user))
        .await
        .unwrap();

    let amount_in_total = pair.get_amount_in(amount_out, false).await.unwrap();

    let res = pair
        .swap_tokens_for_exact_tokens(
            amount_out,
            max_in,
            false,
            env.system().block_timestamp() + 100_000,
        )
        .with_params(|p| p.with_actor_id(user))
        .await;

    assert!(res.is_err());

    assert_paused(
        &pair,
        LockState::Paused(LockCtx::SwapRefund {
            user,
            token: token_b_id.into(),
            amount: amount_in_total,
        }),
    )
    .await;

    pair.recover_paused()
        .with_params(|p| p.with_actor_id(user))
        .await
        .unwrap();
    assert_free(&pair).await;
}
