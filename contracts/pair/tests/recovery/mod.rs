use crate::*;
use gtest::{Program, WasmProgram};
use pair_client::{vft::VftImpl, LockCtx, LockState, Pair as PairClient, PairCtors};

mod liquidity;
mod migration;
mod swap;
mod treasury;
#[derive(Debug, Clone)]
struct TokenMock {
    replies: Vec<Vec<u8>>,
}

impl TokenMock {
    pub fn new(replies: Vec<Vec<u8>>) -> Self {
        TokenMock { replies }
    }
}

impl WasmProgram for TokenMock {
    fn clone_boxed(&self) -> Box<dyn WasmProgram + 'static> {
        Box::new(self.clone())
    }

    fn init(&mut self, _payload: Vec<u8>) -> gtest::Result<Option<Vec<u8>>, &'static str> {
        Ok(Some(vec![]))
    }
    fn handle(&mut self, _payload: Vec<u8>) -> gtest::Result<Option<Vec<u8>>, &'static str> {
        let reply = if !self.replies.is_empty() {
            self.replies.remove(0)
        } else {
            return Err("No replies left");
        };

        // Reply must be SCALE-encoded bool, because Pair expects Transfer/TransferFrom replies.
        Ok(Some(reply))
    }
    fn state(&mut self) -> gtest::Result<Vec<u8>, &'static str> {
        Ok(vec![])
    }

    fn debug(&mut self, _data: &str) {}
}

async fn assert_paused(pair: &Service<PairImpl, GtestEnv>, expected: LockState) {
    let lock = pair.lock().await.unwrap();
    assert_eq!(lock, expected);
}

async fn assert_free(pair: &Service<PairImpl, GtestEnv>) {
    let lock = pair.lock().await.unwrap();
    assert_eq!(lock, LockState::Free);
}

struct Deployed {
    env: GtestEnv,
    pair: Service<PairImpl, GtestEnv>,
    lp_vft: Service<VftImpl, GtestEnv>,
    token_a_id: u64,
    token_b_id: u64,
}

fn vft_ok_tf() -> Vec<u8> {
    ("Vft", "TransferFrom", true).encode()
}
fn vft_no_tf() -> Vec<u8> {
    ("Vft", "TransferFrom", false).encode()
}
fn vft_ok_t() -> Vec<u8> {
    ("Vft", "Transfer", true).encode()
}
fn vft_no_t() -> Vec<u8> {
    ("Vft", "Transfer", false).encode()
}

fn vft_balance(value: U256) -> Vec<u8> {
    ("Vft", "BalanceOf", value).encode()
}
async fn deploy_pair_with_mocks(
    system: System,
    token_a_replies: Vec<Vec<u8>>,
    token_b_replies: Vec<Vec<u8>>,
) -> Deployed {
    let token_a_id = 100u64;
    let token_b_id = 101u64;

    let token_a_program =
        Program::mock_with_id(&system, token_a_id, TokenMock::new(token_a_replies));
    let init_a = token_a_program.send_bytes(ACTOR_ID, b"init");
    let r = system.run_next_block();
    assert!(r.succeed.contains(&init_a));

    let token_b_program =
        Program::mock_with_id(&system, token_b_id, TokenMock::new(token_b_replies));
    let init_b = token_b_program.send_bytes(ACTOR_ID, b"init");
    let r = system.run_next_block();
    assert!(r.succeed.contains(&init_b));

    let env = GtestEnv::new(system, ACTOR_ID.into());
    let code_id = env.system().submit_code(pair::WASM_BINARY);

    let config = Config {
        gas_for_token_ops: 20_000_000_000,
        gas_for_reply_deposit: 20_000_000_000,
        reply_timeout: 100,
        gas_for_full_tx: 100_000_000_000,
    };

    let pair_program = env
        .deploy::<pair_client::PairProgram>(code_id, b"salt".to_vec())
        .new(
            config,
            token_a_id.into(),
            token_b_id.into(),
            ACTOR_ID.into(),
            ACTOR_ID.into(),
            ACTOR_ID.into(),
        )
        .await
        .unwrap();

    Deployed {
        env,
        pair: pair_program.pair(),
        lp_vft: pair_program.vft(),
        token_a_id,
        token_b_id,
    }
}

#[tokio::test]
async fn swap_recovery_exact_input() {
    let system = System::new();
    system.init_logger();
    system.mint_to(ACTOR_ID, 1_000_000_000_000_000);
    let ok_tf = ("Vft", "TransferFrom", true).encode();
    let no_tf = ("Vft", "TransferFrom", false).encode();
    let no_t = ("Vft", "Transfer", false).encode();
    let ok_t = ("Vft", "Transfer", true).encode();

    let token_a_mock = TokenMock::new(vec![
        ok_tf.clone(), // token0 transfer_from (add liquidity)
        ok_tf.clone(), // token0 transfer_from
        no_t.clone(),  // refund transfer fails => pause
        ok_t.clone(),  // recovery refund succeeds
    ]);

    let token_b_mock = TokenMock::new(vec![
        ok_tf.clone(), // token1 transfer_from (add liquidity)
        no_tf.clone(), // token1 transfer_from fails
    ]);

    let token_a_id = 100;
    let token_a_program = Program::mock_with_id(&system, token_a_id, token_a_mock);
    let init_message_id = token_a_program.send_bytes(ACTOR_ID, b"Doesn't matter");
    let block_run_result = system.run_next_block();
    assert!(block_run_result.succeed.contains(&init_message_id));

    let token_b_id = 101;
    let token_b_program = Program::mock_with_id(&system, token_b_id, token_b_mock);
    let init_message_id = token_b_program.send_bytes(ACTOR_ID, b"Doesn't matter");
    let block_run_result = system.run_next_block();
    assert!(block_run_result.succeed.contains(&init_message_id));

    let env = GtestEnv::new(system, ACTOR_ID.into());
    let program_code_id = env.system().submit_code(pair::WASM_BINARY);

    let config = Config {
        gas_for_token_ops: 20_000_000_000,
        gas_for_reply_deposit: 20_000_000_000,
        reply_timeout: 100,
        gas_for_full_tx: 100_000_000_000,
    };
    let pair_program = env
        .deploy::<pair_client::PairProgram>(program_code_id, b"salt".to_vec())
        .new(
            config,
            token_a_id.into(),
            token_b_id.into(),
            ACTOR_ID.into(),
            ACTOR_ID.into(),
            ACTOR_ID.into(),
        )
        .await
        .unwrap();
    let mut pair = pair_program.pair();

    let user = ACTOR_ID.into();
    let amount = medium_amount();
    let deadline = env.system().block_timestamp() + 10000;
    pair.add_liquidity(
        amount,
        amount,
        amount / U256::from(2),
        amount / U256::from(2),
        deadline,
    )
    .with_params(|args| args.with_actor_id(user))
    .await
    .unwrap();

    let amount_in = U256::from(10000);

    let min_amount_out = U256::zero();

    let result = pair
        .swap_exact_tokens_for_tokens(
            amount_in,
            min_amount_out,
            true, // A to B
            env.system().block_timestamp() + 100000,
        )
        .with_params(|args| args.with_actor_id(user))
        .await;
    assert!(
        result.is_err(),
        "swap_exact_tokens_for_tokens should fail and put contract into paused state"
    );
    let lock = pair.lock().await.unwrap();
    let exp_lock = LockState::Paused(LockCtx::SwapRefund {
        user,
        token: token_a_id.into(),
        amount: amount_in,
    });
    assert_eq!(lock, exp_lock);

    pair.recover_paused()
        .with_params(|args| args.with_actor_id(user))
        .await
        .unwrap();
    let lock = pair.lock().await.unwrap();
    assert_eq!(lock, LockState::Free);
}

#[tokio::test]
async fn swap_recovery_exact_output() {
    let system = System::new();
    system.init_logger();
    system.mint_to(ACTOR_ID, 1_000_000_000_000_000);
    let ok_tf = ("Vft", "TransferFrom", true).encode();
    let no_tf = ("Vft", "TransferFrom", false).encode();
    let no_t = ("Vft", "Transfer", false).encode();
    let ok_t = ("Vft", "Transfer", true).encode();

    let token_a_mock = TokenMock::new(vec![
        ok_tf.clone(), // token0 transfer_from (add liquidity)
        ok_tf.clone(), // token0 transfer_from
        no_t.clone(),  // refund transfer fails => pause
        ok_t.clone(),  // recovery refund succeeds
    ]);

    let token_b_mock = TokenMock::new(vec![
        ok_tf.clone(), // token1 transfer_from (add liquidity)
        no_tf.clone(), // token1 transfer_from fails
    ]);

    let token_a_id = 100;
    let token_a_program = Program::mock_with_id(&system, token_a_id, token_a_mock);
    let init_message_id = token_a_program.send_bytes(ACTOR_ID, b"Doesn't matter");
    let block_run_result = system.run_next_block();
    assert!(block_run_result.succeed.contains(&init_message_id));

    let token_b_id = 101;
    let token_b_program = Program::mock_with_id(&system, token_b_id, token_b_mock);
    let init_message_id = token_b_program.send_bytes(ACTOR_ID, b"Doesn't matter");
    let block_run_result = system.run_next_block();
    assert!(block_run_result.succeed.contains(&init_message_id));

    let env = GtestEnv::new(system, ACTOR_ID.into());
    let program_code_id = env.system().submit_code(pair::WASM_BINARY);

    let config = Config {
        gas_for_token_ops: 20_000_000_000,
        gas_for_reply_deposit: 20_000_000_000,
        reply_timeout: 100,
        gas_for_full_tx: 100_000_000_000,
    };
    let pair_program = env
        .deploy::<pair_client::PairProgram>(program_code_id, b"salt".to_vec())
        .new(
            config,
            token_a_id.into(),
            token_b_id.into(),
            ACTOR_ID.into(),
            ACTOR_ID.into(),
            ACTOR_ID.into(),
        )
        .await
        .unwrap();
    let mut pair = pair_program.pair();

    let user = ACTOR_ID.into();
    let amount = medium_amount();
    let deadline = env.system().block_timestamp() + 10000;
    pair.add_liquidity(
        amount,
        amount,
        amount / U256::from(2),
        amount / U256::from(2),
        deadline,
    )
    .with_params(|args| args.with_actor_id(user))
    .await
    .unwrap();

    let amount_out = U256::from(10000);

    let max_amount_in = U256::from(100000000);

    let amount = pair.get_amount_in(amount_out, true).await.unwrap();

    let result = pair
        .swap_tokens_for_exact_tokens(
            amount_out,
            max_amount_in,
            true, // A to B
            env.system().block_timestamp() + 100000,
        )
        .with_params(|args| args.with_actor_id(user))
        .await;
    assert!(
        result.is_err(),
        "swap_exact_tokens_for_tokens should fail and put contract into paused state"
    );
    let lock = pair.lock().await.unwrap();
    let exp_lock = LockState::Paused(LockCtx::SwapRefund {
        user,
        token: token_a_id.into(),
        amount,
    });
    assert_eq!(lock, exp_lock);

    pair.recover_paused()
        .with_params(|args| args.with_actor_id(user))
        .await
        .unwrap();
    let lock = pair.lock().await.unwrap();
    assert_eq!(lock, LockState::Free);
}
