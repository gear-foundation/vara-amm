use crate::*;
use extended_vft_client::vft::Vft;
use extended_vft_client::{ExtendedVftClient, ExtendedVftClientCtors, ExtendedVftClientProgram};
use pair_client::vft::Vft as LpVft;

use pair_client::{Pair as PairClient, PairCtors, PairProgram};

pub struct TestEnv {
    pub env: GtestEnv,
    pub token_a: Service<extended_vft_client::vft::VftImpl, GtestEnv>,
    pub token_b: Service<extended_vft_client::vft::VftImpl, GtestEnv>,
    pub pair: Service<PairImpl, GtestEnv>,
    pub lp_vft: Service<pair_client::vft::VftImpl, GtestEnv>,
}

impl TestEnv {
    pub async fn new(treasury_id: ActorId) -> Self {
        let system = System::new();
        system.init_logger();
        system.mint_to(ACTOR_ID, 1_000_000_000_000_000);

        let env = GtestEnv::new(system, ACTOR_ID.into());

        let (token_a_program, token_b_program, pair_program) =
            TestEnv::setup_tokens_and_pair(&env, FEE_TO.into(), treasury_id).await;

        let pair = pair_program.pair();
        let lp_vft = pair_program.vft();
        let token_a = token_a_program.vft();
        let token_b = token_b_program.vft();

        Self {
            env,
            token_a,
            token_b,
            pair,
            lp_vft,
        }
    }

    pub async fn setup_tokens_and_pair(
        env: &GtestEnv,
        fee_to: ActorId,
        treasury_id: ActorId,
    ) -> (
        Actor<ExtendedVftClientProgram, GtestEnv>,
        Actor<ExtendedVftClientProgram, GtestEnv>,
        Actor<PairProgram, GtestEnv>,
    ) {
        let release_path = "../target/wasm32-gear/release/extended_vft.opt.wasm";
        let debug_path = "../target/wasm32-gear/debug/extended_vft.opt.wasm";

        let wasm_path = if std::path::Path::new(release_path).exists() {
            release_path
        } else {
            debug_path
        };

        let token_code_id = env.system().submit_code_file(wasm_path);

        let token_a = env
            .deploy::<extended_vft_client::ExtendedVftClientProgram>(
                token_code_id,
                b"salt1".to_vec(),
            )
            .new("TokenA".to_string(), "TokenA".to_string(), 6)
            .await
            .unwrap();

        let token_b = env
            .deploy::<extended_vft_client::ExtendedVftClientProgram>(
                token_code_id,
                b"salt2".to_vec(),
            )
            .new("TokenB".to_string(), "TokenB".to_string(), 6)
            .await
            .unwrap();

        let program_code_id = env.system().submit_code(pair::WASM_BINARY);

        let config = Config {
            gas_for_token_ops: 5_000_000_000,
            gas_for_reply_deposit: 5_000_000_000,
            reply_timeout: 50,
            gas_for_full_tx: 100_000_000_000,
        };

        let pair = env
            .deploy::<pair_client::PairProgram>(program_code_id, b"salt".to_vec())
            .new(
                config,
                token_a.id(),
                token_b.id(),
                fee_to,
                treasury_id,
                ACTOR_ID.into(),
            )
            .await
            .unwrap();

        (token_a, token_b, pair)
    }

    pub async fn setup_user(&mut self, user_id: u64, token_amount: U256) {
        self.env.system().mint_to(user_id, 1_000_000_000_000_000);
        self.mint_and_approve_tokens(user_id.into(), token_amount)
            .await;
    }

    pub async fn mint_and_approve_tokens(&mut self, user: ActorId, amount: U256) {
        // Mint tokens to user
        self.token_a.mint(user.into(), amount).await.unwrap();
        self.token_b.mint(user.into(), amount).await.unwrap();

        // Approve pair to spend tokens
        self.token_a
            .approve(self.pair.actor_id(), amount)
            .with_params(|args| args.with_actor_id(user))
            .await
            .unwrap();
        self.token_b
            .approve(self.pair.actor_id(), amount)
            .with_params(|args| args.with_actor_id(user))
            .await
            .unwrap();
    }

    pub fn get_deadline(&self) -> u64 {
        self.env.system().block_timestamp() + 100_000_000
    }

    /// Get user balances (token_a, token_b, lp_tokens)
    pub async fn get_balances(&self, user: ActorId) -> (U256, U256, U256) {
        let token_a_balance = self.token_a.balance_of(user).await.unwrap();

        let token_b_balance = self.token_b.balance_of(user).await.unwrap();

        let lp_balance = self.lp_vft.balance_of(user).await.unwrap();
        (token_a_balance, token_b_balance, lp_balance)
    }

    /// Get current pair reserves
    pub async fn get_reserves(&self) -> (U256, U256) {
        self.pair.get_reserves().await.unwrap()
    }

    /// Get total LP token supply
    pub async fn get_total_supply(&self) -> U256 {
        self.lp_vft.total_supply().await.unwrap()
    }

    /// Get current pair price (B tokens per A token)
    pub async fn get_price_b_per_a(&self) -> U256 {
        let (reserve_a, reserve_b) = self.get_reserves().await;
        if reserve_a == U256::zero() {
            U256::zero()
        } else {
            reserve_b * U256::exp10(18) / reserve_a
        }
    }
}
